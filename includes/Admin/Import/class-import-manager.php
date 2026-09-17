<?php
namespace Burst\Admin\Import;

use Burst\Admin\Import\Interfaces\Import_Adapter;
use Burst\Admin\Import\Adapters\File\Burst_Adapter;
use Burst\Admin\Import\Adapters\File\GA4_Csv_Adapter;
use Burst\Admin\Import\Adapters\File\Plausible_Adapter;
use Burst\Admin\Import\Adapters\File\Fathom_Adapter;
use Burst\Admin\Import\Adapters\File\Jetpack_Adapter;
use Burst\Admin\Import\Adapters\Database\WP_Statistics_Adapter;
use Burst\Admin\Import\Adapters\Database\Matomo_Adapter;
use Burst\Admin\Import\Adapters\Database\Independent_Analytics_Adapter;
use Burst\Admin\Import\Adapters\Database\Koko_Adapter;
use Burst\Admin\Import\Adapters\Database\Statify_Adapter;
use Burst\Admin\Import\Adapters\Database\Slimstat_Adapter;
use Burst\Admin\Import\Helpers\Rollback_Service;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Import_Manager
 *
 * Core coordinator for external analytics import pipeline in Burst Pro.
 */
class Import_Manager {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Maximum number of terminal import records to retain in history.
	 */
	public const HISTORY_RETENTION_LIMIT = 15;

	/**
	 * Transient holding the cached adapter detection/estimate map served by
	 * the 'import_sources_status' REST action (see get_sources_status()).
	 */
	public const SOURCES_STATUS_TRANSIENT = 'burst_import_sources_status';

	/**
	 * Lifetime of the sources status cache in seconds.
	 */
	private const SOURCES_STATUS_TTL = 10 * MINUTE_IN_SECONDS;

	/**
	 * Available adapters map.
	 *
	 * @var array<string, Import_Adapter>
	 */
	private array $adapters = [];

	/**
	 * Chunked uploader instance.
	 */
	private Chunked_Uploader $uploader;

	/**
	 * Import runner instance.
	 */
	private Import_Runner $runner;

	/**
	 * Rollback service instance.
	 */
	private Rollback_Service $rollback_service;

	/**
	 * Initialize the import manager.
	 */
	public function init(): void {
		$this->uploader         = new Chunked_Uploader();
		$this->runner           = new Import_Runner();
		$this->rollback_service = new Rollback_Service();

		$this->register_adapters();

		// Table installation and schema registration.
		add_action( 'burst_install_tables', [ $this, 'install_tables' ] );
		add_filter( 'burst_all_tables', [ $this, 'register_all_tables' ] );

		// REST hooks.
		add_action( 'rest_api_init', [ $this->uploader, 'register_rest_routes' ] );
		add_filter( 'burst_do_action', [ $this, 'do_rest_action' ], 10, 3 );
		add_filter( 'burst_get_action', [ $this, 'get_rest_action' ], 10, 2 );

		// Surface the "import/export disabled during upgrade" notice through the
		// shared sidebar notices system instead of an inline banner.
		add_filter( 'burst_fields', [ $this, 'add_upgrade_notice_to_fields' ] );

		// Cron loops.
		add_action( 'burst_import_iteration', [ $this->runner, 'run_iteration' ], 10, 0 );
		add_action( 'burst_daily', [ $this->runner, 'run_iteration' ], 10, 0 );
		add_action( 'burst_daily', [ $this, 'prune_import_history' ] );
	}

	/**
	 * Register built-in source adapters.
	 */
	private function register_adapters(): void {
		$burst                 = new Burst_Adapter();
		$ga4                   = new GA4_Csv_Adapter();
		$plausible             = new Plausible_Adapter();
		$fathom                = new Fathom_Adapter();
		$jetpack               = new Jetpack_Adapter();
		$wp_statistics         = new WP_Statistics_Adapter();
		$matomo                = new Matomo_Adapter();
		$independent_analytics = new Independent_Analytics_Adapter();
		$koko                  = new Koko_Adapter();
		$statify               = new Statify_Adapter();
		$slimstat              = new Slimstat_Adapter();

		$this->adapters[ $burst->get_id() ]                 = $burst;
		$this->adapters[ $ga4->get_id() ]                   = $ga4;
		$this->adapters[ $plausible->get_id() ]             = $plausible;
		$this->adapters[ $fathom->get_id() ]                = $fathom;
		$this->adapters[ $jetpack->get_id() ]               = $jetpack;
		$this->adapters[ $wp_statistics->get_id() ]         = $wp_statistics;
		$this->adapters[ $matomo->get_id() ]                = $matomo;
		$this->adapters[ $independent_analytics->get_id() ] = $independent_analytics;
		$this->adapters[ $koko->get_id() ]                  = $koko;
		$this->adapters[ $statify->get_id() ]               = $statify;
		$this->adapters[ $slimstat->get_id() ]              = $slimstat;
	}

	/**
	 * Get adapter by ID.
	 *
	 * @param string $id Adapter ID.
	 */
	public function get_adapter( string $id ): ?Import_Adapter {
		if ( empty( $this->adapters ) ) {
			$this->register_adapters();
		}
		return $this->adapters[ $id ] ?? null;
	}

	/**
	 * Install burst_imports registry table.
	 */
	public function install_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$table_name      = $wpdb->prefix . 'burst_imports';

		$sql = "CREATE TABLE $table_name (
			`id` int(11) NOT NULL AUTO_INCREMENT,
			`source` varchar(64) NOT NULL,
			`source_type` varchar(20) NOT NULL,
			`period_start` date NOT NULL,
			`period_end` date NOT NULL,
			`rows_imported` bigint(20) NOT NULL DEFAULT 0,
			`pageviews_imported` bigint(20) NOT NULL DEFAULT 0,
			`sessions_imported` bigint(20) NOT NULL DEFAULT 0,
			`visitors_imported` bigint(20) NOT NULL DEFAULT 0,
			`status` varchar(30) NOT NULL DEFAULT 'pending',
			`file_hash` varchar(64) DEFAULT NULL,
			`settings` text NOT NULL,
			`created_at` int(11) NOT NULL,
			`completed_at` int(11) DEFAULT NULL,
			PRIMARY KEY (`id`),
			KEY `source_status` (`source`, `status`),
			KEY `file_hash` (`file_hash`)
		) $charset_collate;";

		dbDelta( $sql );
	}

	/**
	 * Ensure the burst_imports schema has up-to-date columns (e.g. file_hash).
	 */
	public function maybe_update_schema(): void {
		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_imports';
		if ( ! Burst_Adapter::table_exists( $table_name ) ) {
			$this->install_tables();
			return;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$column_exists = $wpdb->get_var(
			$wpdb->prepare(
				"SHOW COLUMNS FROM `{$table_name}` LIKE %s",
				'file_hash'
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( ! $column_exists ) {
			$this->install_tables();
		}
	}

	/**
	 * Register burst_imports table on burst_all_tables filter.
	 *
	 * @param string[] $tables Table names list.
	 * @return string[]
	 */
	public function register_all_tables( array $tables ): array {
		$tables[] = 'burst_imports';
		return $tables;
	}

	/**
	 * Handle REST POST actions for importer.
	 *
	 * @param array<string, mixed>      $output Response data.
	 * @param string                    $action Action name.
	 * @param array<string, mixed>|null $data   Request payload.
	 * @return array<string, mixed>
	 */
	public function do_rest_action( array $output, string $action, ?array $data ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		if ( 'start_import' === $action ) {
			global $wpdb;

			if ( ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' ) ) {
				$output['error'] = __( 'A database upgrade is currently running in the background. Please wait for it to complete before starting an import.', 'burst-statistics' );
				return $output;
			}

			$this->maybe_update_schema();
			$this->prune_import_history();

			// Prevent concurrent imports.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$has_active = (int) $wpdb->get_var(
				// A rollback runs through the same iteration loop and progress transient, so it blocks a new import too.
				"SELECT id FROM {$wpdb->prefix}burst_imports WHERE status IN ('processing', 'rolling_back') LIMIT 1"
			);
			if ( $has_active > 0 ) {
				$output['error'] = __( 'Another import or rollback is already in progress. Please wait for it to complete before starting a new one.', 'burst-statistics' );
				return $output;
			}

			if ( ! get_option( 'burst_original_activation_time' ) ) {
				$computed = self::calculate_native_tracking_start();
				update_option( 'burst_original_activation_time', $computed, false );
			}

			$source  = sanitize_text_field( (string) ( $data['source'] ?? '' ) );
			$adapter = $this->get_adapter( $source );

			if ( null === $adapter ) {
				$output['error'] = __( 'Invalid or unsupported import source.', 'burst-statistics' );
				return $output;
			}

			$file_path = '';
			$file_hash = null;
			if ( in_array( $adapter->get_type(), [ 'upload', 'file' ], true ) ) {
				$upload_id     = sanitize_text_field( (string) ( $data['upload_id'] ?? $data['file_path'] ?? '' ) );
				$resolved_path = '';

				if ( Chunked_Uploader::is_valid_upload_id( $upload_id ) ) {
					$uploader    = new Chunked_Uploader();
					$sandbox_dir = $uploader->get_upload_dir( $upload_id );
					$meta_file   = $sandbox_dir . '/upload_meta.json';
					if ( file_exists( $meta_file ) ) {
						// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
						$meta        = json_decode( (string) file_get_contents( $meta_file ), true ) ?: [];
						$target_file = $sandbox_dir . '/' . sanitize_file_name( (string) ( $meta['filename'] ?? '' ) );
						if ( file_exists( $target_file ) ) {
							$resolved_path = $target_file;
						}
					}
				} elseif ( ! empty( $upload_id ) && file_exists( $upload_id ) ) {
					$resolved_path = $upload_id;
				}

				$base_dir  = realpath( $this->uploader->get_base_upload_dir() );
				$real_path = ! empty( $resolved_path ) ? realpath( $resolved_path ) : false;

				if ( ! $real_path || ! $base_dir || ! str_starts_with( $real_path, $base_dir ) || ! file_exists( $real_path ) ) {
					$output['error'] = __( 'Uploaded file is invalid, missing, or outside the import directory.', 'burst-statistics' );
					return $output;
				}

				if ( ! Chunked_Uploader::is_allowed_file( $real_path ) ) {
					$output['error'] = __( 'File format not supported for analytics import.', 'burst-statistics' );
					return $output;
				}

				if ( ! $adapter->detect( $real_path ) ) {
					$output['error'] = __( 'The uploaded file does not match the expected format for this source.', 'burst-statistics' );
					return $output;
				}

				$preview = $adapter->parse_preview( $real_path );
				if ( empty( $preview['valid'] ) ) {
					$output['error'] = ! empty( $preview['error_message'] ) ? $preview['error_message'] : __( 'The backup archive does not contain valid Burst Statistics tables.', 'burst-statistics' );
					return $output;
				}

				$file_path = $real_path;
				$hash      = hash_file( 'sha256', $file_path );
				if ( false !== $hash ) {
					$file_hash = $hash;
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$existing_import = $wpdb->get_row(
						$wpdb->prepare(
							"SELECT id, created_at FROM {$wpdb->prefix}burst_imports WHERE file_hash = %s AND status IN ('processing', 'completed') ORDER BY id DESC LIMIT 1",
							$file_hash
						),
						ARRAY_A
					);

					if ( ! empty( $existing_import ) ) {
						if ( Chunked_Uploader::is_valid_upload_id( $upload_id ) ) {
							( new Chunked_Uploader() )->cleanup_upload( $upload_id );
						} elseif ( file_exists( $file_path ) ) {
							wp_delete_file( $file_path );
						}

						$import_date     = date_i18n( get_option( 'date_format', 'Y-m-d' ), (int) $existing_import['created_at'] );
						$output['error'] = sprintf(
							/* translators: 1: Import ID, 2: Import date */
							__( 'This file has already been imported (Import #%1$d on %2$s). Duplicate file imports are not allowed to prevent duplicate data.', 'burst-statistics' ),
							(int) $existing_import['id'],
							$import_date
						);
						return $output;
					}
				}
			}

			if ( 'database' === $adapter->get_type() ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$existing_db = $wpdb->get_row(
					$wpdb->prepare(
						"SELECT id, created_at FROM {$wpdb->prefix}burst_imports WHERE source = %s AND source_type = 'database' AND status = 'completed' ORDER BY id DESC LIMIT 1",
						$source
					),
					ARRAY_A
				);

				if ( ! empty( $existing_db ) ) {
					$import_date     = date_i18n( get_option( 'date_format', 'Y-m-d' ), (int) $existing_db['created_at'] );
					$output['error'] = sprintf(
						/* translators: 1: Source name, 2: Import ID, 3: Import date */
						__( 'The database source "%1$s" has already been imported (Import #%2$d on %3$s). To prevent duplicate records, database sources cannot be re-imported.', 'burst-statistics' ),
						$adapter->get_name(),
						(int) $existing_db['id'],
						$import_date
					);
					return $output;
				}
			}

			$estimate = $adapter->estimate( $file_path );

			$state = [
				'file_path'     => $file_path,
				'offset'        => 0,
				'watermark_id'  => 0,
				'total_records' => $estimate['total_records'],
				'batch_size'    => 1000,
			];

			$cutoff     = self::get_burst_tracking_start();
			$date_start = $estimate['date_start'] ?: gmdate( 'Y-m-d' );
			$date_end   = $estimate['date_end'] ?: gmdate( 'Y-m-d' );
			if ( ! empty( $date_end ) && $date_end > $cutoff['date'] ) {
				$date_end = $cutoff['date'];
			}

			$insert_data    = [
				'source'       => $source,
				'source_type'  => $adapter->get_type(),
				'period_start' => $date_start,
				'period_end'   => $date_end,
				'status'       => 'processing',
				'settings'     => wp_json_encode( $state ),
				'created_at'   => time(),
			];
			$insert_formats = [ '%s', '%s', '%s', '%s', '%s', '%s', '%d' ];

			if ( null !== $file_hash ) {
				$insert_data['file_hash'] = $file_hash;
				$insert_formats[]         = '%s';
			}

			$wpdb->insert(
				$wpdb->prefix . 'burst_imports',
				$insert_data,
				$insert_formats
			);

			$import_id = (int) $wpdb->insert_id;

			delete_transient( self::SOURCES_STATUS_TRANSIENT );

			set_transient(
				'burst_progress_import',
				[
					'import_id'  => $import_id,
					'source'     => $source,
					'percentage' => 1,
					'status'     => 'processing',
					'rows'       => 0,
					'pageviews'  => 0,
				],
				DAY_IN_SECONDS
			);

			wp_schedule_single_event( time(), 'burst_import_iteration' );

			$output['success']   = true;
			$output['import_id'] = $import_id;
		} elseif ( 'import_chunk' === $action ) {
			$import_id = isset( $data['import_id'] ) ? (int) $data['import_id'] : null;
			if ( null !== $import_id && $import_id > 0 ) {
				set_transient( 'burst_ui_import_active_' . $import_id, time(), 30 );
			}
			$progress           = $this->runner->run_iteration( $import_id );
			$output['success']  = true;
			$output['progress'] = $progress;
		} elseif ( 'cancel_import' === $action ) {
			global $wpdb;
			$import_id = (int) ( $data['import_id'] ?? 0 );
			if ( $import_id <= 0 ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$import_id = (int) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}burst_imports WHERE status = 'processing' ORDER BY id DESC LIMIT 1" );
			}
			if ( $import_id > 0 ) {
				set_transient( 'burst_import_cancelled_' . $import_id, true, 60 );

				// Clean up any staging tables if this was a Burst import.
				Adapters\File\Burst_Adapter::cleanup_staging_tables( $import_id );

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$settings_json = (string) $wpdb->get_var(
					$wpdb->prepare( "SELECT settings FROM {$wpdb->prefix}burst_imports WHERE id = %d", $import_id )
				);
				$this->cleanup_import_files( $settings_json, $import_id );

				// Rollback any partially inserted records.
				$this->rollback_service->rollback( $import_id );

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->update(
					$wpdb->prefix . 'burst_imports',
					[
						'status'       => 'cancelled',
						'completed_at' => time(),
					],
					[ 'id' => $import_id ]
				);
			}

			// Mark any lingering processing records as cancelled to guarantee no background resurrection.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update(
				$wpdb->prefix . 'burst_imports',
				[
					'status'       => 'cancelled',
					'completed_at' => time(),
				],
				[ 'status' => 'processing' ]
			);

			delete_transient( 'burst_progress_import' );
			delete_transient( self::SOURCES_STATUS_TRANSIENT );
			// The iteration mutex is the option 'burst_import_lock_{id}', held by
			// Import_Runner::run_iteration() and released in its finally block (a
			// worker that died mid-batch is reclaimed there after 60s). It is not
			// cleared here on purpose: deleting it while a batch is still running
			// would let a second worker start on the same import.
			wp_clear_scheduled_hook( 'burst_import_iteration' );
			$output['success'] = true;
		} elseif ( 'rollback_import' === $action ) {
			// The rollback runs as a background job driven by the same chunk
			// loop as an import (see Rollback_Service::start()); only a finished
			// import is accepted.
			$import_id         = (int) ( $data['import_id'] ?? 0 );
			$result            = $this->rollback_service->start( $import_id );
			$output['success'] = $result['success'];
			$output['message'] = $result['message'];
			delete_transient( self::SOURCES_STATUS_TRANSIENT );
		} elseif ( 'clear_import_history' === $action ) {
			$cleared           = $this->clear_history();
			$output['success'] = true;
			$output['message'] = $cleared ? __( 'Import history cleared.', 'burst-statistics' ) : __( 'No completed imports to clear.', 'burst-statistics' );
		}

		return $output;
	}

	/**
	 * Handle REST GET actions for importer.
	 *
	 * Manage capability, like the export actions: the history exposes server
	 * paths of the uploaded and working files, and the sources status runs
	 * detection queries against third-party tables.
	 *
	 * @param array<string, mixed> $output Response data.
	 * @param string               $action Action name.
	 * @return array<string, mixed>
	 */
	public function get_rest_action( array $output, string $action ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		if ( 'import_progress' === $action ) {
			$progress           = get_transient( 'burst_progress_import' );
			$output['progress'] = $progress ?: [
				'percentage' => 0,
				'status'     => 'idle',
			];
		} elseif ( 'import_sources_status' === $action ) {
			$output['sources']              = $this->get_sources_status();
			$output['burst_tracking_start'] = self::get_burst_tracking_start();
			$output['upgrade_running']      = ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' );
		} elseif ( 'import_history' === $action ) {
			global $wpdb;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows            = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_imports ORDER BY id DESC LIMIT 15", ARRAY_A );
			$active_progress = get_transient( 'burst_progress_import' );
			if ( is_array( $rows ) && is_array( $active_progress ) && ! empty( $active_progress['import_id'] ) ) {
				foreach ( $rows as &$row ) {
					if ( (int) $row['id'] === (int) $active_progress['import_id'] && 'processing' === $row['status'] ) {
						$row['percentage']         = $active_progress['percentage'] ?? 0;
						$row['rows_imported']      = $active_progress['rows'] ?? $row['rows_imported'];
						$row['pageviews_imported'] = $active_progress['pageviews'] ?? $row['pageviews_imported'];
						$row['current_table']      = $active_progress['current_table'] ?? '';
					}
				}
				unset( $row );
			}
			$output['history'] = $rows ?: [];
		}

		return $output;
	}

	/**
	 * Detection and size estimate of every registered adapter, cached for
	 * SOURCES_STATUS_TTL. detect() and estimate() run SHOW TABLES plus
	 * COUNT/MIN/MAX against third-party tables, and the import screen asks for
	 * this on every load; a source plugin's tables do not change often enough
	 * to pay for that each time. The transient is dropped when an import
	 * starts, is cancelled or is rolled back, so the screen never shows a
	 * source as importable while its data is being processed.
	 *
	 * @return array<string, array{id: string, name: string, type: string, detected: bool, estimate: array<string, mixed>|null}>
	 */
	private function get_sources_status(): array {
		$cached = get_transient( self::SOURCES_STATUS_TRANSIENT );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$status_map = [];
		foreach ( $this->adapters as $id => $adapter ) {
			$detected          = $adapter->detect();
			$status_map[ $id ] = [
				'id'       => $id,
				'name'     => $adapter->get_name(),
				'type'     => $adapter->get_type(),
				'detected' => $detected,
				'estimate' => $detected ? $adapter->estimate() : null,
			];
		}

		set_transient( self::SOURCES_STATUS_TRANSIENT, $status_map, self::SOURCES_STATUS_TTL );

		return $status_map;
	}

	/**
	 * Compute the native tracking start timestamp from existing database records.
	 *
	 * Queries MIN(time) of records not tagged with an import prefix (imp%),
	 * falling back to burst_activation_time or current time.
	 *
	 * @return int Timestamp.
	 */
	public static function calculate_native_tracking_start(): int {
		global $wpdb;

		$earliest_native = 0;
		if ( isset( $wpdb ) && ! empty( $wpdb->prefix ) ) {
			$table     = $wpdb->prefix . 'burst_statistics';
			$has_table = Burst_Adapter::table_exists( $table );
			if ( $has_table ) {
				// Check if legacy uid column exists.
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$has_uid_col = (bool) $wpdb->get_var( "SHOW COLUMNS FROM `{$table}` LIKE 'uid'" );
				if ( $has_uid_col ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$earliest_native = (int) $wpdb->get_var( "SELECT MIN(time) FROM `{$table}` WHERE uid NOT LIKE 'imp%'" );
				} else {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$earliest_native = (int) $wpdb->get_var( "SELECT MIN(time) FROM `{$table}` WHERE uid_id NOT IN (SELECT ID FROM `{$wpdb->prefix}burst_uids` WHERE uid LIKE 'imp%')" );
				}
			}
		}

		if ( $earliest_native > 0 ) {
			return $earliest_native;
		}

		$activation = (int) get_option( 'burst_activation_time', 0 );
		return $activation > 0 ? $activation : time();
	}

	/**
	 * Get the timestamp and date when Burst began tracking on this site.
	 *
	 * Used to cap all imports so that no redundant data from periods Burst
	 * has already tracked natively gets imported. Reads the persisted option
	 * burst_original_activation_time, computing it once if missing.
	 *
	 * @return array{timestamp: int, date: string, formatted: string}
	 */
	public static function get_burst_tracking_start(): array {
		$original_activation = (int) get_option( 'burst_original_activation_time', 0 );
		if ( $original_activation <= 0 ) {
			$original_activation = self::calculate_native_tracking_start();
			update_option( 'burst_original_activation_time', $original_activation, false );
		}

		// Normalize to midnight UTC of that start date.
		$start_date = gmdate( 'Y-m-d', $original_activation );
		$cutoff_ts  = strtotime( $start_date . ' 00:00:00 UTC' ) ?: $original_activation;

		return [
			'timestamp' => $cutoff_ts,
			'date'      => $start_date,
			'formatted' => date_i18n( get_option( 'date_format', 'F j, Y' ), $cutoff_ts ),
		];
	}

	/**
	 * Automatically prune older terminal import records beyond the retention limit.
	 * Keeps the most recent records in the database and cleans up their temp files.
	 */
	public function prune_import_history(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$terminal_ids = $wpdb->get_col(
			"SELECT id FROM {$wpdb->prefix}burst_imports 
			WHERE status IN ('completed', 'cancelled', 'failed', 'rolled_back') 
			ORDER BY id DESC"
		);

		if ( ! is_array( $terminal_ids ) || count( $terminal_ids ) <= self::HISTORY_RETENTION_LIMIT ) {
			return;
		}

		$excess_ids = array_slice( $terminal_ids, self::HISTORY_RETENTION_LIMIT );
		if ( empty( $excess_ids ) ) {
			return;
		}

		$sanitized_ids = array_filter( array_map( 'intval', $excess_ids ), static fn( $id ) => $id > 0 );
		if ( empty( $sanitized_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $sanitized_ids ), '%d' ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$records = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, settings FROM {$wpdb->prefix}burst_imports WHERE id IN ($placeholders)",
				...$sanitized_ids
			),
			ARRAY_A
		);

		if ( ! empty( $records ) && is_array( $records ) ) {
			foreach ( $records as $row ) {
				$this->cleanup_import_files( (string) ( $row['settings'] ?? '' ), (int) ( $row['id'] ?? 0 ) );
			}
		}

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_imports WHERE id IN ($placeholders)",
				...$sanitized_ids
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
	}

	/**
	 * Delete an import from history and remove associated temp files.
	 *
	 * @param int $import_id Import ID.
	 */
	public function delete_import( int $import_id ): bool {
		global $wpdb;

		if ( $import_id <= 0 ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$import = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}burst_imports WHERE id = %d",
				$import_id
			)
		);

		if ( ! $import ) {
			return false;
		}

		$this->cleanup_import_files( (string) $import->settings, $import_id );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->delete(
			$wpdb->prefix . 'burst_imports',
			[ 'id' => $import_id ],
			[ '%d' ]
		);

		return true;
	}

	/**
	 * Clear all terminal import history records (completed, cancelled, failed, rolled_back).
	 * Preserves any active 'processing' import and safely deletes associated temp files.
	 *
	 * @return bool True if records were cleared, false if no records to clear.
	 */
	public function clear_history(): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			"SELECT id, settings FROM {$wpdb->prefix}burst_imports WHERE status IN ('completed', 'cancelled', 'failed', 'rolled_back')",
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return false;
		}

		foreach ( $rows as $row ) {
			$this->cleanup_import_files( (string) ( $row['settings'] ?? '' ), (int) ( $row['id'] ?? 0 ) );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query(
			"DELETE FROM {$wpdb->prefix}burst_imports WHERE status IN ('completed', 'cancelled', 'failed', 'rolled_back')"
		);

		return true;
	}

	/**
	 * Delete temporary upload file, working uncompressed files, and staging tables associated with an import.
	 *
	 * @param string $settings_json JSON encoded settings.
	 * @param int    $import_id     Import ID.
	 */
	public function cleanup_import_files( string $settings_json, int $import_id = 0 ): void {
		if ( $import_id > 0 ) {
			Adapters\File\Burst_Adapter::cleanup_staging_tables( $import_id );
		}

		if ( empty( $settings_json ) ) {
			return;
		}

		$settings = json_decode( $settings_json, true );
		if ( ! is_array( $settings ) ) {
			return;
		}

		$base_dir = realpath( $this->uploader->get_base_upload_dir() );
		if ( ! $base_dir ) {
			return;
		}

		$working_file = $settings['working_file'] ?? '';
		if ( ! empty( $working_file ) && is_string( $working_file ) ) {
			$real_working = realpath( $working_file );
			if ( $real_working && str_starts_with( $real_working, $base_dir ) && file_exists( $real_working ) ) {
				wp_delete_file( $real_working );
			}
		}

		$file_path = $settings['file_path'] ?? '';
		if ( ! empty( $file_path ) && is_string( $file_path ) ) {
			$real_file = realpath( $file_path );
			if ( $real_file && str_starts_with( $real_file, $base_dir ) && file_exists( $real_file ) ) {
				$parent = dirname( $real_file );
				wp_delete_file( $real_file );
				if ( $parent !== $base_dir && str_starts_with( $parent, $base_dir ) ) {
					( new Chunked_Uploader() )->cleanup_upload( basename( $parent ) );
				}
			}
		}
	}

	/**
	 * Extend burst_data_start backwards and lower burst_visitor_bitmaps_rebuild_from.
	 *
	 * Guaranteed to only lower the timestamps/dates (never raise them) and writes with autoload = false.
	 *
	 * @param int $timestamp Unix timestamp of earliest imported data point.
	 */
	public static function extend_data_start( int $timestamp ): void {
		if ( $timestamp <= 0 ) {
			return;
		}

		$cutoff_info        = self::get_burst_tracking_start();
		$current_data_start = (int) get_option( 'burst_data_start', 0 );
		$baseline           = $current_data_start > 0 ? $current_data_start : (int) $cutoff_info['timestamp'];

		// Guaranteed to only lower the timestamps/dates (never raise them).
		if ( $timestamp >= $baseline ) {
			return;
		}

		$start_date   = gmdate( 'Y-m-d', $timestamp );
		$rebuild_from = (string) get_option( 'burst_visitor_bitmaps_rebuild_from' );
		if ( '' === $rebuild_from || $start_date < $rebuild_from ) {
			update_option( 'burst_visitor_bitmaps_rebuild_from', $start_date, false );
		}

		update_option( 'burst_data_start', $timestamp, false );
	}

	/**
	 * Restore burst_data_start and rebuild watermark during rollback.
	 *
	 * Re-evaluates the earliest remaining statistics row against original activation time,
	 * ensuring autoload = false.
	 *
	 * @param string|null $period_start Optional period start string (Y-m-d) of the rolled-back import.
	 */
	public static function restore_data_start( ?string $period_start = null ): void {
		global $wpdb;

		if ( ! empty( $period_start ) ) {
			$rebuild_from = (string) get_option( 'burst_visitor_bitmaps_rebuild_from' );
			if ( '' === $rebuild_from || $period_start < $rebuild_from ) {
				update_option( 'burst_visitor_bitmaps_rebuild_from', $period_start, false );
			}
		}

		$original_activation = (int) get_option( 'burst_original_activation_time', 0 );
		if ( $original_activation > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$earliest_remaining = $wpdb->get_var( "SELECT MIN(time) FROM {$wpdb->prefix}burst_statistics" );
			if ( $earliest_remaining ) {
				update_option( 'burst_data_start', min( (int) $earliest_remaining, $original_activation ), false );
			} else {
				update_option( 'burst_data_start', $original_activation, false );
			}
		}
	}

	/**
	 * Mapping of supported external statistics tools with file and database signatures.
	 *
	 * @return array<string, array{name: string, file: ?string, database: ?string}>
	 */
	public static function get_known_statistics_tools_map(): array {
		return [
			'ga4'                   => [
				'name'     => __( 'Google Analytics', 'burst-statistics' ),
				'file'     => 'googletagmanager.com/gtag/js',
				'database' => null,
			],
			'wp_statistics'         => [
				'name'     => __( 'WP Statistics', 'burst-statistics' ),
				'file'     => 'wp-statistics.js',
				'database' => 'WP_STATISTICS_VERSION',
			],
			'matomo'                => [
				'name'     => __( 'Matomo', 'burst-statistics' ),
				'file'     => 'matomo.js',
				'database' => 'MATOMO_VERSION',
			],
			'independent_analytics' => [
				'name'     => __( 'Independent Analytics', 'burst-statistics' ),
				'file'     => 'ia.js',
				'database' => 'INDEPENDENT_ANALYTICS_VERSION',
			],
			'koko'                  => [
				'name'     => __( 'Koko Analytics', 'burst-statistics' ),
				'file'     => 'koko-analytics.js',
				'database' => 'KOKO_ANALYTICS_VERSION',
			],
			'statify'               => [
				'name'     => __( 'Statify', 'burst-statistics' ),
				'file'     => 'statify.js',
				'database' => 'STATIFY_VERSION',
			],
			'slimstat'              => [
				'name'     => __( 'WP Slimstat', 'burst-statistics' ),
				'file'     => 'wp-slimstat.min.js',
				'database' => 'WP_SLIMSTAT',
			],
			'jetpack'               => [
				'name'     => __( 'Jetpack', 'burst-statistics' ),
				'file'     => 'stats.wp.com',
				'database' => 'JETPACK__VERSION',
			],
			'plausible'             => [
				'name'     => __( 'Plausible', 'burst-statistics' ),
				'file'     => 'plausible.js',
				'database' => null,
			],
			'fathom'                => [
				'name'     => __( 'Fathom', 'burst-statistics' ),
				'file'     => 'cdn.usefathom.com',
				'database' => null,
			],
		];
	}

	/**
	 * Option holding the display name of the statistics tool detected on the
	 * site. Written by has_known_statistics_tool() (cron only, via the task
	 * validation) and read by get_detected_statistics_tool_name() on admin
	 * requests, so no request path ever runs the detection itself.
	 */
	public const DETECTED_TOOL_OPTION = 'burst_detected_statistics_tool';

	/**
	 * Detect a known statistics tool on the site and record it.
	 *
	 * Runs the detection (plugin constants, then a fetch of the front page for
	 * tracking-script markers) and stores the result: a found tool goes into
	 * DETECTED_TOOL_OPTION, a real negative (the page was fetched and carries
	 * no marker) removes it. A failed fetch is not a negative: the stored
	 * result is kept, so a timeout never flips the import task off. Cached in
	 * a weekly transient ('burst_known_statistics_tool'). Only called from
	 * should_show_import_task(), i.e. from the task validation on cron.
	 *
	 * @return string|false Display name of the detected tool, or false.
	 */
	public static function has_known_statistics_tool(): string|false {
		$transient_key = 'burst_known_statistics_tool';
		$cached        = get_transient( $transient_key );
		if ( false !== $cached ) {
			return 'none' === $cached ? false : (string) $cached;
		}

		$tools = self::get_known_statistics_tools_map();

		// 1. Check PHP constants of supported WordPress plugins (fastest, local).
		foreach ( $tools as $tool ) {
			if ( ! empty( $tool['database'] ) && defined( $tool['database'] ) ) {
				return self::record_detected_tool( $tool['name'] );
			}
		}

		// 2. Check front-end web source for tracking script .js files.
		$response = wp_remote_get(
			home_url(),
			[
				'timeout'   => 5,
				'sslverify' => true,
			]
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			// Unknown, not negative: keep what an earlier run found.
			$stored = (string) get_option( self::DETECTED_TOOL_OPTION, '' );
			return '' !== $stored ? $stored : false;
		}

		$body = (string) wp_remote_retrieve_body( $response );
		foreach ( $tools as $tool ) {
			if ( ! empty( $tool['file'] ) && str_contains( $body, $tool['file'] ) ) {
				return self::record_detected_tool( $tool['name'] );
			}
		}

		// A real negative: the tool is gone (or was never there).
		delete_option( self::DETECTED_TOOL_OPTION );
		set_transient( $transient_key, 'none', WEEK_IN_SECONDS );
		return false;
	}

	/**
	 * Store a detected tool name and cache the positive result.
	 *
	 * @param string $name Display name of the tool.
	 * @return string The same name, for the caller to return.
	 */
	private static function record_detected_tool( string $name ): string {
		update_option( self::DETECTED_TOOL_OPTION, $name, false );
		set_transient( 'burst_known_statistics_tool', $name, WEEK_IN_SECONDS );
		return $name;
	}

	/**
	 * Display name of the detected statistics tool for the import task
	 * message. Reads the stored result only (see DETECTED_TOOL_OPTION); the
	 * task config builds this message on every load, so it must never detect.
	 */
	public static function get_detected_statistics_tool_name(): string {
		$tool = (string) get_option( self::DETECTED_TOOL_OPTION, '' );
		return '' !== $tool ? $tool : __( 'your previous analytics tool', 'burst-statistics' );
	}

	/**
	 * Serverside condition of the import_statistics_data task: shown while a
	 * known statistics tool is in use and no import has completed. Evaluated
	 * by Tasks::validate_tasks() on cron; a false result dismisses the task,
	 * permanently (dismiss_permanently), so it never returns once an import
	 * completed or the tool is gone. A user dismiss is permanent as well.
	 */
	public static function should_show_import_task(): bool {
		if ( self::has_completed_import() ) {
			return false;
		}
		return false !== self::has_known_statistics_tool();
	}

	/**
	 * Check if any import has completed successfully.
	 */
	public static function has_completed_import(): bool {
		global $wpdb;
		// The table is created on the first import; before that the query
		// fails, which is the same answer as "no completed import".
		$suppress = $wpdb->suppress_errors();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$found = (bool) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}burst_imports WHERE status = 'completed' LIMIT 1" );
		$wpdb->suppress_errors( $suppress );
		return $found;
	}

	/**
	 * Attach a critical sidebar notice to the Data settings when a database
	 * upgrade is running, so the shared SettingsNotices renders it (theme-aware)
	 * instead of a hardcoded inline banner in the import/export fields.
	 *
	 * @param array<int, array<string, mixed>> $fields Settings field definitions.
	 * @return array<int, array<string, mixed>>
	 */
	public function add_upgrade_notice_to_fields( array $fields ): array {
		$upgrade_running = ! $this->db_upgrades_complete() || (bool) get_transient( 'burst_upgrade_running' );
		if ( ! $upgrade_running ) {
			return $fields;
		}

		foreach ( $fields as $key => $field ) {
			if ( isset( $field['id'] ) && 'import_data' === $field['id'] ) {
				$fields[ $key ]['notice'] = [
					'label'       => 'critical',
					'title'       => __( 'Database upgrade in progress', 'burst-statistics' ),
					'description' => __( 'A database upgrade is currently running in the background. Data imports and exports are temporarily disabled until the upgrade completes.', 'burst-statistics' ),
				];
				break;
			}
		}

		return $fields;
	}
}
