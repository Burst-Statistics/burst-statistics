<?php
namespace Burst\Admin\Import\Helpers;

use Burst\Admin\Import\Adapters\File\Burst_Adapter;
use Burst\Admin\Import\Import_Manager;
use Burst\Admin\Import\Import_Runner;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Rollback_Service
 *
 * Removes an imported analytics dataset again. The work is split into bounded
 * steps (run_step()) so the Import_Runner can drive a rollback through the
 * same REST chunk / cron iteration loop as an import: a PHP timeout in the
 * middle leaves the registry row in 'rolling_back' with a cursor instead of
 * half-deleted data behind a 'completed' status.
 */
class Rollback_Service {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Default uid dictionary rows deleted per query. Bounded to avoid lock
	 * exhaustion and long-held transaction locks.
	 */
	const UID_CHUNK_SIZE = 5000;

	/**
	 * Registry statuses a user-requested rollback is accepted for: terminal
	 * states that may have left imported rows behind. An import that is still
	 * processing (or rolling back) is refused.
	 */
	const ROLLBACKABLE_STATUSES = [ 'completed', 'failed', 'cancelled' ];

	/**
	 * Get the number of uid dictionary rows one deletion query removes.
	 */
	public static function get_uid_chunk_size(): int {
		/**
		 * Filters how many import uid dictionary rows one rollback deletion
		 * query removes (with their sessions and hits).
		 *
		 * @param int $chunk_size Default 5000.
		 */
		return max( 1, (int) apply_filters( 'burst_import_rollback_chunk_size', self::UID_CHUNK_SIZE ) );
	}

	/**
	 * Begin a user-requested rollback of a finished import.
	 *
	 * Marks the registry row 'rolling_back' with a fresh cursor and seeds the
	 * progress transient; the Import_Runner performs the deletion in steps.
	 *
	 * @param int $import_id Registry record ID.
	 * @return array{success: bool, message: string}
	 */
	public function start( int $import_id ): array {
		global $wpdb;

		$import = $this->get_import( $import_id );
		if ( null === $import ) {
			return [
				'success' => false,
				'message' => __( 'Could not roll back this import.', 'burst-statistics' ),
			];
		}

		if ( ! in_array( (string) $import->status, self::ROLLBACKABLE_STATUSES, true ) ) {
			return [
				'success' => false,
				'message' => __( 'Only a finished import can be rolled back. Wait for the import to complete or cancel it first.', 'burst-statistics' ),
			];
		}

		$state = $this->init_rollback_state( $import );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update(
			$wpdb->prefix . 'burst_imports',
			[
				'status'   => 'rolling_back',
				'settings' => wp_json_encode( $state ),
			],
			[ 'id' => $import_id ],
			[ '%s', '%s' ],
			[ '%d' ]
		);

		// The UI polls and drives chunks while it sees 'processing'.
		set_transient(
			'burst_progress_import',
			[
				'import_id'     => $import_id,
				'source'        => (string) $import->source,
				'percentage'    => 0,
				'status'        => 'processing',
				'phase'         => 'rolling_back',
				'rows'          => (int) $import->rows_imported,
				'pageviews'     => (int) $import->pageviews_imported,
				'current_table' => __( 'Rolling back import…', 'burst-statistics' ),
			],
			DAY_IN_SECONDS
		);

		if ( ! wp_next_scheduled( 'burst_import_iteration' ) ) {
			wp_schedule_single_event( time(), 'burst_import_iteration' );
		}

		return [
			'success' => true,
			'message' => __( 'Rollback started in the background.', 'burst-statistics' ),
		];
	}

	/**
	 * Perform one bounded rollback step.
	 *
	 * Deletes uid chunks until the time budget is spent, then finalizes. The
	 * returned state carries 'status' => 'rolling_back' while work remains and
	 * 'rolled_back' once done; the caller persists it (the Import_Runner does
	 * this for the background loop).
	 *
	 * @param int                  $import_id Registry record ID.
	 * @param array<string, mixed> $state Import state (settings JSON) with the rollback cursor.
	 * @param float|null           $deadline microtime() to stop at; null uses the runner's chunk budget.
	 * @return array<string, mixed> Updated state.
	 */
	public function run_step( int $import_id, array $state, ?float $deadline = null ): array {
		if ( null === $deadline ) {
			$deadline = microtime( true ) + Import_Runner::get_chunk_time_budget();
		}

		$rollback = is_array( $state['rollback'] ?? null ) ? $state['rollback'] : [];
		$phase    = (string) ( $rollback['phase'] ?? 'uids' );

		if ( 'uids' === $phase ) {
			$chunk_size = self::get_uid_chunk_size();
			do {
				$result                   = $this->delete_uid_chunk( $import_id, (string) ( $rollback['uid_cursor'] ?? '' ), $chunk_size );
				$rollback['uid_cursor']   = $result['cursor'];
				$rollback['deleted_uids'] = (int) ( $rollback['deleted_uids'] ?? 0 ) + $result['deleted'];
			} while ( $result['deleted'] >= $chunk_size && microtime( true ) < $deadline );

			if ( $result['deleted'] < $chunk_size ) {
				$phase = $this->uid_id_active() ? 'finalize' : 'legacy';
			}
		}

		if ( 'legacy' === $phase && microtime( true ) < $deadline ) {
			$chunk_size = self::get_uid_chunk_size();
			do {
				$deleted = $this->delete_legacy_uid_chunk( $import_id, $chunk_size );
			} while ( $deleted >= $chunk_size && microtime( true ) < $deadline );

			if ( $deleted < $chunk_size ) {
				$phase = 'finalize';
			}
		}

		if ( 'finalize' === $phase ) {
			$this->finalize( $import_id, $state );
			unset( $state['rollback'] );
			$state['status'] = 'rolled_back';
			return $state;
		}

		$rollback['phase']      = $phase;
		$state['rollback']      = $rollback;
		$state['status']        = 'rolling_back';
		$state['current_table'] = __( 'Rolling back import…', 'burst-statistics' );
		return $state;
	}

	/**
	 * Rollback an import synchronously, running steps until done.
	 *
	 * Used where the caller needs the data gone before continuing (cancelling
	 * a running import, tests). User-requested rollbacks go through start().
	 *
	 * @param int $import_id Registry record ID.
	 * @return bool True if rolled back successfully.
	 */
	public function rollback( int $import_id ): bool {
		global $wpdb;

		$import = $this->get_import( $import_id );
		if ( null === $import ) {
			return false;
		}

		$state = $this->init_rollback_state( $import );
		do {
			$state = $this->run_step( $import_id, $state, PHP_FLOAT_MAX );
		} while ( 'rolled_back' !== ( $state['status'] ?? '' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update(
			$wpdb->prefix . 'burst_imports',
			[
				'status'       => 'rolled_back',
				'settings'     => wp_json_encode( $state ),
				'completed_at' => time(),
			],
			[ 'id' => $import_id ],
			[ '%s', '%s', '%d' ],
			[ '%d' ]
		);

		return true;
	}

	/**
	 * Percentage of the rollback done, from the cursor stored in the state.
	 *
	 * @param array<string, mixed> $state Import state.
	 */
	public static function get_progress_percentage( array $state ): int {
		if ( 'rolled_back' === ( $state['status'] ?? '' ) ) {
			return 100;
		}
		$rollback = is_array( $state['rollback'] ?? null ) ? $state['rollback'] : [];
		$total    = (int) ( $rollback['total_uids'] ?? 0 );
		$deleted  = (int) ( $rollback['deleted_uids'] ?? 0 );
		if ( $total <= 0 ) {
			return 50;
		}
		return min( 99, (int) round( ( $deleted / $total ) * 100 ) );
	}

	/**
	 * Load a registry row.
	 *
	 * @param int $import_id Registry record ID.
	 */
	private function get_import( int $import_id ): ?object {
		global $wpdb;

		if ( 0 >= $import_id ) {
			return null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$import = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_imports WHERE id = %d", $import_id )
		);

		return $import ? $import : null;
	}

	/**
	 * Build the import state with a fresh rollback cursor.
	 *
	 * Also drops any staging tables the import left behind and carries the
	 * imported counters into the state so the runner keeps them intact while
	 * it persists progress.
	 *
	 * @param object $import Registry row.
	 * @return array<string, mixed>
	 */
	private function init_rollback_state( object $import ): array {
		global $wpdb;

		$import_id = (int) $import->id;
		Burst_Adapter::cleanup_staging_tables( $import_id );

		$state = json_decode( (string) $import->settings, true );
		$state = is_array( $state ) ? $state : [];

		$state['rows_processed']      = (int) ( $state['rows_processed'] ?? $import->rows_imported ?? 0 );
		$state['pageviews_processed'] = (int) ( $state['pageviews_processed'] ?? $import->pageviews_imported ?? 0 );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$total_uids = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_uids WHERE uid LIKE %s", $this->uid_prefix( $import_id ) )
		);

		$state['rollback'] = [
			'phase'        => 'uids',
			'uid_cursor'   => '',
			'total_uids'   => $total_uids,
			'deleted_uids' => 0,
		];

		return $state;
	}

	/**
	 * LIKE pattern matching every uid this import synthesized.
	 *
	 * @param int $import_id Registry record ID.
	 */
	private function uid_prefix( int $import_id ): string {
		return "imp{$import_id}-%";
	}

	/**
	 * Delete one chunk of import uids with their statistics, sessions and
	 * linked per-hit rows.
	 *
	 * The chunk is read in uid order from the cursor, so the unique uid index
	 * serves it as a range scan and a step resumes exactly where the previous
	 * one stopped.
	 *
	 * @param int    $import_id Registry record ID.
	 * @param string $cursor Last uid deleted by the previous chunk ('' to start).
	 * @param int    $chunk_size Rows per query.
	 * @return array{deleted: int, cursor: string}
	 */
	private function delete_uid_chunk( int $import_id, string $cursor, int $chunk_size ): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, uid FROM {$wpdb->prefix}burst_uids WHERE uid LIKE %s AND uid > %s ORDER BY uid ASC LIMIT %d",
				$this->uid_prefix( $import_id ),
				$cursor,
				$chunk_size
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return [
				'deleted' => 0,
				'cursor'  => $cursor,
			];
		}

		$uid_ids      = array_map( static fn( array $row ): int => (int) $row['ID'], $rows );
		$placeholders = implode( ',', array_fill( 0, count( $uid_ids ), '%d' ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		// Per-hit tables that reference statistic_id (populated by a Burst
		// backup restore). Remove the rows pointing at this import's hits
		// before those statistics rows are deleted, so nothing is orphaned.
		// Existence is probed directly: burst_campaigns / burst_parameters are
		// only added to the table allowlist via a filter, so table_exists()
		// cannot be relied on here.
		foreach ( [ 'burst_campaigns', 'burst_parameters', 'burst_statistics_searches', 'burst_goal_statistics' ] as $linked_table ) {
			$full_linked = $wpdb->prefix . $linked_table;
			if ( ! (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $full_linked ) ) ) {
				continue;
			}
			$wpdb->query(
				$wpdb->prepare(
					"DELETE f FROM `{$full_linked}` f
					 INNER JOIN {$wpdb->prefix}burst_statistics s ON f.statistic_id = s.ID
					 WHERE s.uid_id IN ($placeholders)",
					...$uid_ids
				)
			);
		}

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_statistics WHERE uid_id IN ($placeholders)",
				...$uid_ids
			)
		);

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_sessions WHERE uid_id IN ($placeholders)",
				...$uid_ids
			)
		);

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_uids WHERE ID IN ($placeholders)",
				...$uid_ids
			)
		);
		// phpcs:enable

		$last = end( $rows );

		return [
			'deleted' => count( $rows ),
			'cursor'  => (string) $last['uid'],
		];
	}

	/**
	 * Delete one chunk of statistics rows by the legacy varchar uid column,
	 * for installs where uid_id is not the identity column yet.
	 *
	 * @param int $import_id Registry record ID.
	 * @param int $chunk_size Rows per query.
	 * @return int Rows deleted.
	 */
	private function delete_legacy_uid_chunk( int $import_id, int $chunk_size ): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$deleted = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_statistics WHERE uid LIKE %s LIMIT %d",
				$this->uid_prefix( $import_id ),
				$chunk_size
			)
		);

		return is_int( $deleted ) ? $deleted : 0;
	}

	/**
	 * Final rollback step: remove goals this import created and restore the
	 * data-start / visitor bitmap watermarks.
	 *
	 * @param int                  $import_id Registry record ID.
	 * @param array<string, mixed> $state Import state.
	 */
	private function finalize( int $import_id, array $state ): void {
		$this->delete_imported_goals( $state );

		$import = $this->get_import( $import_id );
		Import_Manager::restore_data_start( null !== $import && ! empty( $import->period_start ) ? (string) $import->period_start : null );
	}

	/**
	 * Remove goal definitions this import created (tracked during the merge),
	 * together with any remaining conversions for them. Goals that were
	 * matched to a pre-existing goal are never tracked, so they stay.
	 *
	 * @param array<string, mixed> $state Import state.
	 */
	private function delete_imported_goals( array $state ): void {
		global $wpdb;

		$goal_ids = ! empty( $state['imported_goal_ids'] )
			? array_values( array_filter( array_map( 'intval', (array) $state['imported_goal_ids'] ), static fn( $id ) => $id > 0 ) )
			: [];
		if ( empty( $goal_ids ) || ! $this->table_exists( 'burst_goals' ) ) {
			return;
		}

		$has_goal_stats = $this->table_exists( 'burst_goal_statistics' );
		foreach ( array_chunk( $goal_ids, 500 ) as $goal_chunk ) {
			$goal_ph = implode( ',', array_fill( 0, count( $goal_chunk ), '%d' ) );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			if ( $has_goal_stats ) {
				$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_goal_statistics WHERE goal_id IN ($goal_ph)", ...$goal_chunk ) );
			}
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_goals WHERE ID IN ($goal_ph)", ...$goal_chunk ) );
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		}
	}
}
