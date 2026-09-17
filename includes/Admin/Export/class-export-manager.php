<?php
/**
 * Performant Chunked Burst Data Export Manager.
 *
 * Implements keyset pagination, stream compression (gz/zip), multi-row batched INSERTs,
 * and chunked execution modeled after UpdraftPlus database dump optimizations.
 *
 * @package Burst\Admin\Export
 */

namespace Burst\Admin\Export;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use WP_REST_Response;
use ZipArchive;

defined( 'ABSPATH' ) || die();

/**
 * Class Export_Manager
 */
class Export_Manager {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Default batch size of rows per query chunk.
	 */
	const CHUNK_ROW_LIMIT = 5000;

	/**
	 * Maximum rows processed per REST chunk before yielding.
	 */
	const MAX_ROWS_PER_CHUNK = 25000;

	/**
	 * Rows grouped per multi-row INSERT statement.
	 */
	const ROWS_PER_INSERT = 250;

	/**
	 * Transient TTL for active export sessions (2 hours).
	 */
	const SESSION_TTL = 7200;

	/**
	 * Width of the '-- Rows:' header field; wide enough for any row count.
	 */
	private const ROW_COUNT_WIDTH = 20;

	/**
	 * Initialize hooks.
	 */
	public function init(): void {
		add_action( 'admin_post_burst_export_download', [ $this, 'handle_admin_download' ] );
		add_filter( 'burst_do_action', [ $this, 'do_rest_action' ], 10, 3 );
		add_filter( 'burst_get_action', [ $this, 'get_rest_action' ], 10, 2 );
		add_action( 'burst_daily', [ $this, 'cleanup_old_exports' ] );
		add_action( 'burst_daily', [ $this, 'maybe_run_scheduled_export' ] );
		add_action( 'burst_export_cron_iteration', [ $this, 'run_cron_iteration' ] );
	}




	/**
	 * Intercept burst_do_action for export actions.
	 *
	 * Dispatches directly to the relevant method instead of building a throwaway
	 * WP_REST_Request shim — each handler now receives $data directly.
	 *
	 * @param array<string, mixed>      $output Existing output.
	 * @param string                    $action Action name.
	 * @param array<string, mixed>|null $data   Request data; null when the action was sent without action_data.
	 * @return array<string, mixed>
	 */
	public function do_rest_action( array $output, string $action, ?array $data ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}
		$data = $data ?? [];

		$dispatch = [
			'export_start'         => [ $this, 'handle_export_start' ],
			'export_chunk'         => [ $this, 'handle_export_chunk' ],
			'export_pause'         => [ $this, 'handle_export_pause' ],
			'export_cancel'        => [ $this, 'handle_export_cancel' ],
			'export_save_schedule' => [ $this, 'handle_export_save_schedule' ],
			'export_delete'        => [ $this, 'handle_export_delete' ],
		];

		if ( isset( $dispatch[ $action ] ) ) {
			$result = call_user_func( $dispatch[ $action ], $data );
			return array_merge( $output, (array) $result );
		}

		return $output;
	}

	/**
	 * Handle export_start action — receives $data directly from burst_do_action.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_start( array $data ): array {
		if ( ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' ) ) {
			return [
				'success' => false,
				'error'   => __( 'A database upgrade is currently running in the background. Please wait for it to complete before exporting.', 'burst-statistics' ),
			];
		}

		$format = sanitize_text_field( (string) ( $data['format'] ?? 'sql.gz' ) );
		return $this->create_export_session( $format, false );
	}

	/**
	 * Handle export_chunk action — receives $data directly from burst_do_action.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_chunk( array $data ): array {
		$export_id = sanitize_text_field( (string) ( $data['export_id'] ?? '' ) );
		if ( empty( $export_id ) ) {
			$export_id = (string) get_transient( 'burst_active_export_id' );
		}
		if ( ! empty( $export_id ) ) {
			set_transient( 'burst_ui_export_active_' . $export_id, time(), 30 );
		}
		return $this->process_export_chunk( $export_id, 2.0 );
	}

	/**
	 * Handle export_pause action — receives $data directly from burst_do_action.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_pause( array $data ): array {
		$export_id = sanitize_text_field( (string) ( $data['export_id'] ?? '' ) );
		if ( empty( $export_id ) ) {
			$export_id = (string) get_transient( 'burst_active_export_id' );
		}

		if ( ! empty( $export_id ) && ! preg_match( '/^[a-zA-Z0-9_-]+$/', $export_id ) ) {
			return [
				'success' => false,
				'error'   => __( 'Invalid export ID.', 'burst-statistics' ),
			];
		}

		if ( ! empty( $export_id ) ) {
			$session = get_transient( 'burst_export_session_' . $export_id );
			if ( is_array( $session ) && 'completed' !== $session['status'] ) {
				$session['status'] = 'paused';
				set_transient( 'burst_export_session_' . $export_id, $session, self::SESSION_TTL );
			}
		}

		return [
			'success' => true,
			'status'  => 'paused',
			'message' => __( 'Export session paused.', 'burst-statistics' ),
		];
	}

	/**
	 * Handle export_cancel action — receives $data directly from burst_do_action.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_cancel( array $data ): array {
		$export_id = sanitize_text_field( (string) ( $data['export_id'] ?? '' ) );
		if ( empty( $export_id ) ) {
			$export_id = (string) get_transient( 'burst_active_export_id' );
		}

		if ( ! empty( $export_id ) && ! preg_match( '/^[a-zA-Z0-9_-]+$/', $export_id ) ) {
			return [
				'success' => false,
				'error'   => __( 'Invalid export ID.', 'burst-statistics' ),
			];
		}

		if ( ! empty( $export_id ) ) {
			$session = get_transient( 'burst_export_session_' . $export_id );
			if ( is_array( $session ) && ! empty( $session['file_path'] ) && file_exists( $session['file_path'] ) ) {
				wp_delete_file( $session['file_path'] );
			}
			$this->delete_export_files( $export_id );
			delete_transient( 'burst_export_session_' . $export_id );
			if ( get_transient( 'burst_active_export_id' ) === $export_id ) {
				delete_transient( 'burst_active_export_id' );
			}
		}

		return [
			'success' => true,
			'message' => __( 'Export session cancelled and discarded.', 'burst-statistics' ),
		];
	}

	/**
	 * Handle export_save_schedule action — receives $data directly from burst_do_action.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_save_schedule( array $data ): array {
		$enabled         = (bool) ( $data['enabled'] ?? false );
		$frequency       = sanitize_text_field( (string) ( $data['frequency'] ?? 'weekly' ) );
		$retention_count = max( 1, min( 50, (int) ( $data['retention_count'] ?? 5 ) ) );

		if ( ! in_array( $frequency, [ 'daily', 'weekly', 'monthly' ], true ) ) {
			$frequency = 'weekly';
		}

		$existing = get_option( 'burst_export_schedule', [] );
		if ( ! is_array( $existing ) ) {
			$existing = [];
		}

		$updated = array_merge(
			$existing,
			[
				'enabled'         => $enabled,
				'frequency'       => $frequency,
				'retention_count' => $retention_count,
			]
		);

		update_option( 'burst_export_schedule', $updated, false );

		return [
			'success'        => true,
			'message'        => __( 'Export schedule saved successfully.', 'burst-statistics' ),
			'schedule'       => $updated,
			'next_scheduled' => $this->calculate_next_scheduled( $updated ),
		];
	}

	/**
	 * Handle export_delete action — receives $data directly from burst_do_action.
	 *
	 * The client always sends the history key as export_id, so we look up by key only.
	 *
	 * @param array<string, mixed> $data Action data.
	 * @return array<string, mixed>
	 */
	private function handle_export_delete( array $data ): array {
		$export_id = sanitize_text_field( (string) ( $data['export_id'] ?? '' ) );
		$clean_id  = preg_replace( '/\.(sql\.gz|sql|zip)$/i', '', $export_id );
		if ( empty( $clean_id ) || ! preg_match( '/^[a-zA-Z0-9_-]+$/', $clean_id ) ) {
			return [
				'success' => false,
				'error'   => __( 'Invalid export ID', 'burst-statistics' ),
			];
		}

		$this->delete_export_files( $clean_id );
		clearstatcache();

		delete_transient( 'burst_export_session_' . $clean_id );
		if ( get_transient( 'burst_active_export_id' ) === $clean_id ) {
			delete_transient( 'burst_active_export_id' );
		}

		return [
			'success' => true,
			'message' => __( 'Export deleted successfully.', 'burst-statistics' ),
		];
	}

	/**
	 * Delete all export files for a given export ID (.sql.gz, .sql, .zip).
	 *
	 * Centralises the .sql.gz/.sql/.zip unlink triple that was previously
	 * duplicated in rest_export_cancel, rest_export_delete, and cleanup_old_exports.
	 *
	 * @param string $export_id Export ID or filename.
	 */
	private function delete_export_files( string $export_id ): void {
		$clean_id = preg_replace( '/\.(sql\.gz|sql|zip)$/i', '', $export_id );
		$clean_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $clean_id );
		if ( empty( $clean_id ) ) {
			return;
		}

		$dir = $this->get_export_dir();
		foreach ( [ '.sql.gz', '.sql', '.zip' ] as $ext ) {
			$file = $dir . $clean_id . $ext;
			if ( file_exists( $file ) ) {
				wp_delete_file( $file );
			}
		}
	}


	/**
	 * Intercept burst_get_action for export status.
	 *
	 * @param array<string, mixed> $output Existing output.
	 * @param string               $action Action name.
	 * @return array<string, mixed>
	 */
	public function get_rest_action( array $output, string $action ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		if ( 'export_status' === $action ) {
			$res = $this->rest_export_status();
			return array_merge( $output, (array) $res->get_data() );
		}

		return $output;
	}

	/**
	 * Get sandbox exports directory.
	 *
	 * @return string Absolute directory path.
	 */
	public function get_export_dir(): string {
		$hash = get_option( 'burst_export_dir_hash', '' );
		if ( empty( $hash ) ) {
			$hash = bin2hex( random_bytes( 16 ) );
			update_option( 'burst_export_dir_hash', $hash, false );
		}

		// Created and hardened (index.php + .htaccess) by the shared helper.
		return $this->upload_dir( 'exports/' . $hash );
	}

	/**
	 * Discover all Burst tables in the database with primary key inspection.
	 *
	 * @param bool $exact Whether to run exact COUNT(*) queries or use TABLE_ROWS estimates.
	 * @return array<int, array{name: string, short_name: string, rows: int, primary_key: ?string}>
	 */
	public function discover_tables( bool $exact = false ): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$statuses = $wpdb->get_results(
			$wpdb->prepare(
				'SHOW TABLE STATUS LIKE %s',
				$wpdb->esc_like( $wpdb->prefix . 'burst_' ) . '%'
			),
			ARRAY_A
		);

		if ( empty( $statuses ) ) {
			return [];
		}

		$tables = [];

		foreach ( $statuses as $st ) {
			$table_name = (string) ( $st['Name'] ?? '' );
			if ( empty( $table_name ) ) {
				continue;
			}

			$short_name = substr( $table_name, strlen( $wpdb->prefix ) );
			if ( 'burst_imports' === $short_name ) {
				continue;
			}

			// Find primary key.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$keys = $wpdb->get_results( "SHOW KEYS FROM `{$table_name}` WHERE Key_name = 'PRIMARY'", ARRAY_A );
			$pk   = null;

			if ( ! empty( $keys ) && 1 === count( $keys ) ) {
				$candidate_pk = $keys[0]['Column_name'] ?? null;
				if ( $candidate_pk ) {
					// Verify candidate PK is an integer type (UpdraftPlus optimization).
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$col_info = $wpdb->get_row( "SHOW COLUMNS FROM `{$table_name}` LIKE '{$candidate_pk}'", ARRAY_A );
					$type     = strtolower( (string) ( $col_info['Type'] ?? '' ) );
					if ( preg_match( '/^(small|medium|big)?int/i', $type ) ) {
						$pk = $candidate_pk;
					}
				}
			}

			// Get estimated or exact row count.
			if ( $exact ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$row_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$table_name}`" );
			} else {
				$row_count = (int) ( $st['Rows'] ?? 0 );
			}

			$tables[] = [
				'name'         => $table_name,
				'short_name'   => $short_name,
				'rows'         => $row_count,
				'primary_key'  => $pk,
				'data_length'  => (int) ( $st['Data_length'] ?? 0 ),
				'index_length' => (int) ( $st['Index_length'] ?? 0 ),
			];
		}

		// Sort tables: Dimension/auxiliary tables first, fact/stats tables last.
		usort(
			$tables,
			function ( array $a, array $b ): int {
				$priority = [
					'burst_goals'                          => 10,
					'burst_locations'                      => 20,
					'burst_browsers'                       => 30,
					'burst_browser_versions'               => 40,
					'burst_platforms'                      => 50,
					'burst_devices'                        => 60,
					'burst_referrers'                      => 70,
					'burst_forms'                          => 80,
					'burst_external_links'                 => 90,
					'burst_sessions'                       => 150,
					'burst_statistics'                     => 200,
					'burst_goal_statistics'                => 210,
					'burst_statistics_searches'            => 220,
					'burst_statistics_external_links'      => 230,
					'burst_search_console_page_terms'      => 240,
					'burst_search_console_diagnostic_logs' => 250,
				];

				$prio_a = $priority[ $a['short_name'] ] ?? 100;
				$prio_b = $priority[ $b['short_name'] ] ?? 100;

				return $prio_a <=> $prio_b;
			}
		);

		return $tables;
	}

	/**
	 * REST: Export status and database summary.
	 */
	public function rest_export_status(): WP_REST_Response {
		$tables = $this->discover_tables( false );

		$total_rows  = 0;
		$total_bytes = 0;

		foreach ( $tables as $t ) {
			$total_rows  += (int) $t['rows'];
			$total_bytes += ( (int) ( $t['data_length'] ?? 0 ) + (int) ( $t['index_length'] ?? 0 ) );
		}

		// Approximate compressed archive download sizes.
		// Stream-dumped SQL text tables compressed with gzip achieve ~92-95% compression relative to MySQL footprint (~6% of total_bytes).
		// Standard ZIP Deflate archives achieve ~90-93% compression (~8% of total_bytes).
		$estimated_gz_bytes  = ( $total_bytes > 0 && $total_rows > 0 ) ? max( 1024, (int) round( $total_bytes * 0.06 ) ) : 0;
		$estimated_zip_bytes = ( $total_bytes > 0 && $total_rows > 0 ) ? max( 1024, (int) round( $total_bytes * 0.08 ) ) : 0;

		$active_id     = get_transient( 'burst_active_export_id' );
		$active_export = null;
		if ( $active_id ) {
			$active_export = get_transient( 'burst_export_session_' . $active_id );
		}

		$formatted_history = $this->list_exports();

		$schedule = get_option(
			'burst_export_schedule',
			[
				'enabled'         => false,
				'frequency'       => 'weekly',
				'retention_count' => 5,
				'last_run'        => null,
				'last_status'     => null,
			]
		);
		if ( ! is_array( $schedule ) ) {
			$schedule = [
				'enabled'         => false,
				'frequency'       => 'weekly',
				'retention_count' => 5,
				'last_run'        => null,
				'last_status'     => null,
			];
		}

		$next_scheduled = $this->calculate_next_scheduled( $schedule );

		return new WP_REST_Response(
			[
				'success'             => true,
				'tables_count'        => count( $tables ),
				'total_rows'          => $total_rows,
				'estimated_size'      => size_format( $total_bytes, 1 ),
				'estimated_bytes'     => $total_bytes,
				'estimated_gz_size'   => $estimated_gz_bytes > 0 ? size_format( $estimated_gz_bytes, 1 ) : '0 MB',
				'estimated_gz_bytes'  => $estimated_gz_bytes,
				'estimated_zip_size'  => $estimated_zip_bytes > 0 ? size_format( $estimated_zip_bytes, 1 ) : '0 MB',
				'estimated_zip_bytes' => $estimated_zip_bytes,
				'active_export'       => $active_export,
				'history'             => $formatted_history,
				'schedule'            => $schedule,
				'next_scheduled'      => $next_scheduled,
				'gzip_supported'      => function_exists( 'gzopen' ),
				'zip_supported'       => class_exists( 'ZipArchive' ),
				'upgrade_running'     => ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' ),
			],
			200
		);
	}

	/**
	 * Initialize a new export session.
	 *
	 * The export holds the statistics tables only. wp_options is never part
	 * of it: the importer does not restore options, and the burst_ options
	 * hold secrets (share tokens, license data, API tokens, the export
	 * directory hash) that must not travel with a backup file.
	 *
	 * The row total is the information_schema TABLE_ROWS estimate, never an
	 * exact COUNT(*): this runs inside the REST request that starts the export
	 * and a COUNT(*) over every Burst table is a full index scan per table on
	 * InnoDB. The estimate only drives the progress percentage (capped at 99
	 * until done); on completion the rows actually written replace it, both in
	 * the session and in the file's '-- Rows:' header.
	 *
	 * @param string $format Format ('sql.gz' or 'zip').
	 * @param bool   $is_scheduled Whether this is an automated scheduled export.
	 * @return array<string, mixed> Session initialization data.
	 */
	public function create_export_session( string $format = 'sql.gz', bool $is_scheduled = false ): array {
		if ( ! in_array( $format, [ 'sql.gz', 'zip' ], true ) ) {
			$format = function_exists( 'gzopen' ) ? 'sql.gz' : 'zip';
		}

		$prefix    = $is_scheduled ? 'burst_export_sched_' : 'burst_export_';
		$export_id = $prefix . gmdate( 'Y_m_d_His' ) . '_' . wp_generate_password( 6, false, false );
		$dir       = $this->get_export_dir();

		// Target file.
		$is_gz     = 'sql.gz' === $format && function_exists( 'gzopen' );
		$file_ext  = $is_gz ? 'sql.gz' : 'sql';
		$file_path = $dir . $export_id . '.' . $file_ext;

		$tables     = $this->discover_tables( false );
		$total_rows = 0;
		foreach ( $tables as $t ) {
			$total_rows += (int) $t['rows'];
		}

		// Working file is uncompressed SQL during chunk processing to avoid multi-member gz stream corruption.
		$working_file = $dir . $export_id . '.sql';

		// Initialize working file and write SQL preamble.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $working_file, 'wb' );
		if ( ! $handle ) {
			return [
				'success' => false,
				'error'   => __( 'Unable to create export file in uploads folder.', 'burst-statistics' ),
			];
		}

		$site_url = site_url();
		$wp_ver   = get_bloginfo( 'version' );
		$date_utc = gmdate( 'Y-m-d H:i:s' ) . ' UTC';

		$preamble  = "-- -------------------------------------------------------------\n";
		$preamble .= "-- Burst Statistics Complete Database Export\n";
		$preamble .= "-- Generated: {$date_utc}\n";
		$preamble .= '-- Tables: ' . count( $tables ) . "\n";
		$preamble .= '-- Table-List: ' . implode( ', ', array_column( $tables, 'name' ) ) . "\n";
		// Fixed-width so the final count can be patched in place on completion.
		$rows_offset = strlen( $preamble ) + strlen( '-- Rows: ' );
		$preamble   .= '-- Rows: ' . self::pad_row_count( $total_rows ) . "\n";
		$preamble   .= "-- Estimated Rows: {$total_rows}\n";
		$preamble   .= "-- Site URL: {$site_url}\n";
		$preamble   .= "-- WordPress: {$wp_ver}\n";
		$preamble   .= "-- -------------------------------------------------------------\n\n";

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
		fwrite( $handle, $preamble );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		$filename = basename( $file_path );

		$session = [
			'export_id'         => $export_id,
			'format'            => $format,
			'is_gz'             => $is_gz,
			'file_path'         => $file_path,
			'working_file'      => $working_file,
			'filename'          => $filename,
			'tables'            => $tables,
			'current_table_idx' => 0,
			'table_started'     => false,
			'watermark'         => null,
			'offset'            => 0,
			'total_rows'        => $total_rows,
			'rows_offset'       => $rows_offset,
			'processed_rows'    => 0,
			'status'            => 'running',
			'created_at'        => time(),
		];

		set_transient( 'burst_export_session_' . $export_id, $session, self::SESSION_TTL );
		set_transient( 'burst_active_export_id', $export_id, self::SESSION_TTL );

		return [
			'success'        => true,
			'export_id'      => $export_id,
			'status'         => 'running',
			'progress'       => 0,
			'current_table'  => $tables[0]['name'] ?? '',
			'processed_rows' => 0,
			'total_rows'     => $total_rows,
			'filename'       => $filename,
		];
	}



	/**
	 * A row count padded to ROW_COUNT_WIDTH so the header line keeps its byte
	 * length when the estimate is replaced by the final count.
	 */
	private static function pad_row_count( int $rows ): string {
		return str_pad( (string) $rows, self::ROW_COUNT_WIDTH );
	}

	/**
	 * Overwrite the '-- Rows:' estimate in the working file's header with the
	 * number of rows actually written, in place, before the file is compressed.
	 * A session created before the field was padded has no offset and is left
	 * as it is.
	 *
	 * @param string $working_file Uncompressed SQL working file.
	 * @param int    $offset       Byte offset of the count within the header.
	 * @param int    $rows         Rows actually written.
	 */
	private function write_final_row_count( string $working_file, int $offset, int $rows ): void {
		if ( $offset <= 0 || ! file_exists( $working_file ) ) {
			return;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $working_file, 'r+b' );
		if ( false === $handle ) {
			return;
		}
		if ( 0 === fseek( $handle, $offset ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
			fwrite( $handle, self::pad_row_count( $rows ) );
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );
	}

	/**
	 * Process a single batch chunk of rows for an export session.
	 *
	 * @param string $export_id Export ID.
	 * @param float  $max_chunk_time Max execution time in seconds for this chunk.
	 * @return array<string, mixed> Result data.
	 */
	public function process_export_chunk( string $export_id, float $max_chunk_time = 2.0 ): array {
		global $wpdb;

		if ( empty( $export_id ) ) {
			$export_id = (string) get_transient( 'burst_active_export_id' );
		}

		if ( empty( $export_id ) || ! preg_match( '/^[a-zA-Z0-9_-]+$/', $export_id ) ) {
			return [
				'success' => false,
				'error'   => __( 'Invalid export ID.', 'burst-statistics' ),
			];
		}

		$session = get_transient( 'burst_export_session_' . $export_id );
		if ( ! is_array( $session ) ) {
			return [
				'success' => false,
				'error'   => __( 'Export session expired or not found.', 'burst-statistics' ),
			];
		}

		if ( 'completed' === $session['status'] ) {
			return [
				'success'        => true,
				'export_id'      => $export_id,
				'status'         => 'completed',
				'progress'       => 100,
				'processed_rows' => $session['processed_rows'],
				'total_rows'     => $session['total_rows'],
				'download_url'   => $this->get_download_url( $export_id ),
				'file_size'      => file_exists( $session['file_path'] ) ? size_format( (int) filesize( $session['file_path'] ), 1 ) : '',
				'filename'       => basename( $session['file_path'] ),
			];
		}

		// Atomic mutex lock using add_option (NX semantics).
		$lock_key = 'burst_export_lock_' . $export_id;
		$now      = time();
		$acquired = add_option( $lock_key, $now, '', false );

		if ( ! $acquired ) {
			$lock_time = (int) get_option( $lock_key, 0 );
			if ( ( $now - $lock_time ) > 60 ) {
				delete_option( $lock_key );
				$acquired = add_option( $lock_key, $now, '', false );
			}
		}

		if ( ! $acquired ) {
			return [
				'success'        => false,
				'retry'          => true,
				'error'          => __( 'Export chunk is currently locked by another worker.', 'burst-statistics' ),
				'status'         => $session['status'] ?? 'running',
				'progress'       => min( 99, (int) round( ( ( $session['processed_rows'] ?? 0 ) / max( 1, (int) ( $session['total_rows'] ?? 1 ) ) ) * 100 ) ),
				'current_table'  => $session['tables'][ $session['current_table_idx'] ]['name'] ?? '',
				'processed_rows' => $session['processed_rows'] ?? 0,
				'total_rows'     => $session['total_rows'] ?? 0,
				'export_id'      => $export_id,
			];
		}

		$handle = null;
		try {
			// Re-fetch latest session state inside lock in case previous worker updated it.
			$latest_session = get_transient( 'burst_export_session_' . $export_id );
			if ( is_array( $latest_session ) ) {
				$session = $latest_session;
			}

			if ( 'completed' === $session['status'] ) {
				return [
					'success'        => true,
					'export_id'      => $export_id,
					'status'         => 'completed',
					'progress'       => 100,
					'processed_rows' => $session['processed_rows'],
					'total_rows'     => $session['total_rows'],
					'download_url'   => $this->get_download_url( $export_id ),
					'file_size'      => file_exists( $session['file_path'] ) ? size_format( (int) filesize( $session['file_path'] ), 1 ) : '',
					'filename'       => basename( $session['file_path'] ),
				];
			}

			// Ensure status is marked running while processing.
			$session['status'] = 'running';

			$working_file = $session['working_file'] ?? ( $this->get_export_dir() . $export_id . '.sql' );

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			$handle = fopen( $working_file, 'ab' );
			if ( ! $handle ) {
				return [
					'success' => false,
					'error'   => __( 'Could not open export file for appending.', 'burst-statistics' ),
				];
			}

			$start_time      = microtime( true );
			$chunk_rows_done = 0;
			$tables          = $session['tables'];
			$tables_count    = count( $tables );

			while ( (int) $session['current_table_idx'] < $tables_count ) {
				$current_table_idx = (int) $session['current_table_idx'];
				$table_info        = $tables[ $current_table_idx ];
				$table_name        = $table_info['name'];
				$pk                = $table_info['primary_key'];

				// 1. Write section header if table just started.
				if ( empty( $session['table_started'] ) ) {
					$table_head  = "\n-- -------------------------------------------------------------\n";
					$table_head .= "-- Table data for `{$table_name}`\n";
					$table_head .= "-- -------------------------------------------------------------\n";

					$this->write_to_stream( $handle, $table_head, false );
					$session['table_started'] = true;
				}

				// 2. Keyset or offset pagination.
				$watermark = $session['watermark'] ?? null;
				$offset    = (int) ( $session['offset'] ?? 0 );
				$limit     = self::CHUNK_ROW_LIMIT;

				if ( $pk ) {
					if ( null === $watermark ) {
						// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						$query = $wpdb->prepare( "SELECT * FROM `{$table_name}` ORDER BY `{$pk}` ASC LIMIT %d", $limit );
					} else {
						// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
						$query = $wpdb->prepare( "SELECT * FROM `{$table_name}` WHERE `{$pk}` > %d ORDER BY `{$pk}` ASC LIMIT %d", (int) $watermark, $limit );
					}
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
					$rows = $wpdb->get_results( $query, ARRAY_A );
				} else {
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$query = $wpdb->prepare( "SELECT * FROM `{$table_name}` LIMIT %d, %d", $offset, $limit );
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
					$rows = $wpdb->get_results( $query, ARRAY_A );
				}

				$count_fetched = is_array( $rows ) ? count( $rows ) : 0;

				if ( $count_fetched > 0 ) {
					$batches = array_chunk( $rows, self::ROWS_PER_INSERT );
					foreach ( $batches as $batch ) {
						$insert_sql = $this->build_insert_statement( $table_name, $batch );
						$this->write_to_stream( $handle, $insert_sql, false );
					}

					if ( $pk ) {
						$last_row             = end( $rows );
						$session['watermark'] = (int) ( $last_row[ $pk ] ?? $watermark );
					} else {
						$session['offset'] += $count_fetched;
					}

					$session['processed_rows'] += $count_fetched;
					$chunk_rows_done           += $count_fetched;
					unset( $rows, $batches );
				}

				if ( $count_fetched < $limit ) {
					$this->write_to_stream( $handle, "\n", false );
					++$session['current_table_idx'];
					$session['table_started'] = false;
					$session['watermark']     = null;
					$session['offset']        = 0;
				}

				if ( $chunk_rows_done >= self::CHUNK_ROW_LIMIT || ( microtime( true ) - $start_time ) >= $max_chunk_time ) {
					break;
				}
			}

			// 4. Check completion.
			if ( $session['current_table_idx'] >= count( $tables ) ) {
				$footer  = "\n-- -------------------------------------------------------------\n";
				$footer .= "-- Dump completed\n";
				$footer .= "-- -------------------------------------------------------------\n";
				$this->write_to_stream( $handle, $footer, false );

				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $handle );
				$handle = null;

				// The session total was an estimate; the rows written are the truth.
				$session['total_rows'] = (int) $session['processed_rows'];
				$this->write_final_row_count( $working_file, (int) ( $session['rows_offset'] ?? 0 ), $session['total_rows'] );

				$final_path = $working_file;
				if ( ! empty( $session['is_gz'] ) && function_exists( 'gzopen' ) ) {
					$gz_path = substr( $working_file, 0, -4 ) . '.sql.gz';
					// Stream-compress the uncompressed SQL file into a clean single gzip stream.
					// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
					$in_handle = fopen( $working_file, 'rb' );
					$gz_handle = gzopen( $gz_path, 'wb9' );
					if ( $in_handle && $gz_handle ) {
						while ( ! feof( $in_handle ) ) {
							// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
							$chunk_data = fread( $in_handle, 65536 );
							if ( false !== $chunk_data && '' !== $chunk_data ) {
								gzwrite( $gz_handle, $chunk_data );
							}
						}
						// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
						fclose( $in_handle );
						gzclose( $gz_handle );
						wp_delete_file( $working_file );
						$final_path = $gz_path;
					}
				} elseif ( 'zip' === $session['format'] && class_exists( 'ZipArchive' ) ) {
					$zip_path = substr( $working_file, 0, -4 ) . '.zip';
					$zip      = new ZipArchive();
					if ( true === $zip->open( $zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
						$zip->addFile( $working_file, basename( $working_file ) );
						$zip->close();
						wp_delete_file( $working_file );
						$final_path = $zip_path;
					}
				}

				$session['file_path'] = $final_path;
				$session['filename']  = basename( $final_path );
				$session['status']    = 'completed';
				$session['progress']  = 100;

				delete_transient( 'burst_active_export_id' );
				set_transient( 'burst_export_session_' . $export_id, $session, self::SESSION_TTL );

				$this->cleanup_old_exports();

				return [
					'success'        => true,
					'export_id'      => $export_id,
					'status'         => 'completed',
					'progress'       => 100,
					'current_table'  => '',
					'processed_rows' => $session['processed_rows'],
					'total_rows'     => $session['total_rows'],
					'download_url'   => $this->get_download_url( $export_id ),
					'file_size'      => file_exists( $final_path ) ? size_format( (int) filesize( $final_path ), 1 ) : '',
					'filename'       => basename( $final_path ),
				];
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $handle );
			$handle = null;

			$total_rows   = max( 1, (int) $session['total_rows'] );
			$progress_pct = min( 99, (int) round( ( $session['processed_rows'] / $total_rows ) * 100 ) );
			$next_table   = $tables[ $session['current_table_idx'] ]['name'] ?? '';

			set_transient( 'burst_export_session_' . $export_id, $session, self::SESSION_TTL );

			return [
				'success'        => true,
				'export_id'      => $export_id,
				'status'         => 'running',
				'progress'       => $progress_pct,
				'current_table'  => $next_table,
				'processed_rows' => $session['processed_rows'],
				'total_rows'     => $session['total_rows'],
				'filename'       => $session['filename'] ?? basename( $session['file_path'] ),
			];
		} finally {
			if ( is_resource( $handle ) ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $handle );
			}
			delete_option( $lock_key );
		}
	}



	/**
	 * Calculate next scheduled export timestamp based on schedule settings and WordPress cron.
	 *
	 * @param array<string, mixed> $schedule Schedule configuration.
	 * @return int|null Next run timestamp or null if disabled.
	 */
	public function calculate_next_scheduled( array $schedule ): ?int {
		if ( empty( $schedule['enabled'] ) ) {
			return null;
		}

		$freq      = $schedule['frequency'] ?? 'weekly';
		$last_run  = (int) ( $schedule['last_run'] ?? 0 );
		$intervals = [
			'daily'   => DAY_IN_SECONDS,
			'weekly'  => WEEK_IN_SECONDS,
			'monthly' => 30 * DAY_IN_SECONDS,
		];
		$interval  = $intervals[ $freq ] ?? WEEK_IN_SECONDS;

		// WordPress cron schedule for burst_daily.
		$next_cron = (int) wp_next_scheduled( 'burst_daily' );
		if ( 0 === $next_cron ) {
			$next_cron = time() + DAY_IN_SECONDS;
		}

		if ( $last_run > 0 ) {
			$target_time = $last_run + $interval;
			if ( $target_time <= time() ) {
				return $next_cron;
			}
			return max( $target_time, $next_cron );
		}

		return $next_cron;
	}

	/**
	 * Evaluate and execute automated scheduled exports on cron hit.
	 */
	public function maybe_run_scheduled_export(): void {
		if ( ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' ) ) {
			return;
		}

		$schedule = get_option( 'burst_export_schedule', [] );
		if ( empty( $schedule ) || empty( $schedule['enabled'] ) ) {
			return;
		}

		// Don't interrupt an existing active export session.
		if ( get_transient( 'burst_active_export_id' ) ) {
			return;
		}

		$freq      = $schedule['frequency'] ?? 'weekly';
		$last_run  = (int) ( $schedule['last_run'] ?? 0 );
		$intervals = [
			'daily'   => DAY_IN_SECONDS,
			'weekly'  => WEEK_IN_SECONDS,
			'monthly' => 30 * DAY_IN_SECONDS,
		];

		$interval = $intervals[ $freq ] ?? WEEK_IN_SECONDS;

		// Check if time has elapsed since last run.
		if ( ( time() - $last_run ) < $interval ) {
			return;
		}

		$session_res = $this->create_export_session( 'sql.gz', true );

		if ( ! empty( $session_res['success'] ) && ! empty( $session_res['export_id'] ) ) {
			$schedule['last_run']    = time();
			$schedule['last_status'] = 'running';
			update_option( 'burst_export_schedule', $schedule, false );

			wp_schedule_single_event( time() + 1, 'burst_export_cron_iteration', [ $session_res['export_id'] ] );
			if ( function_exists( 'spawn_cron' ) ) {
				spawn_cron();
			}
		}
	}

	/**
	 * Background cron chunk runner.
	 *
	 * @param string $export_id Export ID.
	 */
	public function run_cron_iteration( string $export_id = '' ): void {
		if ( empty( $export_id ) ) {
			$export_id = (string) get_transient( 'burst_active_export_id' );
		}

		if ( empty( $export_id ) ) {
			return;
		}

		// If UI export loop is actively driving this export, defer cron execution to prevent competition.
		if ( get_transient( 'burst_ui_export_active_' . $export_id ) ) {
			if ( ! wp_next_scheduled( 'burst_export_cron_iteration', [ $export_id ] ) ) {
				wp_schedule_single_event( time() + 15, 'burst_export_cron_iteration', [ $export_id ] );
			}
			return;
		}

		$result = $this->process_export_chunk( $export_id, 2.5 );

		$schedule = get_option( 'burst_export_schedule', [] );

		if ( ! empty( $result['status'] ) && 'completed' === $result['status'] ) {
			if ( is_array( $schedule ) ) {
				$schedule['last_completed'] = time();
				$schedule['last_status']    = 'completed';
				update_option( 'burst_export_schedule', $schedule, false );
			}
			$this->cleanup_old_exports();
			return;
		}

		if ( ! empty( $result['status'] ) && 'running' === $result['status'] ) {
			// Schedule next iteration in 2 seconds.
			if ( ! wp_next_scheduled( 'burst_export_cron_iteration', [ $export_id ] ) ) {
				wp_schedule_single_event( time() + 2, 'burst_export_cron_iteration', [ $export_id ] );
			}
			if ( function_exists( 'spawn_cron' ) ) {
				spawn_cron();
			}
		}
	}

	/**
	 * Build multi-row INSERT statement.
	 *
	 * @param string                           $table Table name.
	 * @param array<int, array<string, mixed>> $rows  Rows.
	 * @return string SQL statement.
	 */
	private function build_insert_statement( string $table, array $rows ): string {
		global $wpdb;

		if ( empty( $rows ) ) {
			return '';
		}

		$first_row = reset( $rows );
		$columns   = array_keys( $first_row );
		$col_list  = '`' . implode( '`, `', $columns ) . '`';

		$sql = "INSERT INTO `{$table}` ({$col_list}) VALUES\n";

		$value_rows = [];
		foreach ( $rows as $row ) {
			$escaped_values = [];
			foreach ( $columns as $col ) {
				$val = $row[ $col ] ?? null;
				if ( null === $val ) {
					$escaped_values[] = 'NULL';
				} elseif ( is_numeric( $val ) && ! is_string( $val ) ) {
					$escaped_values[] = $val;
				} else {
					$escaped_values[] = "'" . $wpdb->_real_escape( (string) $val ) . "'";
				}
			}
			$value_rows[] = '(' . implode( ', ', $escaped_values ) . ')';
		}

		$sql .= implode( ",\n", $value_rows ) . ";\n";

		return $sql;
	}

	/**
	 * Write content to stream handle.
	 *
	 * @param resource $handle Handle.
	 * @param string   $data   Data.
	 * @param bool     $is_gz  Is gzip.
	 */
	private function write_to_stream( $handle, string $data, bool $is_gz ): void {
		if ( $is_gz ) {
			gzwrite( $handle, $data );
		} else {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
			fwrite( $handle, $data );
		}
	}

	/**
	 * Read preview header chunk from export file (.sql.gz, .sql, .zip).
	 *
	 * @param string $file_path File path.
	 * @param int    $bytes     Bytes to read.
	 */
	private function read_export_header( string $file_path, int $bytes = 1024 ): string {
		$filename = strtolower( basename( $file_path ) );

		if ( ( str_ends_with( $filename, '.sql.gz' ) || str_ends_with( $filename, '.gz' ) ) && function_exists( 'gzopen' ) ) {
			$gz = gzopen( $file_path, 'rb' );
			if ( false === $gz ) {
				return '';
			}
			$content = gzread( $gz, $bytes );
			gzclose( $gz );
			return is_string( $content ) ? $content : '';
		}

		if ( str_ends_with( $filename, '.zip' ) && class_exists( 'ZipArchive' ) ) {
			$zip = new \ZipArchive();
			if ( true === $zip->open( $file_path ) ) {
				$entry_name = $zip->getNameIndex( 0 );
				if ( false !== $entry_name ) {
					$stream = $zip->getStream( $entry_name );
					if ( false !== $stream ) {
						// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
						$content = fread( $stream, $bytes );
						// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
						fclose( $stream );
						$zip->close();
						return is_string( $content ) ? $content : '';
					}
				}
				$zip->close();
			}
			return '';
		}

		if ( str_ends_with( $filename, '.sql' ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			$handle = fopen( $file_path, 'rb' );
			if ( false === $handle ) {
				return '';
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
			$content = fread( $handle, $bytes );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $handle );
			return is_string( $content ) ? $content : '';
		}

		return '';
	}

	/**
	 * List all available export archives on disk.
	 *
	 * Follows the Archive_Pro::get_archives_data() pattern: treats the directory
	 * as the single source of truth, avoiding option-to-filesystem drift.
	 *
	 * @return array<int, array{
	 *     id: string,
	 *     filename: string,
	 *     bytes: int,
	 *     size: string,
	 *     tables: int,
	 *     rows: int,
	 *     created_at: int,
	 *     download_url: string
	 * }>
	 */
	public function list_exports(): array {
		$dir = $this->get_export_dir();
		if ( ! is_dir( $dir ) ) {
			return [];
		}

		$files = scandir( $dir );
		if ( false === $files ) {
			return [];
		}

		$exports = [];
		foreach ( $files as $file ) {
			if ( in_array( $file, [ '.', '..', '.htaccess', 'index.php' ], true ) ) {
				continue;
			}

			if ( ! preg_match( '/\.(sql\.gz|sql|zip)$/i', $file ) ) {
				continue;
			}

			$full_path = $dir . $file;
			if ( ! is_file( $full_path ) ) {
				continue;
			}

			$bytes      = (int) filesize( $full_path );
			$created_at = (int) filemtime( $full_path );
			$id         = (string) preg_replace( '/\.(sql\.gz|sql|zip)$/i', '', $file );

			// Read first kilobyte to parse table and row counts from the SQL preamble.
			$header = $this->read_export_header( $full_path, 1024 );
			$tables = 0;
			$rows   = 0;
			if ( ! empty( $header ) ) {
				if ( preg_match( '/-- Tables:\s*(\d+)/i', $header, $tbl_match ) ) {
					$tables = (int) $tbl_match[1];
				} elseif ( preg_match( '/-- Tables:\s*([^\r\n]+)/i', $header, $tbl_match ) ) {
					$table_list = trim( $tbl_match[1] );
					$tables     = ! empty( $table_list ) ? count( array_filter( array_map( 'trim', explode( ',', $table_list ) ), static fn( string $tbl ): bool => '' !== $tbl ) ) : 0;
				}
				if ( preg_match( '/-- (?:Estimated )?Rows:\s*(\d+)/i', $header, $row_match ) ) {
					$rows = (int) $row_match[1];
				}
			}

			$exports[] = [
				'id'           => $id,
				'filename'     => $file,
				'bytes'        => $bytes,
				'size'         => $bytes > 0 ? size_format( $bytes, 1 ) : '0 B',
				'tables'       => $tables,
				'rows'         => $rows,
				'created_at'   => $created_at,
				'download_url' => $this->get_download_url( $id ),
			];
		}

		usort(
			$exports,
			static function ( array $a, array $b ): int {
				return $b['created_at'] <=> $a['created_at'];
			}
		);

		return $exports;
	}

	/**
	 * Generate authenticated download URL.
	 *
	 * Uses admin-post.php with an export-specific nonce for direct,
	 * reliable browser streaming that avoids REST API payload handling.
	 *
	 * @param string $export_id Export ID.
	 * @return string URL.
	 */
	public function get_download_url( string $export_id ): string {
		return admin_url( 'admin-post.php?action=burst_export_download&export_id=' . rawurlencode( $export_id ) . '&_wpnonce=' . wp_create_nonce( 'burst_export_download_' . $export_id ) );
	}

	/**
	 * Handle admin-post download request.
	 */
	public function handle_admin_download(): void {
		if ( ! $this->user_can_manage() ) {
			wp_die( esc_html__( 'Unauthorized access.', 'burst-statistics' ), 403 );
		}

		$export_id = isset( $_GET['export_id'] ) ? sanitize_text_field( wp_unslash( $_GET['export_id'] ) ) : '';
		$nonce     = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';

		if ( empty( $export_id ) || ! preg_match( '/^[a-zA-Z0-9_.-]+$/', $export_id ) || ! wp_verify_nonce( $nonce, 'burst_export_download_' . $export_id ) ) {
			wp_die( esc_html__( 'Security check failed or link expired. Please refresh the page and try again.', 'burst-statistics' ), 403 );
		}

		$this->stream_export_file( $export_id );
	}



	/**
	 * Stream export archive file to browser.
	 *
	 * @param string $export_id Export ID.
	 */
	public function stream_export_file( string $export_id ): void {
		$clean_id = preg_replace( '/\.(sql\.gz|sql|zip)$/i', '', $export_id );
		$clean_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $clean_id );
		if ( empty( $clean_id ) ) {
			status_header( 400 );
			wp_die( esc_html__( 'Invalid export ID.', 'burst-statistics' ), 400 );
		}

		$dir      = $this->get_export_dir();
		$path     = '';
		$filename = '';

		foreach ( [ '.sql.gz', '.zip', '.sql' ] as $ext ) {
			$candidate = $dir . $clean_id . $ext;
			if ( file_exists( $candidate ) ) {
				$path     = $candidate;
				$filename = $clean_id . $ext;
				break;
			}
		}

		if ( empty( $path ) || ! file_exists( $path ) ) {
			status_header( 404 );
			wp_die( esc_html__( 'Export file not found.', 'burst-statistics' ), 404 );
		}

		$size     = (int) filesize( $path );
		$is_zip   = str_ends_with( $filename, '.zip' );
		$mimetype = $is_zip ? 'application/zip' : 'application/gzip';
		if ( str_ends_with( $filename, '.sql' ) ) {
			$mimetype = 'application/sql';
		}

		// Clean all active output buffers.
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		// Disable compression if active to allow exact Content-Length.
		if ( function_exists( 'apache_setenv' ) ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_apache_setenv
			apache_setenv( 'no-gzip', '1' );
		}
		// phpcs:ignore WordPress.PHP.IniSet.Risky
		ini_set( 'zlib.output_compression', 'Off' );

		header( 'Content-Description: File Transfer' );
		header( 'Content-Type: ' . $mimetype );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		header( 'Content-Transfer-Encoding: binary' );
		header( 'Expires: 0' );
		header( 'Cache-Control: must-revalidate, post-check=0, pre-check=0' );
		header( 'Pragma: public' );
		header( 'Content-Length: ' . $size );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		readfile( $path );
		exit;
	}



	/**
	 * Cleanup old exports exceeding configured retention count or orphaned temp files.
	 */
	public function cleanup_old_exports(): void {
		$dir = $this->get_export_dir();
		if ( ! is_dir( $dir ) ) {
			return;
		}

		$schedule        = get_option( 'burst_export_schedule', [] );
		$retention_count = ! empty( $schedule['retention_count'] ) ? (int) $schedule['retention_count'] : 5;

		$exports = $this->list_exports();

		// 1. Enforce retention count: keep only latest $retention_count items.
		if ( count( $exports ) > $retention_count ) {
			$to_remove = array_slice( $exports, $retention_count );
			foreach ( $to_remove as $item ) {
				$this->delete_export_files( $item['id'] );
			}
			clearstatcache();
		}

		// 2. Purge orphaned or temporary files not matching retained files or active session.
		$active_session  = get_transient( 'burst_active_export_id' );
		$current_exports = $this->list_exports();
		$retained_files  = array_column( $current_exports, 'filename' );

		$files = scandir( $dir );
		if ( ! empty( $files ) ) {
			$orphan_cutoff = time() - DAY_IN_SECONDS;
			foreach ( $files as $file ) {
				if ( in_array( $file, [ '.', '..', '.htaccess', 'index.php' ], true ) ) {
					continue;
				}
				if ( in_array( $file, $retained_files, true ) ) {
					continue;
				}
				if ( ! empty( $active_session ) && str_contains( $file, (string) $active_session ) ) {
					continue;
				}

				$full_path = $dir . $file;
				$cutoff    = str_ends_with( $file, '.sql' ) ? ( time() - HOUR_IN_SECONDS ) : $orphan_cutoff;
				if ( file_exists( $full_path ) && filemtime( $full_path ) < $cutoff ) {
					wp_delete_file( $full_path );
				}
			}
		}
	}
}
