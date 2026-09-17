<?php
namespace Burst\Admin\Import;

use Burst\Admin\Import\Helpers\Rollback_Service;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Import_Runner
 *
 * Coordinates self-scheduling background batch processing for data imports.
 */
class Import_Runner {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Default seconds of work one iteration may perform. Every resumable step
	 * (adapter batches, rollback) measures against this budget so a single REST
	 * chunk or cron tick stays well below PHP's execution limit.
	 */
	const CHUNK_TIME_BUDGET = 2.0;

	/**
	 * Registry statuses the runner keeps iterating on.
	 */
	const ACTIVE_STATUSES = [ 'processing', 'rolling_back' ];

	/**
	 * Get the time budget (seconds) for one import iteration.
	 */
	public static function get_chunk_time_budget(): float {
		/**
		 * Filters the seconds of work a single import iteration may perform.
		 *
		 * @param float $budget Default 2.0.
		 */
		return max( 0.1, (float) apply_filters( 'burst_import_chunk_time_budget', self::CHUNK_TIME_BUDGET ) );
	}

	/**
	 * Run a single background iteration.
	 *
	 * @param int|null $import_id Optional specific import ID to process.
	 * @return array<string, mixed> Progress details.
	 */
	public function run_iteration( ?int $import_id = null ): array {
		if ( ! $this->has_admin_access() && ! wp_doing_cron() ) {
			return [
				'status'     => 'idle',
				'percentage' => 0,
			];
		}

		global $wpdb;

		if ( ! empty( $import_id ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$active_import = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM {$wpdb->prefix}burst_imports WHERE id = %d AND status IN ('processing', 'rolling_back')",
					$import_id
				)
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$active_import = $wpdb->get_row(
				"SELECT * FROM {$wpdb->prefix}burst_imports WHERE status IN ('processing', 'rolling_back') ORDER BY id ASC LIMIT 1"
			);
		}

		if ( ! $active_import ) {
			$transient = get_transient( 'burst_progress_import' );
			return is_array( $transient ) ? $transient : [
				'status'     => 'idle',
				'percentage' => 0,
			];
		}

		// Prevent concurrency between cron and active UI client loop.
		if ( wp_doing_cron() && get_transient( 'burst_ui_import_active_' . $active_import->id ) ) {
			return [
				'import_id'  => (int) $active_import->id,
				'status'     => 'processing',
				'percentage' => 0,
			];
		}

		// Atomic mutex lock using add_option (NX semantics).
		$lock_key = 'burst_import_lock_' . $active_import->id;
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
			$transient = get_transient( 'burst_progress_import' );
			return is_array( $transient ) ? $transient : [
				'status'     => 'processing',
				'percentage' => 0,
			];
		}

		try {
			if ( get_transient( 'burst_import_cancelled_' . $active_import->id ) ) {
				delete_transient( 'burst_progress_import' );
				delete_transient( 'burst_import_cancelled_' . $active_import->id );
				wp_clear_scheduled_hook( 'burst_import_iteration' );
				return [
					'import_id'  => (int) $active_import->id,
					'status'     => 'cancelled',
					'percentage' => 0,
				];
			}

			$state = json_decode( (string) $active_import->settings, true ) ?: [];

			if ( 'rolling_back' === $active_import->status ) {
				// A rollback is driven by the same chunk loop as an import; the
				// service deletes a bounded number of rows per call.
				$updated = ( new Rollback_Service() )->run_step( (int) $active_import->id, $state );
			} else {
				$manager = new Import_Manager();
				$adapter = $manager->get_adapter( $active_import->source );

				if ( null === $adapter ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->update(
						$wpdb->prefix . 'burst_imports',
						[ 'status' => 'failed' ],
						[ 'id' => $active_import->id ]
					);
					return [
						'import_id'  => (int) $active_import->id,
						'status'     => 'failed',
						'percentage' => 0,
					];
				}

				$updated = $adapter->import_batch( (int) $active_import->id, $state );
			}

			// Check if import was cancelled while the batch was executing.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$current_status = $wpdb->get_var(
				$wpdb->prepare( "SELECT status FROM {$wpdb->prefix}burst_imports WHERE id = %d", $active_import->id )
			);
			if ( 'cancelled' === $current_status || 'cancelled' === ( $updated['status'] ?? '' ) || false !== get_transient( 'burst_import_cancelled_' . $active_import->id ) ) {
				delete_transient( 'burst_progress_import' );
				delete_transient( 'burst_import_cancelled_' . $active_import->id );
				wp_clear_scheduled_hook( 'burst_import_iteration' );

				$working_file = (string) ( $updated['working_file'] ?? '' );
				$file_path    = (string) ( $updated['file_path'] ?? '' );
				if ( ! empty( $working_file ) && $working_file !== $file_path && file_exists( $working_file ) ) {
					wp_delete_file( $working_file );
				}

				return [
					'import_id'  => (int) $active_import->id,
					'status'     => 'cancelled',
					'percentage' => 0,
				];
			}

			$status              = $updated['status'] ?? 'processing';
			$rows_processed      = (int) ( $updated['rows_processed'] ?? 0 );
			$pageviews_processed = (int) ( $updated['pageviews_processed'] ?? 0 );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update(
				$wpdb->prefix . 'burst_imports',
				[
					'rows_imported'      => $rows_processed,
					'pageviews_imported' => $pageviews_processed,
					'status'             => $status,
					'settings'           => wp_json_encode( $updated ),
					'completed_at'       => in_array( $status, [ 'completed', 'rolled_back' ], true ) ? time() : null,
				],
				[ 'id' => $active_import->id ]
			);

			// Update progress transient for polling UI.
			$total_expected = (int) ( $state['total_records'] ?? 100 );
			$pct            = $total_expected > 0 ? min( 99, (int) round( ( $rows_processed / $total_expected ) * 100 ) ) : 50;

			if ( in_array( $status, [ 'rolling_back', 'rolled_back' ], true ) ) {
				$pct = Rollback_Service::get_progress_percentage( $updated );
			} elseif ( isset( $updated['phase'] ) && 'preparing' === $updated['phase'] ) {
				// Archive extraction / decompression step, reported for any source.
				$pct = 1;
			} elseif ( 'burst' === $active_import->source && isset( $updated['phase'] ) ) {
				if ( 'staging' === $updated['phase'] ) {
					$staging_rows = (int) ( $updated['staging_rows'] ?? 0 );
					$pct          = min( 45, max( 2, (int) round( ( $staging_rows / max( 1, $total_expected ) ) * 45 ) ) );
				} elseif ( 'merging' === $updated['phase'] ) {
					$total_merge = max( 1, (int) ( $updated['total_to_merge'] ?? 1 ) );
					$merge_off   = (int) ( $updated['merge_offset'] ?? 0 );
					$pct         = 45 + min( 54, (int) round( ( $merge_off / $total_merge ) * 54 ) );
				}
			}

			if ( 'completed' === $status ) {
				$pct = 100;

				$total_imported_rows = (int) ( $updated['rows_processed'] ?? $active_import->rows_imported ?? 0 );
				if ( ! empty( $active_import->period_start ) && $total_imported_rows > 0 ) {
					$start_timestamp = strtotime( (string) $active_import->period_start );
					if ( $start_timestamp > 0 ) {
						Import_Manager::extend_data_start( $start_timestamp );
					}
				}

				// Clean up the uploaded file sandbox now that the import has finished.
				( new Import_Manager() )->cleanup_import_files(
					(string) wp_json_encode( $updated ),
					(int) $active_import->id
				);

				if ( function_exists( '\Burst\burst_loader' ) && isset( \Burst\burst_loader()->admin->tasks ) ) {
					\Burst\burst_loader()->admin->tasks->dismiss_task( 'import_statistics_data' );
				}
			}

			$progress_data = [
				'import_id'     => (int) $active_import->id,
				'source'        => $active_import->source,
				'percentage'    => $pct,
				'status'        => $status,
				'rows'          => $rows_processed,
				'pageviews'     => $pageviews_processed,
				'current_table' => (string) ( $updated['current_table'] ?? '' ),
			];

			if ( 'rolled_back' === $status ) {
				// The rollback is finished: drop the progress transient so the
				// polling UI stops, and hand the client-driven chunk loop a status
				// it exits on. That loop only terminates on completed / failed /
				// cancelled; 'cancelled' is the one that neither announces a
				// finished import nor an error, so it stands in for 'rolled_back'.
				delete_transient( 'burst_progress_import' );
				$progress_data['status'] = 'cancelled';
				$progress_data['phase']  = 'rolled_back';
				return $progress_data;
			}

			if ( 'rolling_back' === $status ) {
				// The UI polls and drives chunks only while it sees 'processing'.
				$progress_data['status'] = 'processing';
				$progress_data['phase']  = 'rolling_back';
			}

			set_transient( 'burst_progress_import', $progress_data, DAY_IN_SECONDS );

			if ( in_array( $status, self::ACTIVE_STATUSES, true ) && ! get_transient( 'burst_ui_import_active_' . $active_import->id ) && ! wp_next_scheduled( 'burst_import_iteration' ) ) {
				wp_schedule_single_event( time() + 2, 'burst_import_iteration' );
			}

			return $progress_data;
		} finally {
			delete_option( $lock_key );
		}
	}
}
