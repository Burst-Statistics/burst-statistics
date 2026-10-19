<?php
namespace Burst\Admin\Archive;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use Burst\Traits\Save;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Archive {
	use Helper;
	use Admin_Helper;
	use Save;
	use Database_Helper;
	use Sanitize;

	protected int $archive_after_months;
	protected string $archive_option = '';
	protected int $rows_per_batch    = 7500;
	protected int $minimum_archive_months;
	/**
	 * Constructor
	 */
	public function init(): void {
		$this->assign_properties();

		add_action( 'burst_daily', [ $this, 'run_delete' ] );
		add_action( 'burst_archive_iteration', [ $this, 'run_delete' ] );

		add_action( 'burst_install_tables', [ $this, 'upgrade_database' ] );
		add_action( 'burst_daily', [ $this, 'estimate_table_size' ] );
	}

	/**
	 * Assign properties from options
	 */
	protected function assign_properties(): void {
		$this->minimum_archive_months = apply_filters( 'burst_minimum_archive_months', 12 );

		if ( empty( $this->archive_option ) ) {
			$this->archive_option       = $this->get_option( 'archive_data' );
			$this->archive_after_months = (int) $this->get_option( 'archive_after_months' ) ?: 24;
		}

		if ( $this->archive_after_months < $this->minimum_archive_months ) {
			$this->archive_after_months = $this->minimum_archive_months;
		}

		$this->archive_option = $this->archive_option ?: 'none';
		$this->archive_option = strlen( $this->archive_option ) > 0 ? $this->archive_option : 'none';
		if ( $this->archive_option === 'delete' ) {
			$confirmed = $this->get_option_bool( 'confirm_delete_data' );
			if ( ! $confirmed ) {
				$this->archive_option = 'none';
			}
		}
		if ( ! in_array( $this->archive_option, [ 'none', 'delete', 'archive' ], true ) ) {
			$this->archive_option = 'none';
		}
	}

	/**
	 * Estimate the size of the statistics table and store it in an option
	 */
	public function estimate_table_size(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		if ( ! defined( 'DB_NAME' ) ) {
			return;
		}

		global $wpdb;
		$size_in_mb   = -1;
		$table_status = $wpdb->get_results( 'SHOW TABLE STATUS', ARRAY_A );
		if ( $wpdb->num_rows > 0 ) {
			// Sum up Data_length for all tables.
			$total_data_bytes = 0;
			foreach ( $table_status as $table ) {
				if ( strpos( $table['Name'], $wpdb->prefix . 'burst_' ) === 0 ) {
					if ( isset( $table['Data_length'] ) ) {
						$total_data_bytes += (int) $table['Data_length'] + (int) $table['Index_length'];
					}
				}
			}
			$size_in_mb = size_format( $total_data_bytes, 0 );
		}

		update_option( 'burst_table_size', $size_in_mb, false );
	}

	/**
	 * Run the archive or delete process on cron
	 */
	public function run_delete(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		switch ( $this->archive_option ) {
			case 'none':
				return;
			case 'delete':
				$this->delete_data();
				return;
			default:
		}
	}

	/**
	 * Delete data from the statistics table in batches.
	 *
	 * Deletes at most one batch of the oldest overdue month per run and
	 * schedules the next iteration while overdue data remains.
	 */
	private function delete_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		if ( get_transient( 'burst_running_delete' ) ) {
			return;
		}

		set_transient( 'burst_running_delete', 'true', 30 );

		try {
			$data           = $this->get_data_args();
			$unix_start     = (int) $data['unix_start'];
			$unix_end       = (int) $data['unix_end'];
			$rows_per_batch = (int) $data['rows_per_batch'];

			// An empty table yields a 1970 month start, an in-retention month an end before its start.
			if ( $unix_start <= 0 || $unix_start >= $unix_end || $rows_per_batch <= 0 ) {
				return;
			}

			global $wpdb;
			$hits = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT ID, session_id
					FROM {$wpdb->prefix}burst_statistics
					WHERE time >= %d AND time < %d
					LIMIT %d",
					$unix_start,
					$unix_end,
					$rows_per_batch
				)
			);
			$hits = is_array( $hits ) ? $hits : [];
			$this->delete_hits( $hits );

			// Events are deleted in their own batches: a hit can carry many of
			// them, so a month's events can outlast its hits, and an event-only
			// month has no hits at all.
			$deleted_events = $this->delete_events( $unix_start, $unix_end, $rows_per_batch );

			// A short batch of both means this was the last one for the month.
			if ( count( $hits ) >= $rows_per_batch || $deleted_events >= $rows_per_batch ) {
				$this->schedule_archive_iteration();
				return;
			}

			$this->set_month_status( (int) $data['month'], (int) $data['year'], 'deleted' );
			$this->purge_visitor_bitmaps( $unix_start, $unix_end );
			$this->delete_sessions_before_oldest_hit( $rows_per_batch );
			$this->estimate_table_size();

			// The next run returns at once when no further month is overdue.
			$this->schedule_archive_iteration();
		} finally {
			delete_transient( 'burst_running_delete' );
		}
	}

	/**
	 * Delete one batch of the custom events recorded in a month, firing
	 * burst_before_delete_events first so Pro can remove their properties while
	 * the events can still be found by this time range.
	 *
	 * @param int $unix_start     Start of the month, inclusive.
	 * @param int $unix_end       End of the month, exclusive.
	 * @param int $rows_per_batch Most events deleted in one call.
	 * @return int Number of events deleted; fewer than $rows_per_batch means the month is exhausted.
	 */
	private function delete_events( int $unix_start, int $unix_end, int $rows_per_batch ): int {
		global $wpdb;
		$event_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_events
				WHERE time >= %d AND time < %d
				ORDER BY time
				LIMIT %d",
				$unix_start,
				$unix_end,
				$rows_per_batch
			)
		);
		if ( empty( $event_ids ) ) {
			return 0;
		}

		do_action( 'burst_before_delete_events', $unix_start, $unix_end );

		$placeholders = implode( ',', array_fill( 0, count( $event_ids ), '%d' ) );
		$sql          = "DELETE FROM {$wpdb->prefix}burst_events WHERE ID IN ($placeholders)";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- placeholders are %d only.
		$wpdb->query( $wpdb->prepare( $sql, ...$event_ids ) );

		return count( $event_ids );
	}

	/**
	 * Delete sessions older than the oldest session that still has a hit.
	 *
	 * Catches orphans the per-batch cleanup never sees, such as sessions left by
	 * earlier runs or other deletion paths. Session IDs grow over time, so an ID
	 * below the lowest referenced one can have no hits; the delete walks the
	 * primary key instead of joining the whole sessions table.
	 *
	 * @param int $limit Maximum number of sessions to delete in this run.
	 */
	protected function delete_sessions_before_oldest_hit( int $limit ): void {
		global $wpdb;
		$lowest_session_id = (int) $wpdb->get_var( "SELECT MIN(session_id) FROM {$wpdb->prefix}burst_statistics WHERE session_id > 0" );
		// Without any referenced session there is no safe lower bound.
		if ( $lowest_session_id <= 0 ) {
			return;
		}

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_sessions WHERE ID < %d LIMIT %d",
				$lowest_session_id,
				$limit
			)
		);
	}

	/**
	 * Drop the visitor bitmaps of a purged period.
	 *
	 * Their raw data is gone, so a bitmap-served visitors count would contradict
	 * every other metric. Absent site rows make the reader fall back for ranges
	 * touching this period.
	 *
	 * @param int $unix_start First second of the period.
	 * @param int $unix_end   First second after the period.
	 */
	protected function purge_visitor_bitmaps( int $unix_start, int $unix_end ): void {
		if ( ! $this->table_exists( 'burst_visitor_bitmaps' ) ) {
			return;
		}

		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_visitor_bitmaps WHERE day BETWEEN %s AND %s",
				wp_date( 'Y-m-d', $unix_start ),
				wp_date( 'Y-m-d', $unix_end - 1 )
			)
		);
		update_option( 'burst_visitor_bitmaps_generation', (string) time(), false );
	}

	/**
	 * Schedule the next archive iteration, unless one is already queued.
	 */
	protected function schedule_archive_iteration(): void {
		if ( ! wp_next_scheduled( 'burst_archive_iteration' ) ) {
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_archive_iteration' );
		}
	}

	/**
	 * Set the status for a month
	 */
	protected function set_month_status( int $month, int $year, string $status ): void {
		global $wpdb;
		$status = $this->sanitize_archive_status( $status );
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}burst_archived_months (month, year, status) VALUES (%d, %d, %s) ON DUPLICATE KEY UPDATE status = %s", $month, $year, $status, $status ) );
	}

	/**
	 * Get the oldest statistics or event timestamp so neither table is skipped.
	 *
	 * @return int Oldest timestamp, or zero when both tables are empty.
	 */
	protected function get_oldest_timestamp(): int {
		global $wpdb;
		return (int) $wpdb->get_var(
			"SELECT MIN(oldest_time) FROM (
				SELECT MIN(time) AS oldest_time FROM {$wpdb->prefix}burst_statistics
				UNION ALL
				SELECT MIN(time) AS oldest_time FROM {$wpdb->prefix}burst_events
			) AS oldest_times"
		);
	}

	/**
	 * Based on the current month, add x months, and return the timestamp for the first second (00:00:00) of that month.
	 *
	 * Callers query months as half-open ranges (time >= start AND time < end), so no
	 * second falls between two months or belongs to both.
	 */
	protected function get_timestamp_for_month( int $current_timestamp, int $add_months = 0 ): int {
		// Current year and month (YYYY-MM).
		$current_month_year = gmdate( 'Y-m', $current_timestamp );
		// Create a DateTime object for the first day of the next month.
		$current_date_time = \DateTime::createFromFormat( 'Y-m-d H:i:s', $current_month_year . '-01 00:00:00' );

		// Add one month to the current DateTime object.
		$next_month        = clone $current_date_time;
		$add_months_string = strpos( (string) $add_months, '-' ) === 0 ? (string) $add_months : "+$add_months";
		$next_month->modify( "$add_months_string months" );
		// Set the time to the first second of the next month.
		$next_month->setTime( 0, 0, 0 );

		// Get the Unix timestamp.
		return $next_month->getTimestamp();
	}

	/**
	 * Get list of all required data arguments: unix_start, unix_end, month, year, rows_per_batch.
	 *
	 * @return array{
	 *     unix_start: int,
	 *     unix_end: int,
	 *     month: string,
	 *     year: string,
	 *     rows_per_batch: int
	 * }
	 */
	protected function get_data_args(): array {
		// get oldest timestamp from the database.
		$oldest_timestamp = $this->get_oldest_timestamp();
		$month            = gmdate( 'm', $oldest_timestamp );
		$year             = gmdate( 'y', $oldest_timestamp );

		// get the timestamp for the first second of the next month.
		$unix_start = $this->get_timestamp_for_month( $oldest_timestamp, 0 );
		$unix_end   = $this->get_timestamp_for_month( $oldest_timestamp, 1 );

		// never archive after the months_ago limit.
		$months_ago = apply_filters( 'burst_archive_after_months', $this->archive_after_months );
		// enforce at least {$this->minimum_archive_months} months.
		if ( $months_ago <= $this->minimum_archive_months ) {
			$months_ago = $this->minimum_archive_months;
		}

		// get timestamp for first second of the month "$months_ago" ago. We don't archive after that.
		$unix_end_max = $this->get_timestamp_for_month( time(), -$months_ago );
		if ( $unix_end > $unix_end_max ) {
			$unix_end = $unix_end_max;
		}
		$rows_per_batch = apply_filters( 'burst_archive_rows_per_batch', $this->rows_per_batch );
		$max_unix_end   = strtotime( "-$months_ago months" );

		if ( $max_unix_end < $unix_end ) {
			$unix_end = $max_unix_end;
		}

		return [
			'unix_start'     => $unix_start,
			'unix_end'       => $unix_end,
			'month'          => $month,
			'year'           => $year,
			'rows_per_batch' => $rows_per_batch,
		];
	}

	/**
	 * Create or update table
	 */
	public function upgrade_database(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$table_name      = $wpdb->prefix . 'burst_archived_months';
		$sql             = "CREATE TABLE $table_name (
                            `ID` int(11) NOT NULL AUTO_INCREMENT ,
                            `month` int(11) NOT NULL,
                            `year` int(11) NOT NULL,
                            `batch_id` int(11) NOT NULL,
                            `row_count` int(11) NOT NULL,
                            `status` varchar(250),
                              PRIMARY KEY (ID),
                              UNIQUE KEY month_year (month, year)
                            ) $charset_collate;";
		dbDelta( $sql );
	}
}
