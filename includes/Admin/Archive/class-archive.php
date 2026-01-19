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
	 * Delete data from the statistics table
	 */
	private function delete_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		if ( get_transient( 'burst_running_delete' ) ) {
			return;
		}

		set_transient( 'burst_running_delete', 'true', 30 );

		$data = $this->get_data_args();

		global $wpdb;
		// get rows from database.
		$result = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_statistics where time<= %d and time>=%d", (int) $data['unix_end'], (int) $data['unix_start'] ) );
		// delete.
		if ( is_array( $result ) && count( $result ) > 0 ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_statistics where time<= %d and time>=%d", (int) $data['unix_end'], (int) $data['unix_start'] ) );
		}

		$this->set_month_status( (int) $data['month'], (int) $data['year'], 'deleted' );
		$this->estimate_table_size();
		delete_transient( 'burst_running_delete' );
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
	 * Get the oldest available timestamp from the database
	 */
	protected function get_oldest_timestamp(): int {
		global $wpdb;
		return (int) $wpdb->get_var( "SELECT MIN(time) FROM {$wpdb->prefix}burst_statistics" );
	}

	/**
	 * Based on the current month, add x months, and return the timestamp for the first second of that month
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
		$next_month->setTime( 0, 0, 1 );

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
		if ( ! is_admin() && ! wp_doing_cron() ) {
			return;
		}

		if ( ! $this->user_can_manage() ) {
			return;
		}

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
