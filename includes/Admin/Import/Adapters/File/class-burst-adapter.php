<?php
/**
 * Burst Statistics Backup Archive Import Adapter.
 *
 * Implements stream-chunked restoration of complete Burst database backups
 * supporting .sql.gz, .sql, and .zip archive formats with dynamic table prefix remapping.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Import\Import_Runner;
use Burst\Admin\DB_Upgrade\DB_Upgrade;
use Burst\Admin\Import\Import_Manager;
use Burst\Admin\Import\Interfaces\Import_Adapter;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use ZipArchive;

defined( 'ABSPATH' ) || die();

/**
 * Class Burst_Adapter
 */
class Burst_Adapter implements Import_Adapter {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Staging tables known to exist in this process, keyed by full table name.
	 * A staging table is created once per import id and is only dropped by
	 * cleanup_staging_tables() (which forgets it here), so the SHOW TABLES /
	 * DESCRIBE probe in ensure_staging_table() runs once per table instead of
	 * once per INSERT statement of the dump.
	 *
	 * @var array<string, true>
	 */
	private static array $staging_tables_ready = [];

	/**
	 * Live column lists of this process, keyed by full table name. The live
	 * schema does not change while a batch runs; finalize_import_state()
	 * resets this after it does alter the schema. Saves a SHOW COLUMNS per
	 * INSERT statement.
	 *
	 * @var array<string, string[]>
	 */
	private static array $live_columns = [];

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'burst';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'Burst Statistics Backup (.sql.gz / .zip)', 'burst-statistics' );
	}

	/**
	 * Get adapter type.
	 */
	public function get_type(): string {
		return 'upload';
	}

	/**
	 * Detect if adapter is relevant for a given file.
	 *
	 * @param string|null $file_path Optional file path.
	 */
	public function detect( ?string $file_path = null ): bool {
		if ( null === $file_path || '' === $file_path ) {
			return false;
		}

		$filename     = strtolower( basename( $file_path ) );
		$is_valid_ext = str_ends_with( $filename, '.sql.gz' )
			|| str_ends_with( $filename, '.sql' )
			|| str_ends_with( $filename, '.zip' )
			|| str_ends_with( $filename, '.gz' );

		if ( ! $is_valid_ext || ! file_exists( $file_path ) ) {
			return false;
		}

		$header = $this->read_file_header( $file_path, 4096 );

		return str_contains( $header, 'Burst Statistics' )
			|| str_contains( $header, 'burst_statistics' )
			|| str_contains( $header, 'burst_sessions' );
	}

	/**
	 * Estimate record count and date ranges.
	 *
	 * @param string|null $file_path Optional file path.
	 */
	public function estimate( ?string $file_path = null ): array {
		if ( null === $file_path || '' === $file_path || ! file_exists( $file_path ) ) {
			return [
				'total_records'    => 0,
				'date_start'       => '',
				'date_end'         => '',
				'metrics_included' => [ 'pageviews', 'sessions', 'visitors', 'goals', 'devices', 'referrers', 'parameters' ],
				'metrics_excluded' => [],
			];
		}

		$preview  = $this->parse_preview( $file_path );
		$cutoff   = Import_Manager::get_burst_tracking_start();
		$date_end = $preview['date_range']['end'] ?? '';
		if ( ! empty( $date_end ) && $date_end > $cutoff['date'] ) {
			$date_end = $cutoff['date'];
		}

		return [
			'total_records'    => $preview['estimated_rows'],
			'date_start'       => $preview['date_range']['start'] ?? '',
			'date_end'         => $date_end,
			'metrics_included' => [ 'pageviews', 'sessions', 'visitors', 'goals', 'devices', 'referrers', 'parameters' ],
			'metrics_excluded' => [],
		];
	}

	/**
	 * Parse preview information from export file.
	 *
	 * @param string $file_path File path.
	 */
	public function parse_preview( string $file_path ): array {
		if ( ! file_exists( $file_path ) ) {
			return [
				'valid'            => false,
				'headers_detected' => [],
				'date_range'       => [
					'start' => '',
					'end'   => '',
				],
				'estimated_rows'   => 0,
				'error_message'    => __( 'Backup file not found on server.', 'burst-statistics' ),
			];
		}

		$header = $this->read_file_header( $file_path, 16384 );
		$tables = [];

		if ( preg_match( '/-- Tables:\s*([^\r\n]+)/i', $header, $tables_header_match ) ) {
			$raw_list = explode( ',', $tables_header_match[1] );
			foreach ( $raw_list as $tbl ) {
				$clean = preg_replace( '/^[a-zA-Z0-9_]*_?(burst_[a-zA-Z0-9_]+)$/i', '$1', trim( $tbl ) );
				if ( ! empty( $clean ) && ! is_numeric( $clean ) ) {
					$tables[] = $clean;
				}
			}
		}

		if ( preg_match_all( '/(?:-- Table (?:structure|data) for `([^`]+)`|CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`|INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-zA-Z0-9_]+)`?)/i', $header, $matches ) ) {
			$raw_tables = array_filter(
				array_merge( $matches[1], $matches[2], $matches[3] ),
				static function ( $tbl ) {
					return '' !== $tbl;
				}
			);
			foreach ( $raw_tables as $tbl ) {
				if ( preg_match( '/(?:^|[a-zA-Z0-9_]*_)?(burst_[a-zA-Z0-9_]+)$/i', $tbl, $m ) ) {
					$tables[] = strtolower( $m[1] );
				}
			}
		}
		$tables = array_values( array_unique( $tables ) );

		$estimated_rows = 0;
		if ( preg_match( '/-- Estimated Rows:\s*(\d+)/i', $header, $row_match ) ) {
			$estimated_rows = (int) $row_match[1];
		} elseif ( preg_match( '/-- Total Records:\s*(\d+)/i', $header, $row_match ) ) {
			$estimated_rows = (int) $row_match[1];
		} else {
			// Estimate based on uncompressed or compressed file size (~100 bytes per row).
			$estimated_rows = max( 100, (int) round( filesize( $file_path ) / 100 ) );
		}

		$date_generated = '';
		if ( preg_match( '/-- Generated:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i', $header, $date_match ) ) {
			$date_generated = $date_match[1];
		}

		// Try to extract the earliest date from an INSERT statement timestamp in the
		// header portion (statistics rows start with a unix timestamp in the `time` column).
		// Matches e.g. INSERT INTO `wp_burst_statistics` (...) VALUES (..., 1704067200, ...)
		// and converts the earliest timestamp found to Y-m-d.
		$date_start = '';
		if ( preg_match_all( '/\bINSERT\s+(?:IGNORE\s+)?INTO\s+`[^`]*burst_statistics[^`]*`[^;]+?VALUES\s*(?:\([^)]+\),?\s*)+/is', $header, $insert_matches ) ) {
			// Extract all numeric values from INSERT rows that look like unix timestamps
			// (10-digit numbers > 1000000000 = Sept 2001).
			$all_timestamps = [];
			foreach ( $insert_matches[0] as $ins ) {
				if ( preg_match_all( '/,\s*(1[0-9]{9})\s*,/', $ins, $ts_matches ) ) {
					foreach ( $ts_matches[1] as $ts ) {
						$all_timestamps[] = (int) $ts;
					}
				}
			}
			if ( ! empty( $all_timestamps ) ) {
				$date_start = gmdate( 'Y-m-d', min( $all_timestamps ) );
			}
		}

		$is_valid = ! empty( $tables )
			|| str_contains( $header, 'Burst Statistics' )
			|| str_contains( $header, 'burst_' );

		return [
			'valid'            => $is_valid,
			'headers_detected' => ! empty( $tables ) ? $tables : [ 'burst_statistics', 'burst_sessions' ],
			'date_range'       => [
				'start' => $date_start,
				'end'   => $date_generated ?: gmdate( 'Y-m-d' ),
			],
			'estimated_rows'   => $estimated_rows,
		];
	}

	/**
	 * Process a single batch chunk of data.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $state Current batch cursor state.
	 * @return array<string, mixed>
	 */
	public function import_batch( int $import_id, array $state ): array {
		global $wpdb;

		$phase = (string) ( $state['phase'] ?? 'staging' );
		if ( 'merging' === $phase ) {
			return $this->execute_merge_step( $import_id, $state );
		}

		$file_path = (string) ( $state['file_path'] ?? '' );
		if ( ! file_exists( $file_path ) ) {
			$state['status']        = 'failed';
			$state['error_message'] = __( 'Backup file missing during import.', 'burst-statistics' );
			return $state;
		}

		// 1. Prepare an uncompressed working .sql file if needed. A .sql.gz is
		// decompressed in bounded, resumable steps (time-budgeted) across
		// iterations so no single request runs long regardless of backup size;
		// the UI shows a 'preparing' status meanwhile.
		$working_file = (string) ( $state['working_file'] ?? '' );
		if ( empty( $working_file ) || ! file_exists( $working_file ) ) {
			$lower_path = strtolower( $file_path );

			if ( str_ends_with( $lower_path, '.sql' ) ) {
				// Uncompressed upload: use it directly, no preparation needed.
				$working_file          = $file_path;
				$state['working_file'] = $working_file;
				$state['file_offset']  = 0;
			} elseif ( str_ends_with( $lower_path, '.gz' ) ) {
				// Resumable, time-budgeted decompression of .sql.gz / .gz.
				$dest_sql = dirname( $file_path ) . '/burst_work_' . $import_id . '.sql';
				$done     = $this->gunzip_step( $file_path, $dest_sql, $state, Import_Runner::get_chunk_time_budget() );
				if ( null === $done ) {
					$state['status']        = 'failed';
					$state['error_message'] = __( 'Failed to decompress backup archive.', 'burst-statistics' );
					return $state;
				}
				if ( ! $done ) {
					$state['phase']         = 'preparing';
					$state['status']        = 'processing';
					$state['current_table'] = __( 'Preparing backup (decompressing archive)…', 'burst-statistics' );
					return $state;
				}
				unset( $state['prep_written'] );
				$working_file          = $dest_sql;
				$state['working_file'] = $working_file;
				$state['file_offset']  = 0;
			} else {
				// .zip (only produced when zlib/gzopen is unavailable, and then
				// typically small). ZipArchive extraction is all-or-nothing, so it
				// runs in a single 'preparing' iteration with UI feedback.
				if ( 'preparing' !== $phase ) {
					$state['phase']         = 'preparing';
					$state['status']        = 'processing';
					$state['current_table'] = __( 'Preparing backup (extracting archive)…', 'burst-statistics' );
					return $state;
				}
				$prepared = $this->prepare_working_file( $file_path, $import_id );
				if ( empty( $prepared ) || ! file_exists( $prepared ) ) {
					$state['status']        = 'failed';
					$state['error_message'] = __( 'Failed to prepare or extract backup SQL file.', 'burst-statistics' );
					return $state;
				}
				$working_file          = $prepared;
				$state['working_file'] = $working_file;
				$state['file_offset']  = 0;
			}
		}

		// Mark the staging phase so progress is reported (2-45%) while rows are
		// staged; without this the runner would report 0% for the whole phase.
		$state['phase'] = 'staging';

		// 2. Open working file and seek to cursor offset.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $working_file, 'rb' );
		if ( false === $handle ) {
			$state['status']        = 'failed';
			$state['error_message'] = __( 'Unable to read working SQL file.', 'burst-statistics' );
			return $state;
		}

		$file_offset = (int) ( $state['file_offset'] ?? 0 );
		if ( $file_offset > 0 ) {
			fseek( $handle, $file_offset );
		}

		if ( get_transient( 'burst_import_cancelled_' . $import_id ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $handle );
			if ( $working_file !== $file_path && file_exists( $working_file ) ) {
				wp_delete_file( $working_file );
			}
			self::cleanup_staging_tables( $import_id );
			$state['status'] = 'cancelled';
			return $state;
		}

		$start_time         = microtime( true );
		$max_execution_time = Import_Runner::get_chunk_time_budget();
		$statements_run     = 0;
		$rows_batch         = 0;
		$is_eof             = false;

		$current_table = (string) ( $state['current_table'] ?? '' );

		while ( ! feof( $handle ) ) {
			if ( 0 === ( $statements_run % 10 ) && false !== get_transient( 'burst_import_cancelled_' . $import_id ) ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $handle );
				if ( $working_file !== $file_path && file_exists( $working_file ) ) {
					wp_delete_file( $working_file );
				}
				self::cleanup_staging_tables( $import_id );
				$state['status'] = 'cancelled';
				return $state;
			}

			if ( ( microtime( true ) - $start_time ) >= $max_execution_time ) {
				break;
			}

			$statement = $this->read_next_statement( $handle );
			if ( '' === $statement ) {
				if ( feof( $handle ) ) {
					$is_eof = true;
				}
				continue;
			}

			// Only process INSERT statements. Any DROP, CREATE, ALTER, SET, LOCK, etc. are ignored.
			if ( ! preg_match( '/^INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-zA-Z0-9_]+)`?(?:\s*\(([^)]+)\))?\s*VALUES\s*(.+);?$/is', trim( $statement ), $matches ) ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			$table_raw  = $matches[1];
			$cols_raw   = $matches[2];
			$values_raw = $matches[3];

			// Validate table against allowlist.
			if ( ! preg_match( '/(?:^|[a-zA-Z0-9_]*_)?(burst_[a-zA-Z0-9_]+)$/i', $table_raw, $tm ) ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			$base_table     = strtolower( $tm[1] );
			$allowed_tables = $this->get_allowed_tables();
			if ( ! isset( $allowed_tables[ $base_table ] ) || 'burst_imports' === $base_table ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			$table_base = preg_replace( '/^burst_/i', '', $base_table );
			$stg_table  = $wpdb->prefix . 'burst_staging_' . $import_id . '_' . $table_base;
			$live_table = $wpdb->prefix . $base_table;

			$current_table = $stg_table;

			// Ensure staging table exists based on local live schema.
			if ( ! $this->ensure_staging_table( $stg_table, $live_table ) ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			$live_cols = $this->get_live_columns( $live_table );
			if ( empty( $live_cols ) ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			if ( ! empty( $cols_raw ) ) {
				$statement_cols = array_map(
					static fn( $c ) => trim( str_replace( '`', '', $c ) ),
					explode( ',', $cols_raw )
				);
			} else {
				$statement_cols = $live_cols;
			}

			$valid_col_indexes = [];
			$target_cols       = [];
			foreach ( $statement_cols as $idx => $col_name ) {
				if ( in_array( $col_name, $live_cols, true ) ) {
					$valid_col_indexes[] = $idx;
					$target_cols[]       = $col_name;
				}
			}

			if ( empty( $target_cols ) ) {
				$state['skipped_statements'] = (int) ( $state['skipped_statements'] ?? 0 ) + 1;
				continue;
			}

			$parsed_rows = $this->parse_values_tuples( $values_raw );
			if ( empty( $parsed_rows ) ) {
				continue;
			}

			$escaped_target_cols = '`' . implode( '`, `', $target_cols ) . '`';
			$batches             = array_chunk( $parsed_rows, 100 );
			$filter_cols         = count( $valid_col_indexes ) !== count( $statement_cols );

			foreach ( $batches as $batch ) {
				$placeholders = [];
				$params       = [];

				foreach ( $batch as $row ) {
					if ( $filter_cols ) {
						$row_vals = [];
						foreach ( $valid_col_indexes as $v_idx ) {
							$row_vals[] = $row[ $v_idx ] ?? null;
						}
					} else {
						$row_vals = $row;
					}

					$row_placeholders = [];
					foreach ( $row_vals as $val ) {
						if ( null === $val ) {
							$row_placeholders[] = 'NULL';
						} elseif ( is_int( $val ) ) {
							$row_placeholders[] = '%d';
							$params[]           = $val;
						} elseif ( is_float( $val ) ) {
							$row_placeholders[] = '%f';
							$params[]           = $val;
						} else {
							$row_placeholders[] = '%s';
							$params[]           = (string) $val;
						}
					}
					$placeholders[] = '(' . implode( ', ', $row_placeholders ) . ')';
				}

				$insert_sql = "INSERT INTO `{$stg_table}` ({$escaped_target_cols}) VALUES " . implode( ', ', $placeholders );
				if ( ! empty( $params ) ) {
					// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
					$insert_sql = $wpdb->prepare( $insert_sql, $params );
				}

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
				$wpdb->query( $insert_sql );
			}

			$rows_batch += count( $parsed_rows );
			++$statements_run;
		}

		$new_offset = ftell( $handle );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		$state['file_offset']  = $new_offset;
		$state['staging_rows'] = (int) ( $state['staging_rows'] ?? 0 ) + $rows_batch;
		if ( ! empty( $current_table ) ) {
			$clean_display = preg_replace( '/^.*_staging_\d+_/i', '', $current_table );
			// translators: %s: Name of the staging database table being processed.
			$state['current_table'] = sprintf( __( 'Staging: %s', 'burst-statistics' ), $clean_display );
		}

		if ( $is_eof || $this->feof_check( $working_file, $new_offset ) ) {
			// Clean up working file if different from original file.
			if ( $working_file !== $file_path && file_exists( $working_file ) ) {
				wp_delete_file( $working_file );
			}

			// Transition to merging phase.
			$state['phase']         = 'merging';
			$state['merge_step']    = 'init';
			$state['merge_offset']  = 0;
			$state['status']        = 'processing';
			$state['current_table'] = __( 'Staging complete. Preparing historical merge...', 'burst-statistics' );
		} else {
			$state['status'] = 'processing';
		}

		return $state;
	}

	/**
	 * Execute a relational merge chunk from staging tables into live tables.
	 *
	 * Filters records to import ONLY data prior to the current site's Burst activation cutoff.
	 * Tags visitor UIDs with imp{import_id}- to enable clean atomic rollback.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $state Batch state.
	 * @return array<string, mixed>
	 */
	private function execute_merge_step( int $import_id, array $state ): array {
		global $wpdb;

		if ( get_transient( 'burst_import_cancelled_' . $import_id ) ) {
			self::cleanup_staging_tables( $import_id );
			$state['status'] = 'cancelled';
			return $state;
		}

		$cutoff_info = Import_Manager::get_burst_tracking_start();
		$cutoff_ts   = (int) $cutoff_info['timestamp'];

		$stg_stats = $wpdb->prefix . 'burst_staging_' . $import_id . '_statistics';
		$stg_sess  = $wpdb->prefix . 'burst_staging_' . $import_id . '_sessions';
		$stg_uids  = $wpdb->prefix . 'burst_staging_' . $import_id . '_uids';
		$map_table = $wpdb->prefix . 'burst_staging_' . $import_id . '_id_map';

		$has_stats = self::table_exists( $stg_stats );

		if ( ! $has_stats ) {
			self::cleanup_staging_tables( $import_id );
			$state['status']        = 'completed';
			$state['merge_step']    = 'done';
			$state['current_table'] = __( 'No statistics table found in backup archive.', 'burst-statistics' );
			return $state;
		}

		// Count the pre-cutoff statistics rows once and cache it in state, instead
		// of re-running COUNT(*) on every chunk.
		$pre_cutoff_count = (int) ( $state['merge_total'] ?? -1 );
		if ( 0 > $pre_cutoff_count ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$pre_cutoff_count = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT COUNT(*) FROM `{$stg_stats}` WHERE `time` < %d", $cutoff_ts )
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$state['merge_total'] = $pre_cutoff_count;
		}

		if ( 0 === $pre_cutoff_count ) {
			self::cleanup_staging_tables( $import_id );
			$state['status']              = 'completed';
			$state['merge_step']          = 'done';
			$state['rows_processed']      = 0;
			$state['pageviews_processed'] = 0;
			$state['current_table']       = sprintf(
				// translators: 1: site activation formatted date.
				__( 'All detected records in this backup were logged after Burst began tracking (%1$s). No prior historical data was imported.', 'burst-statistics' ),
				$cutoff_info['formatted']
			);
			return $state;
		}

		$state['total_to_merge'] = $pre_cutoff_count;
		$step                    = (string) ( $state['merge_step'] ?? 'init' );
		$step_initial            = $step;
		$start_time              = microtime( true );
		$time_budget             = Import_Runner::get_chunk_time_budget();

		if ( 'init' === $step ) {
			// 1. Run schema installation/upgrades to ensure modern schema on live tables before merge.
			do_action( 'burst_install_tables' );

			// 2. Ensure persistent database staging map table exists.
			$this->ensure_map_table( $map_table );

			$step                            = 'dictionaries';
			$state['merge_step']             = 'dictionaries';
			$state['merge_uids_last_id']     = 0;
			$state['merge_sessions_last_id'] = 0;
			$state['dict_done']              = [];
			$state['dict_last']              = [];
		}

		if ( 'dictionaries' === $step ) {
			// Merge the dimension dictionaries (browsers, platforms, devices,
			// locations, ...) and build id-maps before sessions/statistics so
			// their foreign keys can be remapped.
			if ( ! $this->merge_dimension_dictionaries( $import_id, $map_table, $state, $start_time, $time_budget ) ) {
				$state['status']        = 'processing';
				$state['current_table'] = __( 'Merging dimensions...', 'burst-statistics' );
				return $state;
			}

			$step                        = 'uids';
			$state['merge_step']         = 'uids';
			$state['merge_uids_last_id'] = 0;
		}

		if ( 'uids' === $step ) {
			$has_uids = self::table_exists( $stg_uids );
			if ( $has_uids ) {
				$last_uid_id = (int) ( $state['merge_uids_last_id'] ?? 0 );
				$batch_limit = 1000;

				while ( ( microtime( true ) - $start_time ) < $time_budget ) {
					// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$uids_batch = $wpdb->get_results(
						$wpdb->prepare(
							"SELECT ID, uid FROM `{$stg_uids}` WHERE ID > %d ORDER BY ID ASC LIMIT %d",
							$last_uid_id,
							$batch_limit
						),
						ARRAY_A
					);
					// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

					if ( empty( $uids_batch ) ) {
						$step                            = 'sessions';
						$state['merge_step']             = 'sessions';
						$state['merge_sessions_last_id'] = 0;
						break;
					}

					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'START TRANSACTION' );
					$uid_pairs = [];
					foreach ( $uids_batch as $u ) {
						$old_id      = (int) $u['ID'];
						$raw_uid     = (string) ( $u['uid'] ?? '' );
						$tagged_uid  = "imp{$import_id}-" . substr( $raw_uid, 0, 50 );
						$live_uid_id = $this->resolve_uid_id( $tagged_uid );

						$uid_pairs[ $old_id ] = $live_uid_id;
						$last_uid_id          = $old_id;
					}
					$this->record_id_mappings( $map_table, 'uid', $uid_pairs );
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'COMMIT' );

					$state['merge_uids_last_id'] = $last_uid_id;

					if ( count( $uids_batch ) < $batch_limit ) {
						$step                            = 'sessions';
						$state['merge_step']             = 'sessions';
						$state['merge_sessions_last_id'] = 0;
						break;
					}
				}

				if ( 'uids' === $state['merge_step'] ) {
					$state['status']        = 'processing';
					$state['current_table'] = __( 'Mapping visitor identifiers...', 'burst-statistics' );
					return $state;
				}
			} else {
				$step                            = 'sessions';
				$state['merge_step']             = 'sessions';
				$state['merge_sessions_last_id'] = 0;
			}
		}

		if ( 'sessions' === $step ) {
			$has_sess = self::table_exists( $stg_sess );
			if ( $has_sess ) {
				$last_sess_id       = (int) ( $state['merge_sessions_last_id'] ?? 0 );
				$batch_limit        = 1000;
				$live_sess_cols     = array_flip( $this->get_live_columns( $wpdb->prefix . 'burst_sessions' ) );
				$has_stats_table    = self::table_exists( $stg_stats );
				$has_stats_referrer = $has_stats_table && $this->column_exists( $stg_stats, 'referrer' );
				$geo_cache          = [];

				while ( ( microtime( true ) - $start_time ) < $time_budget ) {
					// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$sess_batch = $wpdb->get_results(
						$wpdb->prepare(
							"SELECT * FROM `{$stg_sess}`
							 WHERE ( `start_time` < %d OR `start_time` = 0 OR `start_time` IS NULL )
							   AND `ID` > %d
							 ORDER BY `ID` ASC LIMIT %d",
							$cutoff_ts,
							$last_sess_id,
							$batch_limit
						),
						ARRAY_A
					);
					// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

					if ( empty( $sess_batch ) ) {
						$step                  = 'statistics';
						$state['merge_step']   = 'statistics';
						$state['merge_offset'] = 0;
						break;
					}

					$old_uids = array_filter( array_unique( array_column( $sess_batch, 'uid_id' ) ), static fn( $val ) => (int) $val > 0 );
					$uid_map  = $this->fetch_id_map( $map_table, 'uid', $old_uids );

					// Dimension id-maps for this batch, so device/browser/platform
					// foreign keys point at the destination's dictionaries.
					$b_map  = $this->fetch_id_map( $map_table, 'browser', array_filter( array_unique( array_column( $sess_batch, 'browser_id' ) ), static fn( $v ) => (int) $v > 0 ) );
					$bv_map = $this->fetch_id_map( $map_table, 'browser_version', array_filter( array_unique( array_column( $sess_batch, 'browser_version_id' ) ), static fn( $v ) => (int) $v > 0 ) );
					$p_map  = $this->fetch_id_map( $map_table, 'platform', array_filter( array_unique( array_column( $sess_batch, 'platform_id' ) ), static fn( $v ) => (int) $v > 0 ) );
					$d_map  = $this->fetch_id_map( $map_table, 'device', array_filter( array_unique( array_column( $sess_batch, 'device_id' ) ), static fn( $v ) => (int) $v > 0 ) );
					$g_map  = $this->fetch_id_map( $map_table, 'goal', array_filter( array_unique( array_column( $sess_batch, 'goal_id' ) ), static fn( $v ) => (int) $v > 0 ) );

					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'START TRANSACTION' );
					$sess_pairs = [];
					foreach ( $sess_batch as $sess ) {
						$old_sess_id = (int) $sess['ID'];
						$old_uid_id  = (int) ( $sess['uid_id'] ?? 0 );
						$new_uid_id  = $uid_map[ $old_uid_id ] ?? 0;

						// Legacy column mapping: country_code -> city_code via burst_locations.
						$city_code    = (int) ( $sess['city_code'] ?? 0 );
						$country_code = (string) ( $sess['country_code'] ?? '' );
						if ( 0 === $city_code && '' !== $country_code ) {
							if ( isset( $geo_cache[ $country_code ] ) ) {
								$city_code = $geo_cache[ $country_code ];
							} else {
								// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
								$loc_city                   = (int) $wpdb->get_var(
									$wpdb->prepare(
										"SELECT city_code FROM {$wpdb->prefix}burst_locations WHERE country_code = %s AND city_code < 0 ORDER BY city_code ASC LIMIT 1",
										$country_code
									)
								);
								$geo_cache[ $country_code ] = $loc_city;
								$city_code                  = $loc_city;
							}
						}

						// Legacy column mapping: referrer in statistics -> sessions.referrer.
						$referrer = (string) ( $sess['referrer'] ?? '' );
						if ( '' === $referrer && $has_stats_referrer ) {
							// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
							$stat_ref = (string) $wpdb->get_var(
								$wpdb->prepare(
									"SELECT referrer FROM `{$stg_stats}` WHERE session_id = %d AND referrer != '' AND referrer IS NOT NULL ORDER BY time ASC LIMIT 1",
									$old_sess_id
								)
							);
							// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
							if ( '' !== $stat_ref ) {
								$referrer = $stat_ref;
							}
						}

						$session_data = [
							'uid_id'             => $new_uid_id,
							'start_time'         => (int) ( $sess['start_time'] ?? 0 ),
							'bounce'             => isset( $sess['bounce'] ) ? (int) $sess['bounce'] : 1,
							'first_time_visit'   => (int) ( $sess['first_time_visit'] ?? 0 ),
							'browser_id'         => $b_map[ (int) ( $sess['browser_id'] ?? 0 ) ] ?? 0,
							'browser_version_id' => $bv_map[ (int) ( $sess['browser_version_id'] ?? 0 ) ] ?? 0,
							'platform_id'        => $p_map[ (int) ( $sess['platform_id'] ?? 0 ) ] ?? 0,
							'device_id'          => $d_map[ (int) ( $sess['device_id'] ?? 0 ) ] ?? 0,
							'country_code'       => $country_code,
							'city_code'          => $city_code,
							'host'               => (string) ( $sess['host'] ?? '' ),
							'referrer'           => $referrer,
							'source'             => (string) ( $sess['source'] ?? '' ),
							'source_category'    => (string) ( $sess['source_category'] ?? '' ),
							'source_mapped'      => isset( $sess['source_mapped'] ) ? (int) $sess['source_mapped'] : 0,
							'has_pageview'       => isset( $sess['has_pageview'] ) ? (int) $sess['has_pageview'] : 1,
							'goal_id'            => $g_map[ (int) ( $sess['goal_id'] ?? 0 ) ] ?? 0,
							'first_visited_url'  => (string) ( $sess['first_visited_url'] ?? '' ),
							'last_visited_url'   => (string) ( $sess['last_visited_url'] ?? '' ),
						];

						// Track dropped columns not present in live schema.
						foreach ( $session_data as $k => $v ) {
							if ( ! isset( $live_sess_cols[ $k ] ) ) {
								$col_key                              = "burst_sessions.{$k}";
								$state['dropped_columns'][ $col_key ] = (int) ( $state['dropped_columns'][ $col_key ] ?? 0 ) + 1;
							}
						}

						// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
						$wpdb->insert(
							$wpdb->prefix . 'burst_sessions',
							array_intersect_key( $session_data, $live_sess_cols )
						);
						$new_sess_id                = (int) $wpdb->insert_id;
						$sess_pairs[ $old_sess_id ] = $new_sess_id;
						$last_sess_id               = $old_sess_id;
					}
					$this->record_id_mappings( $map_table, 'session', $sess_pairs );
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'COMMIT' );

					$state['merge_sessions_last_id'] = $last_sess_id;

					if ( count( $sess_batch ) < $batch_limit ) {
						$step                  = 'statistics';
						$state['merge_step']   = 'statistics';
						$state['merge_offset'] = 0;
						break;
					}
				}

				if ( 'sessions' === $state['merge_step'] ) {
					$state['status']        = 'processing';
					$state['current_table'] = __( 'Merging visitor sessions...', 'burst-statistics' );
					return $state;
				}
			} else {
				$step                  = 'statistics';
				$state['merge_step']   = 'statistics';
				$state['merge_offset'] = 0;
			}
		}

		if ( 'init' === $step_initial || 'uids' === $step_initial || 'sessions' === $step_initial ) {
			if ( 'statistics' === $state['merge_step'] ) {
				$state['status']        = 'processing';
				$state['current_table'] = __( 'Merging statistics...', 'burst-statistics' );
				return $state;
			}
		}

		// Step: statistics. Keyset-paginate on the primary key (no O(n^2) OFFSET),
		// process several batches per call within the time budget, and write each
		// batch as one multi-row INSERT inside a transaction instead of a query
		// per row.
		$last_stat_id    = (int) ( $state['merge_stats_last_id'] ?? 0 );
		$processed_total = (int) ( $state['merge_offset'] ?? 0 );
		$batch_limit     = 1000;
		$live_stats_cols = array_flip( $this->get_live_columns( $wpdb->prefix . 'burst_statistics' ) );
		$live_table      = $wpdb->prefix . 'burst_statistics';
		$reached_end     = false;

		// Insert only the fields we synthesize that also exist in the live schema
		// (mirrors the previous array_intersect_key filter), never the full column
		// list, so we don't force NULL into columns we don't set.
		$stat_field_keys = [ 'page_url', 'time', 'time_on_page', 'referrer', 'session_id', 'uid_id', 'parameters', 'page_id', 'page_type', 'device_resolution_id', 'status', 'max_scroll' ];
		$target_cols     = array_values( array_filter( $stat_field_keys, static fn( $c ) => isset( $live_stats_cols[ $c ] ) ) );

		// Only record the (large) old->new statistics id-map when the backup has
		// per-hit tables that reference statistic_id (campaigns, parameters, site
		// searches); otherwise skip that cost entirely.
		if ( ! isset( $state['need_stat_map'] ) ) {
			$state['need_stat_map'] = $this->has_statistic_linked_data( $import_id );
		}
		$need_stat_map = (bool) $state['need_stat_map'];

		// Lazily-resolved tagged "unknown imported visitor" for hits whose
		// referenced uid no longer exists; the imp{id}- tag keeps them
		// rollback-safe. Resolved only when the first orphan is encountered.
		$orphan_uid_id = 0;

		while ( ( microtime( true ) - $start_time ) < $time_budget ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$stats_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM `{$stg_stats}` WHERE `time` < %d AND `ID` > %d ORDER BY `ID` ASC LIMIT %d",
					$cutoff_ts,
					$last_stat_id,
					$batch_limit
				),
				ARRAY_A
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			$batch_count = is_array( $stats_rows ) ? count( $stats_rows ) : 0;
			if ( 0 === $batch_count ) {
				$reached_end = true;
				break;
			}

			$needed_sess_ids = array_filter( array_unique( array_column( $stats_rows, 'session_id' ) ), static fn( $val ) => (int) $val > 0 );
			$batch_sess_map  = $this->fetch_id_map( $map_table, 'session', $needed_sess_ids );

			$needed_uid_ids = array_filter( array_unique( array_column( $stats_rows, 'uid_id' ) ), static fn( $val ) => (int) $val > 0 );
			$batch_uid_map  = $this->fetch_id_map( $map_table, 'uid', $needed_uid_ids );

			// Negative page_ids reference the source burst_page_urls dictionary;
			// map them to the destination's signed page_id (see the page_urls
			// dictionary merge). Positive page_ids are WP post ids kept as-is.
			$needed_pageurl_ids = [];
			foreach ( $stats_rows as $prow ) {
				$ppid = (int) ( $prow['page_id'] ?? 0 );
				if ( $ppid < 0 ) {
					$needed_pageurl_ids[ -$ppid ] = true;
				}
			}
			$batch_pageurl_map = empty( $needed_pageurl_ids ) ? [] : $this->fetch_id_map( $map_table, 'page_url', array_keys( $needed_pageurl_ids ) );

			$insert_buffer  = [];
			$old_ids_buffer = [];

			foreach ( $stats_rows as $row ) {
				$last_stat_id = (int) ( $row['ID'] ?? $last_stat_id );

				$old_session_id = (int) ( $row['session_id'] ?? 0 );
				$mapped_session = 0;
				if ( $old_session_id > 0 ) {
					if ( isset( $batch_sess_map[ $old_session_id ] ) ) {
						$mapped_session = $batch_sess_map[ $old_session_id ];
					} else {
						// Orphaned session reference (session pruned, or created
						// after the sessions table was dumped in a non-atomic live
						// export): import the hit without a session instead of
						// aborting the whole import.
						$state['orphan_session_refs'] = (int) ( $state['orphan_session_refs'] ?? 0 ) + 1;
					}
				}

				$old_uid_id = (int) ( $row['uid_id'] ?? 0 );
				$mapped_uid = 0;
				if ( $old_uid_id > 0 ) {
					if ( isset( $batch_uid_map[ $old_uid_id ] ) ) {
						$mapped_uid = $batch_uid_map[ $old_uid_id ];
					} elseif ( ! empty( $row['uid'] ) ) {
						$tagged_uid = "imp{$import_id}-" . substr( (string) $row['uid'], 0, 50 );
						$mapped_uid = $this->resolve_uid_id( $tagged_uid );
					} else {
						// Orphaned visitor reference (uid pruned from the dictionary,
						// or created after the uids table was dumped in a non-atomic
						// live export): attribute the hit to a tagged "unknown
						// imported visitor" so it is still imported and remains
						// rollback-safe, instead of aborting the whole import.
						if ( 0 === $orphan_uid_id ) {
							$orphan_uid_id = $this->resolve_uid_id( "imp{$import_id}-unknown" );
						}
						$mapped_uid               = $orphan_uid_id;
						$state['orphan_uid_refs'] = (int) ( $state['orphan_uid_refs'] ?? 0 ) + 1;
					}
				} elseif ( ! empty( $row['uid'] ) ) {
					$tagged_uid = "imp{$import_id}-" . substr( (string) $row['uid'], 0, 50 );
					$mapped_uid = $this->resolve_uid_id( $tagged_uid );
				}

				$raw_page_id    = (int) ( $row['page_id'] ?? 0 );
				$mapped_page_id = $raw_page_id < 0 ? (int) ( $batch_pageurl_map[ -$raw_page_id ] ?? 0 ) : $raw_page_id;

				$stats_data = [
					'page_url'             => (string) ( $row['page_url'] ?? '/' ),
					'time'                 => (int) ( $row['time'] ?? 0 ),
					'time_on_page'         => (int) ( $row['time_on_page'] ?? 0 ),
					'referrer'             => (string) ( $row['referrer'] ?? '' ),
					'session_id'           => $mapped_session,
					'uid_id'               => $mapped_uid,
					'parameters'           => (string) ( $row['parameters'] ?? '' ),
					'page_id'              => $mapped_page_id,
					'page_type'            => (string) ( $row['page_type'] ?? '' ),
					'device_resolution_id' => (int) ( $row['device_resolution_id'] ?? 0 ),
					'status'               => (int) ( $row['status'] ?? 200 ),
					'max_scroll'           => (int) ( $row['max_scroll'] ?? 0 ),
				];

				// Track dropped columns not present in live statistics schema.
				foreach ( $stats_data as $k => $v ) {
					if ( ! isset( $live_stats_cols[ $k ] ) ) {
						$col_key                              = "burst_statistics.{$k}";
						$state['dropped_columns'][ $col_key ] = (int) ( $state['dropped_columns'][ $col_key ] ?? 0 ) + 1;
					}
				}

				$insert_buffer[]  = array_intersect_key( $stats_data, $live_stats_cols );
				$old_ids_buffer[] = (int) ( $row['ID'] ?? 0 );
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query( 'START TRANSACTION' );
			$new_stat_ids = $this->bulk_insert_rows( $live_table, $target_cols, $insert_buffer );
			if ( $need_stat_map ) {
				$stat_pairs = [];
				foreach ( $new_stat_ids as $i => $new_id ) {
					$old = $old_ids_buffer[ $i ] ?? 0;
					if ( $old > 0 ) {
						$stat_pairs[ $old ] = (int) $new_id;
					}
				}
				$this->record_id_mappings( $map_table, 'statistic', $stat_pairs );
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query( 'COMMIT' );

			$processed_total             += $batch_count;
			$state['merge_stats_last_id'] = $last_stat_id;
			$state['merge_offset']        = $processed_total;
			$state['rows_processed']      = $processed_total;
			$state['pageviews_processed'] = $processed_total;

			if ( $batch_count < $batch_limit ) {
				$reached_end = true;
				break;
			}
		}

		$state['current_table'] = sprintf(
			// translators: 1: processed records, 2: total pre-cutoff records.
			__( 'Merging %1$s of %2$s historical records...', 'burst-statistics' ),
			number_format_i18n( $processed_total ),
			number_format_i18n( $pre_cutoff_count )
		);

		if ( ! ( $reached_end || $processed_total >= $pre_cutoff_count ) ) {
			$state['status'] = 'processing';
			return $state;
		}

		// Statistics done — move on to the per-hit tables that reference
		// statistic_id (campaigns, parameters, site searches).
		$state['merge_step'] = 'features';

		if ( ! $this->merge_statistic_linked_tables( $import_id, $map_table, $state, $start_time, $time_budget ) ) {
			$state['status']        = 'processing';
			$state['current_table'] = __( 'Merging campaigns and searches...', 'burst-statistics' );
			return $state;
		}

			// Everything merged. Clean up staging tables and finalize.
			self::cleanup_staging_tables( $import_id );
			$this->finalize_import_state( $import_id );

			$state['status']     = 'completed';
			$state['merge_step'] = 'done';

			$orphan_uids     = (int) ( $state['orphan_uid_refs'] ?? 0 );
			$orphan_sessions = (int) ( $state['orphan_session_refs'] ?? 0 );
		if ( $orphan_uids > 0 || $orphan_sessions > 0 ) {
			$state['current_table'] = sprintf(
			// translators: 1: number of hits with an unknown visitor, 2: number of hits with an unknown session.
				__( 'Merge completed. %1$s hits referenced a visitor and %2$s a session that no longer exist; they were imported as anonymous.', 'burst-statistics' ),
				number_format_i18n( $orphan_uids ),
				number_format_i18n( $orphan_sessions )
			);
		} else {
			$state['current_table'] = __( 'Merge completed successfully', 'burst-statistics' );
		}

		return $state;
	}

	/**
	 * Get allowlisted Burst table base names (without prefix).
	 *
	 * Excludes burst_imports and non-Burst tables.
	 *
	 * @return array<string, bool> Map of allowed table names to true.
	 */
	private function get_allowed_tables(): array {
		$raw = apply_filters(
			'burst_all_tables',
			[
				'burst_statistics',
				'burst_sessions',
				'burst_locations',
				'burst_goals',
				'burst_goal_statistics',
				'burst_browsers',
				'burst_browser_versions',
				'burst_platforms',
				'burst_devices',
				'burst_referrers',
				'burst_uids',
				'burst_page_urls',
				'burst_visitor_bitmaps',
				'burst_query_stats',
				'burst_searches',
				'burst_statistics_searches',
				'burst_search_terms',
				'burst_campaigns',
				'burst_parameters',
			]
		);

		$allowed = [];
		foreach ( (array) $raw as $tbl ) {
			$tbl = (string) $tbl;
			if ( preg_match( '/(?:^|[a-zA-Z0-9_]*_)?(burst_[a-zA-Z0-9_]+)$/i', $tbl, $m ) ) {
				$base = strtolower( $m[1] );
				if ( 'burst_imports' !== $base ) {
					$allowed[ $base ] = true;
				}
			}
		}

		return $allowed;
	}

	/**
	 * Merge the staged dimension dictionaries into their live tables.
	 *
	 * Name-keyed dictionaries (browsers, browser_versions, platforms, devices)
	 * are de-duplicated on their unique name and an old->new ID map is recorded
	 * so session foreign keys can be remapped. Locations are copied preserving
	 * their city_code primary key (globally consistent) with no remap. The work
	 * is time-budgeted and resumable across chunks via per-table cursors in state.
	 *
	 * @param int                  $import_id   Import ID.
	 * @param string               $map_table   Staging id-map table.
	 * @param array<string, mixed> $state       Import state (by reference).
	 * @param float                $start_time  Chunk start time.
	 * @param float                $time_budget Seconds available this chunk.
	 * @return bool True when all dictionaries are merged, false if more remains.
	 */
	private function merge_dimension_dictionaries( int $import_id, string $map_table, array &$state, float $start_time, float $time_budget ): bool {
		global $wpdb;

		// table base => [ natural key column, id-map type ].
		$named_dicts = [
			'browsers'         => [ 'name', 'browser' ],
			'browser_versions' => [ 'name', 'browser_version' ],
			'platforms'        => [ 'name', 'platform' ],
			'devices'          => [ 'name', 'device' ],
			'searches'         => [ 'search', 'search' ],
		];

		foreach ( $named_dicts as $base => $cfg ) {
			if ( ! empty( $state['dict_done'][ $base ] ) ) {
				continue;
			}

			$stg  = $wpdb->prefix . 'burst_staging_' . $import_id . '_' . $base;
			$live = $wpdb->prefix . 'burst_' . $base;
			if ( ! self::table_exists( $stg ) ) {
				$state['dict_done'][ $base ] = true;
				continue;
			}

			$key_col = $cfg[0];
			$type    = $cfg[1];
			$last    = (int) ( $state['dict_last'][ $base ] ?? 0 );

			while ( ( microtime( true ) - $start_time ) < $time_budget ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$rows = $wpdb->get_results(
					$wpdb->prepare(
						"SELECT `ID`, `{$key_col}` AS k FROM `{$stg}` WHERE `ID` > %d ORDER BY `ID` ASC LIMIT %d",
						$last,
						1000
					),
					ARRAY_A
				);
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

				if ( empty( $rows ) ) {
					$state['dict_done'][ $base ] = true;
					break;
				}

				$names = array_values( array_unique( array_map( static fn( $r ) => (string) $r['k'], $rows ) ) );

				// De-duplicating bulk insert of the natural keys.
				$in_ph = implode( ', ', array_fill( 0, count( $names ), '%s' ) );
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO `{$live}` (`{$key_col}`) VALUES (" . implode( '), (', array_fill( 0, count( $names ), '%s' ) ) . ')', $names ) );

				// Resolve the live IDs for those names to build the map.
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				$live_rows = $wpdb->get_results(
					$wpdb->prepare( "SELECT `ID`, `{$key_col}` AS k FROM `{$live}` WHERE `{$key_col}` IN ({$in_ph})", $names ),
					ARRAY_A
				);
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

				$name_to_id = [];
				foreach ( (array) $live_rows as $lr ) {
					$name_to_id[ (string) $lr['k'] ] = (int) $lr['ID'];
				}

				$pairs = [];
				foreach ( $rows as $r ) {
					$old = (int) $r['ID'];
					$nm  = (string) $r['k'];
					if ( isset( $name_to_id[ $nm ] ) ) {
						$pairs[ $old ] = $name_to_id[ $nm ];
					}
					$last = $old;
				}
				$this->record_id_mappings( $map_table, $type, $pairs );
				$state['dict_last'][ $base ] = $last;

				if ( count( $rows ) < 1000 ) {
					$state['dict_done'][ $base ] = true;
					break;
				}
			}

			if ( empty( $state['dict_done'][ $base ] ) ) {
				return false;
			}
		}

		// Locations: preserve the city_code primary key (globally consistent
		// across Burst installs) via a single de-duplicating copy, no remap.
		if ( empty( $state['dict_done']['locations'] ) ) {
			$stg  = $wpdb->prefix . 'burst_staging_' . $import_id . '_locations';
			$live = $wpdb->prefix . 'burst_locations';
			if ( self::table_exists( $stg ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$wpdb->query( "INSERT IGNORE INTO `{$live}` SELECT * FROM `{$stg}`" );
			}
			$state['dict_done']['locations'] = true;
		}

		// Goals: configuration rows with an auto-increment PK and no natural
		// unique key. Remap the goal IDs so sessions.goal_id and
		// burst_goal_statistics.goal_id resolve to the destination's goals, and
		// avoid duplicating a goal that already exists here (matched on
		// title + type + url). Goals tables are tiny, so a single pass is safe.
		if ( empty( $state['dict_done']['goals'] ) ) {
			$stg  = $wpdb->prefix . 'burst_staging_' . $import_id . '_goals';
			$live = $wpdb->prefix . 'burst_goals';
			if ( self::table_exists( $stg ) ) {
				$live_cols   = $this->get_live_columns( $live );
				$insert_cols = array_values( array_filter( $live_cols, static fn( $c ) => 'ID' !== $c ) );

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$existing  = $wpdb->get_results( "SELECT * FROM `{$live}`", ARRAY_A );
				$sig_to_id = [];
				foreach ( (array) $existing as $g ) {
					$sig               = strtolower( trim( (string) ( $g['title'] ?? '' ) ) ) . '|' . (string) ( $g['type'] ?? '' ) . '|' . (string) ( $g['url'] ?? '' );
					$sig_to_id[ $sig ] = (int) $g['ID'];
				}

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$staged = $wpdb->get_results( "SELECT * FROM `{$stg}`", ARRAY_A );
				$pairs  = [];
				foreach ( (array) $staged as $g ) {
					$old = (int) ( $g['ID'] ?? 0 );
					if ( $old <= 0 ) {
						continue;
					}
					$sig = strtolower( trim( (string) ( $g['title'] ?? '' ) ) ) . '|' . (string) ( $g['type'] ?? '' ) . '|' . (string) ( $g['url'] ?? '' );
					if ( isset( $sig_to_id[ $sig ] ) ) {
						$pairs[ $old ] = $sig_to_id[ $sig ];
						continue;
					}
					$data = [];
					foreach ( $insert_cols as $c ) {
						$data[ $c ] = $g[ $c ] ?? null;
					}
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->insert( $live, $data );
					$new_id = (int) $wpdb->insert_id;
					if ( $new_id > 0 ) {
						$pairs[ $old ]     = $new_id;
						$sig_to_id[ $sig ] = $new_id;
						// Track goals this import created (not the ones matched to an
						// existing goal), so rollback can remove exactly those.
						$state['imported_goal_ids'][] = $new_id;
					}
				}
				$this->record_id_mappings( $map_table, 'goal', $pairs );
			}
			$state['dict_done']['goals'] = true;
		}

		// Page URL dictionary. burst_page_urls maps a URL to its WP post id
		// (page_id > 0) or, for URLs without a post, is referenced by a NEGATIVE
		// statistics page_id (-ID). The Pages report hydrates every display URL
		// from this table, never from statistics.page_url, so without it the
		// imported hits show empty slugs. page_url is unique here. We record a
		// map from the source dictionary ID to the destination's SIGNED page_id
		// (the post id when known, else -destinationID) so negative statistics
		// page_ids resolve to the destination dictionary; positive page_ids are
		// WP post ids and, on a same-site restore, need no remap.
		if ( empty( $state['dict_done']['page_urls'] ) ) {
			$stg  = $wpdb->prefix . 'burst_staging_' . $import_id . '_page_urls';
			$live = $wpdb->prefix . 'burst_page_urls';
			if ( ! self::table_exists( $stg ) ) {
				$state['dict_done']['page_urls'] = true;
			} else {
				$live_cols     = array_flip( $this->get_live_columns( $live ) );
				$has_canonical = isset( $live_cols['is_canonical'] );
				$last          = (int) ( $state['dict_last']['page_urls'] ?? 0 );

				while ( ( microtime( true ) - $start_time ) < $time_budget ) {
					// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$rows = $wpdb->get_results(
						$wpdb->prepare( "SELECT * FROM `{$stg}` WHERE `ID` > %d ORDER BY `ID` ASC LIMIT %d", $last, 1000 ),
						ARRAY_A
					);
					// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

					if ( empty( $rows ) ) {
						$state['dict_done']['page_urls'] = true;
						break;
					}

					$urls = array_values( array_filter( array_unique( array_map( static fn( $r ) => (string) ( $r['page_url'] ?? '' ), $rows ) ), static fn( $u ) => '' !== $u ) );

					// Destination rows already present for these URLs (url => [ID, page_id]).
					$existing = [];
					if ( ! empty( $urls ) ) {
						$in_ph = implode( ', ', array_fill( 0, count( $urls ), '%s' ) );
						// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
						foreach ( (array) $wpdb->get_results( $wpdb->prepare( "SELECT `ID`, `page_url`, `page_id` FROM `{$live}` WHERE `page_url` IN ({$in_ph})", $urls ), ARRAY_A ) as $er ) {
							$existing[ (string) $er['page_url'] ] = [ (int) $er['ID'], (int) $er['page_id'] ];
						}
						// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
					}

					// Insert only URLs the destination does not have yet (safe with
					// or without the UNIQUE(page_url) key), then re-resolve their IDs.
					$to_insert = [];
					foreach ( $rows as $r ) {
						$u = (string) ( $r['page_url'] ?? '' );
						if ( '' === $u || isset( $existing[ $u ] ) || isset( $to_insert[ $u ] ) ) {
							continue;
						}
						$ins = [
							'page_url' => $u,
							'page_id'  => (int) ( $r['page_id'] ?? 0 ),
						];
						if ( $has_canonical ) {
							$ins['is_canonical'] = (int) ( $r['is_canonical'] ?? 0 );
						}
						$to_insert[ $u ] = $ins;
					}
					if ( ! empty( $to_insert ) ) {
						$ins_cols = $has_canonical ? [ 'page_url', 'page_id', 'is_canonical' ] : [ 'page_url', 'page_id' ];
						$this->bulk_insert_rows( $live, $ins_cols, array_values( $to_insert ), true );

						$new_urls = array_keys( $to_insert );
						$in_ph2   = implode( ', ', array_fill( 0, count( $new_urls ), '%s' ) );
						// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
						foreach ( (array) $wpdb->get_results( $wpdb->prepare( "SELECT `ID`, `page_url`, `page_id` FROM `{$live}` WHERE `page_url` IN ({$in_ph2})", $new_urls ), ARRAY_A ) as $er ) {
							$existing[ (string) $er['page_url'] ] = [ (int) $er['ID'], (int) $er['page_id'] ];
						}
						// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
					}

					$pairs = [];
					foreach ( $rows as $r ) {
						$old  = (int) ( $r['ID'] ?? 0 );
						$u    = (string) ( $r['page_url'] ?? '' );
						$last = $old;
						if ( $old <= 0 || '' === $u || ! isset( $existing[ $u ] ) ) {
							continue;
						}
						[ $dest_id, $dest_pid ] = $existing[ $u ];
						$pairs[ $old ]          = $dest_pid > 0 ? $dest_pid : -$dest_id;
					}
					$this->record_id_mappings( $map_table, 'page_url', $pairs );
					$state['dict_last']['page_urls'] = $last;

					if ( count( $rows ) < 1000 ) {
						$state['dict_done']['page_urls'] = true;
						break;
					}
				}

				if ( empty( $state['dict_done']['page_urls'] ) ) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Whether the backup staged any per-hit tables that reference statistic_id,
	 * which would require building the old->new statistics id-map.
	 *
	 * @param int $import_id Import ID.
	 */
	private function has_statistic_linked_data( int $import_id ): bool {
		global $wpdb;
		foreach ( [ 'campaigns', 'parameters', 'statistics_searches', 'goal_statistics' ] as $base ) {
			if ( self::table_exists( $wpdb->prefix . 'burst_staging_' . $import_id . '_' . $base ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Merge the per-hit tables that reference statistic_id (campaigns, custom
	 * parameters, site searches) into their live tables, remapping statistic_id
	 * (and search_id) via the id-maps built during the statistics/dictionary
	 * steps. Rows whose referenced hit was not imported (post-cutoff/orphan) are
	 * skipped. Time-budgeted and resumable via per-table cursors in state.
	 *
	 * @param int                  $import_id   Import ID.
	 * @param string               $map_table   Staging id-map table.
	 * @param array<string, mixed> $state       Import state (by reference).
	 * @param float                $start_time  Chunk start time.
	 * @param float                $time_budget Seconds available this chunk.
	 * @return bool True when all such tables are merged, false if more remains.
	 */
	private function merge_statistic_linked_tables( int $import_id, string $map_table, array &$state, float $start_time, float $time_budget ): bool {
		global $wpdb;

		// base => [ candidate columns to insert, extra fk column => id-map type, INSERT IGNORE? ].
		$tables = [
			'campaigns'           => [
				'cols'   => [ 'statistic_id', 'source', 'medium', 'campaign', 'term', 'content' ],
				'fk'     => [],
				'ignore' => false,
			],
			'parameters'          => [
				'cols'   => [ 'statistic_id', 'parameter', 'value' ],
				'fk'     => [],
				'ignore' => false,
			],
			'statistics_searches' => [
				'cols'   => [ 'statistic_id', 'search_id', 'result_count', 'created' ],
				'fk'     => [ 'search_id' => 'search' ],
				'ignore' => true,
			],
			'goal_statistics'     => [
				'cols'   => [ 'statistic_id', 'goal_id' ],
				'fk'     => [ 'goal_id' => 'goal' ],
				'ignore' => true,
			],
		];

		foreach ( $tables as $base => $cfg ) {
			if ( ! empty( $state['feature_done'][ $base ] ) ) {
				continue;
			}

			$stg  = $wpdb->prefix . 'burst_staging_' . $import_id . '_' . $base;
			$live = $wpdb->prefix . 'burst_' . $base;
			if ( ! self::table_exists( $stg ) ) {
				$state['feature_done'][ $base ] = true;
				continue;
			}

			$live_cols = array_flip( $this->get_live_columns( $live ) );
			$cols      = array_values( array_filter( $cfg['cols'], static fn( $c ) => isset( $live_cols[ $c ] ) ) );
			if ( empty( $cols ) || ! in_array( 'statistic_id', $cols, true ) ) {
				$state['feature_done'][ $base ] = true;
				continue;
			}

			$last = (int) ( $state['feature_last'][ $base ] ?? 0 );
			while ( ( microtime( true ) - $start_time ) < $time_budget ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$rows = $wpdb->get_results(
					$wpdb->prepare( "SELECT * FROM `{$stg}` WHERE `ID` > %d ORDER BY `ID` ASC LIMIT %d", $last, 1000 ),
					ARRAY_A
				);
				// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

				if ( empty( $rows ) ) {
					$state['feature_done'][ $base ] = true;
					break;
				}

				$stat_ids = array_filter( array_unique( array_column( $rows, 'statistic_id' ) ), static fn( $v ) => (int) $v > 0 );
				$stat_map = $this->fetch_id_map( $map_table, 'statistic', $stat_ids );

				$fk_maps = [];
				foreach ( $cfg['fk'] as $col => $type ) {
					$ids             = array_filter( array_unique( array_column( $rows, $col ) ), static fn( $v ) => (int) $v > 0 );
					$fk_maps[ $col ] = $this->fetch_id_map( $map_table, $type, $ids );
				}

				$buffer = [];
				foreach ( $rows as $r ) {
					$last     = (int) $r['ID'];
					$old_stat = (int) ( $r['statistic_id'] ?? 0 );
					if ( $old_stat <= 0 || ! isset( $stat_map[ $old_stat ] ) ) {
						// The referenced hit was not imported (post-cutoff/orphan): skip.
						continue;
					}

					$out = [];
					foreach ( $cols as $c ) {
						if ( 'statistic_id' === $c ) {
							$out[ $c ] = $stat_map[ $old_stat ];
						} elseif ( isset( $cfg['fk'][ $c ] ) ) {
							$old_fk = (int) ( $r[ $c ] ?? 0 );
							$new_fk = $fk_maps[ $c ][ $old_fk ] ?? 0;
							if ( 0 === $new_fk && $old_fk > 0 ) {
								// Unresolved dictionary reference: skip this row.
								continue 2;
							}
							$out[ $c ] = $new_fk;
						} else {
							$out[ $c ] = $r[ $c ] ?? null;
						}
					}
					$buffer[] = $out;
				}

				if ( ! empty( $buffer ) ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'START TRANSACTION' );
					$this->bulk_insert_rows( $live, $cols, $buffer, $cfg['ignore'] );
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->query( 'COMMIT' );
				}

				$state['feature_last'][ $base ] = $last;
				if ( count( $rows ) < 1000 ) {
					$state['feature_done'][ $base ] = true;
					break;
				}
			}

			if ( empty( $state['feature_done'][ $base ] ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Ensure staging ID mapping table exists.
	 *
	 * @param string $map_table Map table name.
	 */
	private function ensure_map_table( string $map_table ): void {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		$wpdb->query(
			"CREATE TABLE IF NOT EXISTS `{$map_table}` (
				`type` VARCHAR(16) NOT NULL,
				`old_id` BIGINT NOT NULL,
				`new_id` BIGINT NOT NULL,
				PRIMARY KEY (`type`, `old_id`)
			) {$charset_collate};"
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Record many old->new ID mappings in a single multi-row REPLACE, instead of
	 * one query per row.
	 *
	 * @param string          $map_table Full map table name.
	 * @param string          $type      Mapping type ('uid' or 'session').
	 * @param array<int, int> $pairs     old_id => new_id pairs.
	 */
	private function record_id_mappings( string $map_table, string $type, array $pairs ): void {
		global $wpdb;
		if ( empty( $pairs ) ) {
			return;
		}

		foreach ( array_chunk( $pairs, 500, true ) as $chunk ) {
			$placeholders = [];
			$params       = [];
			foreach ( $chunk as $old_id => $new_id ) {
				$placeholders[] = '(%s, %d, %d)';
				$params[]       = $type;
				$params[]       = (int) $old_id;
				$params[]       = (int) $new_id;
			}
			$sql = "REPLACE INTO `{$map_table}` (`type`, `old_id`, `new_id`) VALUES " . implode( ', ', $placeholders );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->query( $wpdb->prepare( $sql, $params ) );
		}
	}

	/**
	 * Insert many rows into a live table with multi-row INSERT statements,
	 * instead of one $wpdb->insert() per row. Values are bound via prepare().
	 *
	 * Returns the auto-increment IDs assigned to the inserted rows, in row order
	 * (a multi-row VALUES insert receives a contiguous auto-increment block in
	 * all InnoDB autoinc lock modes), so callers can build an old->new id map.
	 *
	 * @param string                           $table   Full live table name.
	 * @param array<int, string>               $columns Column names to insert.
	 * @param array<int, array<string, mixed>> $rows    Rows keyed by column name.
	 * @param bool                             $ignore  Use INSERT IGNORE (for tables with a unique key).
	 * @return array<int, int> New IDs in the same order as $rows.
	 */
	private function bulk_insert_rows( string $table, array $columns, array $rows, bool $ignore = false ): array {
		global $wpdb;
		if ( empty( $rows ) || empty( $columns ) ) {
			return [];
		}

		$new_ids      = [];
		$insert_verb  = $ignore ? 'INSERT IGNORE' : 'INSERT';
		$escaped_cols = '`' . implode( '`, `', $columns ) . '`';
		foreach ( array_chunk( $rows, 200 ) as $chunk ) {
			$placeholders = [];
			$params       = [];
			foreach ( $chunk as $row ) {
				$row_ph = [];
				foreach ( $columns as $col ) {
					$val = $row[ $col ] ?? null;
					if ( null === $val ) {
						$row_ph[] = 'NULL';
					} elseif ( is_int( $val ) ) {
						$row_ph[] = '%d';
						$params[] = $val;
					} elseif ( is_float( $val ) ) {
						$row_ph[] = '%f';
						$params[] = $val;
					} else {
						$row_ph[] = '%s';
						$params[] = (string) $val;
					}
				}
				$placeholders[] = '(' . implode( ', ', $row_ph ) . ')';
			}
			$sql = "{$insert_verb} INTO `{$table}` ({$escaped_cols}) VALUES " . implode( ', ', $placeholders );
			if ( ! empty( $params ) ) {
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				$sql = $wpdb->prepare( $sql, $params );
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->query( $sql );

			$first = (int) $wpdb->insert_id;
			$count = count( $chunk );
			for ( $i = 0; $i < $count; $i++ ) {
				$new_ids[] = $first + $i;
			}
		}

		return $new_ids;
	}

	/**
	 * Batch fetch ID mappings from the staging ID map table.
	 *
	 * @param string $map_table Full map table name.
	 * @param string $type      Mapping type ('uid' or 'session').
	 * @param int[]  $old_ids   Array of old IDs to look up.
	 * @return array<int, int> Map of [ old_id => new_id ].
	 */
	private function fetch_id_map( string $map_table, string $type, array $old_ids ): array {
		global $wpdb;

		$old_ids = array_filter( array_unique( array_map( 'intval', $old_ids ) ), static fn( $id ) => $id > 0 );
		if ( empty( $old_ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $old_ids ), '%d' ) );
		$params       = array_merge( [ $type ], $old_ids );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT old_id, new_id FROM `{$map_table}` WHERE `type` = %s AND `old_id` IN ({$placeholders})",
				$params
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		$map = [];
		if ( is_array( $rows ) ) {
			foreach ( $rows as $r ) {
				$map[ (int) $r['old_id'] ] = (int) $r['new_id'];
			}
		}

		return $map;
	}

	/**
	 * Check whether a database table exists.
	 *
	 * Supports both standard persistent tables and temporary tables (which are created
	 * during WordPress PHPUnit test suites when CREATE TABLE is hooked to CREATE TEMPORARY TABLE).
	 * In MySQL, SHOW TABLES never lists temporary tables, so a DESCRIBE fallback is used.
	 *
	 * Impure: the answer changes with every CREATE/DROP in between, so a second
	 * call in the same method must not be folded into the first one's result.
	 *
	 * @phpstan-impure
	 * @param string $table Full table name.
	 */
	public static function table_exists( string $table ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$has_table = (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $has_table ) {
			return true;
		}

		// Fallback for temporary tables (used in PHPUnit where WP converts CREATE TABLE to CREATE TEMPORARY TABLE).
		$suppress = $wpdb->suppress_errors();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$res = $wpdb->query( "DESCRIBE `{$table}`" );
		$wpdb->suppress_errors( $suppress );

		return false !== $res;
	}

	/**
	 * Get the list of column names that currently exist in a live database table.
	 *
	 * Used to filter insert data arrays before calling $wpdb->insert(), so that columns
	 * which have not yet been added by schema upgrades (e.g. 'country_code', 'referrer')
	 * are silently omitted rather than causing a database error.
	 *
	 * @param string $table Full table name (e.g. $wpdb->prefix . 'burst_sessions').
	 * @return string[] Array of column names that exist in the table.
	 */
	private function get_live_columns( string $table ): array {
		global $wpdb;

		if ( isset( self::$live_columns[ $table ] ) ) {
			return self::$live_columns[ $table ];
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_col( "SHOW COLUMNS FROM `{$table}`" );
		if ( empty( $rows ) ) {
			// Not memoised: a missing table may be created later in the import.
			return [];
		}

		self::$live_columns[ $table ] = $rows;
		return $rows;
	}

	/**
	 * Ensure an isolated staging table exists for the import session.
	 *
	 * Uses the local live table structure to create the staging table without executing
	 * schema definitions from the imported file.
	 *
	 * @param string $stg_table  Full staging table name.
	 * @param string $live_table Full live table name.
	 * @return bool True on success, false on failure.
	 */
	private function ensure_staging_table( string $stg_table, string $live_table ): bool {
		global $wpdb;

		if ( isset( self::$staging_tables_ready[ $stg_table ] ) ) {
			return true;
		}

		if ( self::table_exists( $stg_table ) ) {
			self::$staging_tables_ready[ $stg_table ] = true;
			return true;
		}

		if ( ! self::table_exists( $live_table ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$res = $wpdb->query( "CREATE TABLE IF NOT EXISTS `{$stg_table}` LIKE `{$live_table}`" );
		if ( false !== $res ) {
			self::$staging_tables_ready[ $stg_table ] = true;
			return true;
		}

		// Fallback for environments where CREATE TABLE LIKE is restricted or in test suites.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$create_row = $wpdb->get_row( "SHOW CREATE TABLE `{$live_table}`", ARRAY_A );
		if ( ! empty( $create_row['Create Table'] ) ) {
			$create_sql = str_replace( "`{$live_table}`", "`{$stg_table}`", $create_row['Create Table'] );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->query( $create_sql );
		}

		$exists = self::table_exists( $stg_table );
		if ( $exists ) {
			self::$staging_tables_ready[ $stg_table ] = true;
		}
		return $exists;
	}

	/**
	 * Drop all staging tables associated with an import session.
	 *
	 * @param int $import_id Import ID.
	 */
	public static function cleanup_staging_tables( int $import_id ): void {
		global $wpdb;

		if ( $import_id <= 0 ) {
			return;
		}

		$prefix = $wpdb->prefix . 'burst_staging_' . $import_id . '_';

		// The tables are about to go; ensure_staging_table() must probe again.
		foreach ( array_keys( self::$staging_tables_ready ) as $ready_table ) {
			if ( str_starts_with( $ready_table, $prefix ) ) {
				unset( self::$staging_tables_ready[ $ready_table ] );
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$tables = $wpdb->get_col(
			$wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $prefix ) . '%' )
		);

		if ( ! empty( $tables ) && is_array( $tables ) ) {
			foreach ( $tables as $table ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" );
			}
		}

		// Also explicitly drop known staging tables (including temporary staging tables for PHPUnit environments).
		$suffixes = [ 'statistics', 'sessions', 'uids', 'goals', 'options', 'id_map' ];
		foreach ( $suffixes as $suffix ) {
			$tbl = $prefix . $suffix;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "DROP TEMPORARY TABLE IF EXISTS `{$tbl}`" );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "DROP TABLE IF EXISTS `{$tbl}`" );
		}
	}

	/**
	 * Read the next complete SQL statement from the stream.
	 *
	 * @param resource $handle File stream.
	 */
	private function read_next_statement( $handle ): string {
		$statement = '';

		while ( ! feof( $handle ) ) {
			$line = fgets( $handle, 65536 );
			if ( false === $line ) {
				break;
			}

			$trimmed = trim( $line );

			if ( empty( $statement ) ) {
				if ( '' === $trimmed || str_starts_with( $trimmed, '--' ) || str_starts_with( $trimmed, '/*' ) ) {
					continue;
				}
			}

			$statement .= $line;

			if ( str_ends_with( $trimmed, ';' ) ) {
				$stripped = str_replace( "\\'", '', $statement );
				if ( 0 === ( substr_count( $stripped, "'" ) % 2 ) ) {
					return trim( $statement );
				}
			}
		}

		return trim( $statement );
	}

	/**
	 * Parse the VALUES portion of an INSERT statement into an array of row tuples.
	 *
	 * Lexes SQL VALUES literals including escaped quotes (\' and ''), escaped backslashes,
	 * commas within quoted strings, numbers, NULLs, and booleans.
	 *
	 * @param string $values_sql The portion of the INSERT statement after 'VALUES'.
	 * @return array<int, array<int, mixed>> Array of rows with parsed PHP typed values.
	 */
	public function parse_values_tuples( string $values_sql ): array {
		$rows   = [];
		$length = strlen( $values_sql );
		$i      = 0;

		while ( $i < $length ) {
			// Fast-forward to the opening '(' of the next row tuple.
			while ( $i < $length && '(' !== $values_sql[ $i ] ) {
				++$i;
			}

			if ( $i >= $length ) {
				break;
			}

			// Move past '('.
			++$i;

			$current_row = [];
			$current_val = '';
			$in_string   = false;
			$is_quoted   = false;

			while ( $i < $length ) {
				$char = $values_sql[ $i ];

				if ( $in_string ) {
					if ( '\\' === $char ) {
						// Look ahead to escaped character.
						++$i;
						if ( $i < $length ) {
							$escaped = $values_sql[ $i ];
							switch ( $escaped ) {
								case 'n':
									$current_val .= "\n";
									break;
								case 'r':
									$current_val .= "\r";
									break;
								case 't':
									$current_val .= "\t";
									break;
								case '\\':
									$current_val .= '\\';
									break;
								case "'":
									$current_val .= "'";
									break;
								case '"':
									$current_val .= '"';
									break;
								case '0':
									$current_val .= "\0";
									break;
								default:
									$current_val .= $escaped;
									break;
							}
						}
					} elseif ( "'" === $char ) {
						// SQL standard doubled quote escape ('').
						if ( ( $i + 1 ) < $length && "'" === $values_sql[ $i + 1 ] ) {
							$current_val .= "'";
							++$i;
						} else {
							$in_string = false;
						}
					} else {
						$current_val .= $char;
					}
				} elseif ( "'" === $char ) {
					$in_string = true;
					$is_quoted = true;
				} elseif ( ',' === $char ) {
					$current_row[] = self::cast_parsed_value( $current_val, $is_quoted );
					$current_val   = '';
					$is_quoted     = false;
				} elseif ( ')' === $char ) {
					$current_row[] = self::cast_parsed_value( $current_val, $is_quoted );
					$rows[]        = $current_row;
					++$i;
					break;
				} elseif ( ! ctype_space( $char ) ) {
					$current_val .= $char;
				}

				++$i;
			}
		}

		return $rows;
	}

	/**
	 * Convert a parsed SQL literal token into its typed PHP equivalent.
	 *
	 * @param string $val       Raw string token.
	 * @param bool   $is_quoted Whether the token was quoted as a string literal.
	 * @return mixed Typed PHP value (null, int, float, or string).
	 */
	private static function cast_parsed_value( string $val, bool $is_quoted ): mixed {
		if ( $is_quoted ) {
			return $val;
		}

		$trimmed = trim( $val );
		if ( '' === $trimmed || 0 === strcasecmp( $trimmed, 'NULL' ) ) {
			return null;
		}
		if ( 0 === strcasecmp( $trimmed, 'TRUE' ) ) {
			return 1;
		}
		if ( 0 === strcasecmp( $trimmed, 'FALSE' ) ) {
			return 0;
		}
		if ( is_numeric( $trimmed ) && ! str_starts_with( $trimmed, '0x' ) ) {
			if ( false === strpos( $trimmed, '.' ) ) {
				return (int) $trimmed;
			}
			return (float) $trimmed;
		}

		return $trimmed;
	}

	/**
	 * Read preview header chunk from file (.sql, .gz, .zip).
	 *
	 * @param string $file_path File path.
	 * @param int    $bytes     Bytes to read.
	 */
	private function read_file_header( string $file_path, int $bytes = 4096 ): string {
		$filename = strtolower( basename( $file_path ) );

		if ( str_ends_with( $filename, '.sql.gz' ) || str_ends_with( $filename, '.gz' ) ) {
			$gz = gzopen( $file_path, 'rb' );
			if ( false === $gz ) {
				return '';
			}
			$content = gzread( $gz, $bytes );
			gzclose( $gz );
			return (string) $content;
		}

		if ( str_ends_with( $filename, '.zip' ) && class_exists( 'ZipArchive' ) ) {
			$zip = new ZipArchive();
			if ( true === $zip->open( $file_path ) ) {
				$preview_content = '';
				// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				for ( $i = 0; $i < $zip->numFiles; $i++ ) {
					$stat = $zip->statIndex( $i );
					if ( $stat && preg_match( '/\.sql(\.gz)?$/i', (string) $stat['name'] ) ) {
						$stream = $zip->getStream( $stat['name'] );
						if ( $stream ) {
							// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
							$raw = fread( $stream, $bytes * 2 );
							// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
							fclose( $stream );
							$raw_string = false !== $raw ? $raw : '';
							if ( str_ends_with( strtolower( (string) $stat['name'] ), '.gz' ) && function_exists( 'gzdecode' ) ) {
								// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
								$decoded         = @gzdecode( $raw_string );
								$preview_content = false !== $decoded ? $decoded : $raw_string;
							} else {
								$preview_content = $raw_string;
							}
							break;
						}
					}
				}
				$zip->close();
				return $preview_content;
			}
			return '';
		}

		// Plain text SQL.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $file_path, 'rb' );
		if ( false === $handle ) {
			return '';
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		$content = fread( $handle, $bytes );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		return (string) $content;
	}

	/**
	 * Decompress a .gz source into $dest for up to $budget seconds, resuming from
	 * the uncompressed offset persisted in $state['prep_written'].
	 *
	 * Runs across multiple import iterations so a large backup never blocks a
	 * single request long enough to hit a PHP/FPM/proxy timeout, regardless of
	 * size. (Resuming re-inflates from the start of the stream each iteration, so
	 * total decompression cost grows with the number of iterations; with the
	 * default multi-hundred-MB-per-step budget that stays negligible for typical
	 * backups and acceptable well into multi-GB territory.)
	 *
	 * @param string               $src    Source .gz path.
	 * @param string               $dest   Destination uncompressed path.
	 * @param array<string, mixed> $state  Import state (by reference; updates prep_written).
	 * @param float                $budget Seconds to spend this step.
	 * @return bool|null True when EOF reached, false if more work remains, null on error.
	 */
	private function gunzip_step( string $src, string $dest, array &$state, float $budget ): ?bool {
		$written = (int) ( $state['prep_written'] ?? 0 );

		$gz = gzopen( $src, 'rb' );
		if ( false === $gz ) {
			return null;
		}
		if ( $written > 0 ) {
			gzseek( $gz, $written );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$out = fopen( $dest, $written > 0 ? 'ab' : 'wb' );
		if ( false === $out ) {
			gzclose( $gz );
			return null;
		}

		$start = microtime( true );
		$eof   = false;
		while ( true ) {
			if ( gzeof( $gz ) ) {
				$eof = true;
				break;
			}
			$chunk = gzread( $gz, 524288 );
			if ( false === $chunk || '' === $chunk ) {
				$eof = gzeof( $gz );
				break;
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
			fwrite( $out, $chunk );
			$written += strlen( $chunk );
			if ( ( microtime( true ) - $start ) >= $budget ) {
				break;
			}
		}

		gzclose( $gz );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $out );

		$state['prep_written'] = $written;
		return $eof;
	}

	/**
	 * Prepare working uncompressed SQL file.
	 *
	 * @param string $file_path Source file path.
	 * @param int    $import_id Import ID.
	 * @return string Working SQL file path.
	 */
	private function prepare_working_file( string $file_path, int $import_id ): string {
		$filename = strtolower( basename( $file_path ) );

		if ( str_ends_with( $filename, '.sql' ) ) {
			return $file_path;
		}

		$dest_sql = dirname( $file_path ) . '/burst_work_' . $import_id . '.sql';

		if ( str_ends_with( $filename, '.sql.gz' ) || str_ends_with( $filename, '.gz' ) ) {
			$gz = gzopen( $file_path, 'rb' );
			if ( false === $gz ) {
				return '';
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			$out = fopen( $dest_sql, 'wb' );
			if ( false === $out ) {
				gzclose( $gz );
				return '';
			}

			while ( ! gzeof( $gz ) ) {
				$chunk = gzread( $gz, 65536 );
				if ( false === $chunk || '' === $chunk ) {
					break;
				}
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				fwrite( $out, $chunk );
			}

			gzclose( $gz );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $out );

			return $dest_sql;
		}

		if ( str_ends_with( $filename, '.zip' ) && class_exists( 'ZipArchive' ) ) {
			$zip = new ZipArchive();
			if ( true === $zip->open( $file_path ) ) {
				$extract_dir = dirname( $file_path ) . '/burst_extracted_' . $import_id;
				wp_mkdir_p( $extract_dir );
				$zip->extractTo( $extract_dir );
				$zip->close();

				$files = glob( $extract_dir . '/*.sql*' );
				if ( ! empty( $files[0] ) ) {
					$extracted = $files[0];
					if ( str_ends_with( strtolower( $extracted ), '.sql' ) ) {
						// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_copy
						copy( $extracted, $dest_sql );
						wp_delete_file( $extracted );
						return $dest_sql;
					}
					if ( str_ends_with( strtolower( $extracted ), '.gz' ) ) {
						$sub_res = $this->prepare_working_file( $extracted, $import_id );
						wp_delete_file( $extracted );
						return $sub_res;
					}
				}
			}
		}

		return '';
	}

	/**
	 * Finalize import state: update schema, activation time and trigger bitmap refresh.
	 *
	 * @param int $import_id Import ID.
	 */
	private function finalize_import_state( int $import_id ): void {
		global $wpdb;

		// 1. Run table creation/upgrade to ensure any missing columns/tables are installed via dbDelta.
		do_action( 'burst_install_tables' );

		$stats_table = $wpdb->prefix . 'burst_statistics';

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names.
		// 2. If imported dump has legacy 'uid' column in burst_statistics, run the shared uid_id upgrade step.
		if ( $this->column_exists( 'burst_statistics', 'uid' ) ) {
			$db_upgrade = new DB_Upgrade();
			$db_upgrade->upgrade_finalize_uid_id( true );
		}

		// 3. Ensure burst_sessions start_time and uid_id are populated if missing.
		if ( $this->column_exists( 'burst_sessions', 'start_time' ) && $this->column_exists( 'burst_sessions', 'uid_id' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query(
				"UPDATE {$wpdb->prefix}burst_sessions s
				JOIN (
					SELECT session_id, MIN(time) AS start_time,
						COALESCE(MIN(NULLIF(uid_id, 0)), 0) AS uid_id
					FROM {$stats_table}
					WHERE session_id IS NOT NULL AND session_id > 0
					GROUP BY session_id
				) st ON st.session_id = s.ID
				SET s.start_time = st.start_time, s.uid_id = st.uid_id
				WHERE s.start_time = 0 OR s.uid_id = 0"
			);

			$sessions_indexes = [
				[ 'start_time', 'uid_id' ],
				[ 'goal_id' ],
				[ 'city_code' ],
				[ 'browser_id' ],
				[ 'platform_id' ],
				[ 'device_id' ],
				[ 'first_time_visit' ],
				[ 'bounce' ],
			];
			foreach ( $sessions_indexes as $index ) {
				$this->add_index( 'burst_sessions', $index );
			}
		}

		// 4. Update activation time and rebuild bitmaps.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$earliest_time = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT MIN(time) FROM {$stats_table} WHERE uid_id IN (SELECT ID FROM {$wpdb->prefix}burst_uids WHERE uid LIKE %s)",
				"imp{$import_id}-%"
			)
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $earliest_time > 0 ) {
			Import_Manager::extend_data_start( $earliest_time );
		}

		$this->invalidate_caches_after_import();
	}

	/**
	 * Drop exactly the caches the finished import made stale. This used to be
	 * a wp_cache_flush(), which on a persistent object cache empties the
	 * whole site's cache (every plugin's, every option) for one Burst import.
	 *
	 * What the import changed and the cache each change invalidates:
	 * - the live schema (dbDelta via burst_install_tables, the uid_id finalize
	 *   step): the per-process column memo here, the uid_id_active() probe and
	 *   the db_upgrades_complete() probe in the 'burst' group;
	 * - the statistics rows: every Query_Executor result in its result group,
	 *   flushed as a group where the object cache supports it (WP 6.1+ API;
	 *   the common Redis/Memcached drop-ins do). Without group support those
	 *   entries expire by their own TTL (30 seconds for dashboard queries, an
	 *   hour at most), which is what a non-persistent cache did before too.
	 * - the visitor bitmap store: extend_data_start() re-arms the affected
	 *   range through burst_visitor_bitmaps_rebuild_from and the builder bumps
	 *   the bitmap cache generation itself when it rebuilds, so nothing here.
	 */
	private function invalidate_caches_after_import(): void {
		self::$live_columns = [];
		$this->flush_uid_id_active_cache();
		$this->flush_db_upgrades_complete_cache();

		if ( function_exists( 'wp_cache_supports' ) && wp_cache_supports( 'flush_group' ) ) {
			wp_cache_flush_group( Query_Executor::RESULT_CACHE_GROUP );
		}
	}

	/**
	 * Helper to check if file offset reached file size.
	 *
	 * @param string $file_path File path.
	 * @param int    $offset    Current offset.
	 */
	private function feof_check( string $file_path, int $offset ): bool {
		if ( ! file_exists( $file_path ) ) {
			return true;
		}
		return $offset >= filesize( $file_path );
	}
}
