<?php
namespace Burst\Pro;

use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Archive {
	use Helper;
	use Admin_Helper;
	use Save;
	use Database_Helper;
	use Sanitize;

	private int $archive_after_months;
	private string $archive_option = '';
	private int $rows_per_batch    = 7500;
	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'burst_daily', [ $this, 'run_archiver' ] );
		add_action( 'burst_archive_iteration', [ $this, 'run_archiver' ] );

		add_action( 'burst_daily', [ $this, 'run_restore' ] );
		add_action( 'burst_archive_iteration', [ $this, 'run_restore' ] );

		add_action( 'burst_install_tables', [ $this, 'upgrade_database' ] );
		add_action( 'burst_daily', [ $this, 'estimate_table_size' ] );
		add_action( 'burst_do_action', [ $this, 'do_rest_action' ], 10, 3 );
	}

	/**
	 * Run restores on cron
	 */
	public function run_restore(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$progress = $this->process_restore_batch();
		// if not completed, run again.
		if ( $progress < 100 ) {
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_archive_iteration' );
		}
	}

	/**
	 * Handles REST API archive-related actions.
	 *
	 * @param array  $output Existing response output.
	 * @param string $action Action name (e.g., 'get_archives', 'start_restore_archives').
	 * @param array  $data Request data.
	 * @return array{
	 *     archives?: array<int, array{
	 *         id: string,
	 *         title: string,
	 *         size: string,
	 *         status: string,
	 *         restoring: bool
	 *     }>,
	 *     downloadUrl?: string,
	 *     progress?: int
	 * }|array<string, mixed>
	 */
	public function do_rest_action( array $output, string $action, array $data ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		if ( $action === 'get_archives' ) {
			$output = $this->get_archives_data();
		} elseif ( $action === 'start_restore_archives' ) {
			$archives = $data['archives'];
			$this->start_restoring( $archives );
			$output = [
				'progress' => 2,
			];
		} elseif ( $action === 'get_restore_progress' ) {
			$output = [
				'progress' => $this->process_restore_batch(),
			];
		} elseif ( $action === 'delete_archives' ) {
			$archives = $data['archives'];
			$this->delete_archives( $archives );

		}
		return $output;
	}

	/**
	 * Delete an array of archives
	 */
	private function delete_archives( array $archives ): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$restoring = $this->get_archives_to_restore();
		// flatten this arrray to just the 'file' part.
		$restoring = array_map(
			function ( $archive ) {
				return $archive['file'];
			},
			$restoring
		);

		$dir = $this->archive_upload_dir();
		if ( ! is_dir( $dir ) ) {
			return;
		}

		foreach ( $archives as $archive ) {

			if ( ! isset( $archive['id'] ) ) {
				continue;
			}
			$file = $archive['id'];

			// don't delete archives that are being restored currently.
			if ( in_array( $file, $restoring, true ) ) {
				continue;
			}

			// get month and year from y-m.zip string.
			$month_year = $this->get_month_year_from_file( $file );
			$this->delete_month( $month_year['month'], $month_year['year'] );
			// prevent path traversal.
			$file = str_replace( [ '/', '\\' ], '', $file );
			$file = $dir . $file;
			if ( file_exists( $file ) ) {
				wp_delete_file( $file );
			}
		}
	}

	/**
	 * Get the upload directory for the archives
	 */
	private function archive_upload_dir(): string {
		$folder = get_option( 'burst_archive_dir' );
		if ( ! $folder ) {
			$folder = bin2hex( random_bytes( 16 ) );
			update_option( 'burst_archive_dir', $folder, false );
		}
		return $this->upload_dir( $folder );
	}

	/**
	 * Process a batch of archives to restore
	 */
	private function process_restore_batch(): int {
		if ( ! $this->has_admin_access() ) {
			return 0;
		}

		if ( get_transient( 'burst_running_restore' ) ) {
			return 10;
		}

		set_transient( 'burst_running_restore', true, 30 );
		// get list of archives that need restoring.
		$archives = $this->get_archives_to_restore();
		if ( empty( $archives ) ) {
			delete_transient( 'burst_running_restore' );
			self::error_log( 'No archives found' );
			return 100;
		}
		// get first archive.
		$archive = array_shift( $archives );

		$year         = $archive['year'];
		$month        = $archive['month'];
		$archive_date = new \DateTime( "$year-$month-01" );
		$current_date = new \DateTime();

		$interval   = $current_date->diff( $archive_date );
		$months_ago = $interval->y * 12 + $interval->m;
		// set the setting to at least the number of months this archive is past.
		if ( $this->archive_after_months < $months_ago ) {
			$this->archive_after_months = $months_ago;
			$this->update_option( 'archive_after_months', $months_ago );
		}

		// archive_after_months
		// check if the file exists. If so, unzip.
		$dir = $this->archive_upload_dir();
		if ( ! is_dir( $dir ) ) {
			self::error_log( 'Archive directory does not exist: ' . $dir );
			delete_transient( 'burst_running_restore' );
			return 0;
		}
		// prevent path traversal.
		$file = $dir . str_replace( [ '/', '\\' ], '', $archive['file'] );

		if ( file_exists( $file ) ) {
			$unzipped = $this->unzip( $file );
			if ( $unzipped ) {
				wp_delete_file( $file );
			}
		}

		// we have an unzipped file, check if the csv exists.
		$file = str_replace( '.zip', '.csv', $file );
		if ( ! file_exists( $file ) ) {
			self::error_log( 'Archive does not exist: ' . $file );
			// no csv, so set to restored.
			$this->set_month_status( (int) $archive['month'], (int) $archive['year'], 'restored' );
		}

		// we have a file. Get the data.
		$data = $this->get_csv_data( $file );
		if ( ! isset( $data['columns'] ) ) {
			// no valid data, so set to restored and delete.
			if ( file_exists( $file ) ) {
				wp_delete_file( $file );
			}
			$this->set_month_status( (int) $archive['month'], (int) $archive['year'], 'restored' );
			delete_transient( 'burst_running_restore' );
			return $this->get_progress( $archive );
		}

		$columns = $data['columns'];
		$data    = $data['data'];
		// insert the data in the database.
		global $wpdb;

		$rows_to_insert = [];

		foreach ( $data as $row ) {
			$converted_data = [];
			foreach ( $columns as $column_index => $column ) {
				// skip ID, as it's the index.
				if ( $column === 'ID' ) {
					continue;
				}
				$column                    = $this->map_dropped_column_name( $column );
				$value                     = $row[ $column_index ];
				$value                     = $this->map_dropped_column_value( $column, $value );
				$converted_data[ $column ] = $wpdb->prepare( '%s', sanitize_text_field( $value ) );
			}
			$rows_to_insert[] = $converted_data;
		}

		// remove 'ID' from columns.
		$columns = array_diff( $columns, [ 'ID' ] );
		// run sanitize_title on each column name.
		$columns = array_map( 'sanitize_title', $columns );

		$table_name = $wpdb->prefix . 'burst_statistics';
		$sql        = "INSERT INTO $table_name (" . implode( ', ', $columns ) . ') VALUES ';
		$values     = [];
		foreach ( $rows_to_insert as $row ) {
			$values[] = '(' . implode( ', ', $row ) . ')';
		}
		$sql   .= implode( ', ', $values );
		$result = $wpdb->query( $sql );

		if ( $result === false ) {
			self::error_log( 'Error restoring data, ' . $wpdb->last_error );
		}

		$this->estimate_table_size();
		delete_transient( 'burst_running_restore' );
		return $this->get_progress( $archive );
	}


	/**
	 * Check if column name is one of the dropped columns, and if so, return the new column name
	 */
	private function map_dropped_column_name( string $column ): string {
		$dropped_columns = [ 'browser', 'browser_version', 'platform', 'device', 'device_resolution' ];
		if ( ! in_array( $column, $dropped_columns, true ) ) {
			return $column;
		}
		return $column . '_id';
	}

	/**
	 * Check if column name is one of the dropped columns, and if so, return the mapped id
	 */
	private function map_dropped_column_value( string $column, string $value ): string {
		$dropped_columns = [ 'browser', 'browser_version', 'platform', 'device', 'device_resolution' ];
		if ( ! in_array( $column, $dropped_columns, true ) ) {
			return $value;
		}

		// cast to string.
		return (string) \Burst\burst_loader()->frontend->tracking->get_lookup_table_id_cached( $column, $value );
	}

	/**
	 * Get progress
	 */
	private function get_progress( array $archive ): int {
		if ( ! $this->has_admin_access() ) {
			return 0;
		}

		// get first batch_id from archives with 'restoring' status.
		global $wpdb;
		$batch_id = $wpdb->get_var( 'SELECT batch_id FROM ' . $wpdb->prefix . 'burst_archived_months WHERE status = "restoring" ORDER BY batch_id ASC LIMIT 1' );
		// get total number months with this batch_id.
		$batch_total       = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) as count FROM {$wpdb->prefix}burst_archived_months WHERE batch_id = %s", $batch_id ) );
		$remaining_batches = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_archived_months WHERE status='restoring'" );
		if ( $remaining_batches === 0 ) {
			return 100;
		}

		// calculate progress within current archive month.
		$total_row_count     = $this->get_month_row_count( $archive['month'], $archive['year'] );
		$remaining_row_count = $this->count_csv_rows( $archive );
		if ( $total_row_count === 0 ) {
			$total_row_count = $remaining_row_count;
			$this->set_month_row_count( (int) $archive['month'], (int) $archive['year'], $remaining_row_count );
		}

		if ( $total_row_count < $remaining_row_count ) {
			// generate random number between 0 and 1.
			$random                 = 0.5;
			$current_batch_progress = $remaining_row_count > 0 ? $random : 1;
		} else {
			$divide_by              = $total_row_count === 0 ? 1 : $total_row_count;
			$current_batch_progress = ( $total_row_count - $remaining_row_count ) / $divide_by;
		}

		// if this batch is completed (=1), don't count it, as it will be included in the remaining batches already.
		if ( $current_batch_progress === 1 ) {
			$current_batch_progress = 0;
		}
		$completed = (int) ( $batch_total ) - $remaining_batches + $current_batch_progress;
		// prevent division by zero.
		$batch_total = $batch_total === 0 ? 1 : $batch_total;
		$progress    = $completed / $batch_total * 100;

		// for very small progress, round up to 1.
		if ( $progress > 0 && $progress < 1 ) {
			$progress = 1;
		}

		// if it gets rounded up to 100, the last bit won't get processed.
		if ( $progress > 99 && $progress < 100 ) {
			// put back a bit so we can do another round.
			$progress = 95;
		}

		return (int) round( $progress, 0 );
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
	 * Get metadata for all archive files in the archive directory.
	 *
	 * @return array{
	 *     archives: array<int, array{
	 *         id: string,
	 *         title: string,
	 *         size: string,
	 *         status: string,
	 *         restoring: bool
	 *     }>,
	 *     downloadUrl: string
	 * }
	 */
	private function get_archives_data(): array {
		if ( ! $this->has_admin_access() ) {
			return [
				'archives'    => [
					[
						'id'        => '',
						'title'     => '',
						'size'      => '',
						'status'    => '',
						'restoring' => false,
					],
				],
				'downloadUrl' => '',
			];
		}

		$dir = $this->archive_upload_dir();
		if ( ! is_dir( $dir ) ) {
			self::error_log( 'Archive directory does not exist: ' . $dir );
			return [
				'archives'    => [],
				'downloadUrl' => '',
			];
		}
		// get list of files in this directory.
		$files = scandir( $dir );
		// remove . and ..
		$files = array_diff( $files, [ '.', '..' ] );
		// only zip files.
		$files    = array_filter(
			$files,
			static function ( $file ) {
				return substr( $file, - 4 ) === '.zip';
			}
		);
		$archives = [];

		$restoring = $this->get_archives_to_restore();
		// flatten this arrray to just the 'file' part.
		$restoring = array_map(
			function ( $archive ) {
				return $archive['file'];
			},
			$restoring
		);

		foreach ( $files as $file ) {
			// get file size in MB.
			$size = size_format( filesize( $dir . $file ), 0 );

			$file       = basename( $file );
			$month_year = $this->get_month_year_from_file( $file );
			$archives[] = [
				'id'        => $file,
				'title'     => '20' . $month_year['year'] . ' - ' . ucfirst( $this->get_month_string( $month_year['month'] ) ),
				'size'      => $size,
				'status'    => 'archived',
				'restoring' => in_array( $file, $restoring, true ),
			];
		}

		return [
			'archives'    => $archives,
			'downloadUrl' => $this->download_url(),
		];
	}

	/**
	 * Remove extension, if any, and split into month and year.
	 *
	 * @return int[]
	 */
	private function get_month_year_from_file( string $file ): array {
		$file = sanitize_title( $file );
		if ( strpos( $file, '.' ) !== false ) {
			$file = substr( $file, 0, -4 );
		}
		$month_year = explode( '-', $file );
		$year       = (int) $month_year[0];
		$month      = (int) $month_year[1];
		return [
			'month' => $month,
			'year'  => $year,
		];
	}

	/**
	 * Convert an integer to the corresponding month in text
	 */
	private function get_month_string( int $month_number ): string {
		$months = [
			1  => __( 'January', 'burst-statistics' ),
			2  => __( 'February', 'burst-statistics' ),
			3  => __( 'March', 'burst-statistics' ),
			4  => __( 'April', 'burst-statistics' ),
			5  => __( 'May', 'burst-statistics' ),
			6  => __( 'June', 'burst-statistics' ),
			7  => __( 'July', 'burst-statistics' ),
			8  => __( 'August', 'burst-statistics' ),
			9  => __( 'September', 'burst-statistics' ),
			10 => __( 'October', 'burst-statistics' ),
			11 => __( 'November', 'burst-statistics' ),
			12 => __( 'December', 'burst-statistics' ),
		];
		return $months[ $month_number ];
	}

	/**
	 * Returns selected archive option: none, delete, archive
	 */
	private function archive_option(): string {
		if ( empty( $this->archive_option ) ) {
			$this->archive_option       = $this->get_option( 'archive_data' );
			$this->archive_after_months = (int) $this->get_option( 'archive_after_months' ) ?: 12;
		}
		if ( $this->archive_after_months < 12 ) {
			$this->archive_after_months = 12;
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
		return $this->archive_option;
	}

	/**
	 * Run the archive or delete process on cron
	 */
	public function run_archiver(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$archive_option = $this->archive_option();
		switch ( $archive_option ) {
			case 'none':
				return;
			case 'delete':
				$this->delete_data();
				return;
			case 'archive':
				$this->archive_data();
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
		$result = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_statistics where time<= %s and time>=%s", $data['unix_end'], $data['unix_start'] ) );
		// delete.
		if ( is_array( $result ) && count( $result ) > 0 ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_statistics where time<= %s and time>=%s LIMIT", $data['unix_end'], $data['unix_start'] ) );
		}

		$this->set_month_status( (int) $data['month'], (int) $data['year'], 'deleted' );
		$this->estimate_table_size();
		delete_transient( 'burst_running_delete' );
	}

	/**
	 * Archive data from the statistics table
	 */
	private function archive_data(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( get_transient( 'burst_running_archiver' ) ) {
			return;
		}

		set_transient( 'burst_running_archiver', 'true', 30 );

		$data           = $this->get_data_args();
		$rows_per_batch = $data['rows_per_batch'];

		// keep track of currently processing month.
		$this->set_month_status( (int) $data['month'], (int) $data['year'], 'archiving' );
		global $wpdb;
		// get rows from database.
		$result = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_statistics where time<= %s and time>=%s LIMIT $rows_per_batch", $data['unix_end'], $data['unix_start'] ) );
		// append to file.
		if ( is_array( $result ) && count( $result ) > 0 ) {
			$locked = get_transient( 'burst_archive_locked' );
			if ( ! $locked ) {
				set_transient( 'burst_archive_locked', true, MINUTE_IN_SECONDS );
				$this->append_to_csv_file( $result, $data );
				$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_statistics where time<= %s and time>=%s LIMIT $rows_per_batch", $data['unix_end'], $data['unix_start'] ) );
				delete_transient( 'burst_archive_locked' );
			}
		}

		// check if this month is completed.
		$remaining = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_statistics where time<= %s and time>=%s LIMIT $rows_per_batch", $data['unix_end'], $data['unix_start'] ) );
		if ( ! is_array( $remaining ) || count( $remaining ) === 0 ) {
			$this->zip( $data );
			$count = $this->count_csv_rows( $data );
			$this->set_month_row_count( (int) $data['month'], (int) $data['year'], $count );
			$this->delete_csv( $data );
			$this->set_month_status( (int) $data['month'], (int) $data['year'], 'archived' );
		} else {
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_archive_iteration' );
		}
		$this->estimate_table_size();
		delete_transient( 'burst_running_archiver' );
	}

	/**
	 * Count the number of rows in the CSV file.
	 */
	private function count_csv_rows( array $data_args ): int {
		if ( ! $this->has_admin_access() ) {
			return 0;
		}

		$file = $this->get_file_name( $data_args );
		if ( ! file_exists( $file ) ) {
			return 0;
		}

        //phpcs:ignore
		$handle = fopen( $file, 'r' );
		if ( ! $handle ) {
			return 0;
		}

		$count = 0;
		while ( fgets( $handle ) ) {
			++$count;
		}

        //phpcs:ignore
		fclose( $handle );
		return $count;
	}

	/**
	 * Get list of archives (in y-m.zip format) currently marked as "restoring".
	 *
	 * @return array<int, array{
	 *     file: string,
	 *     month: string,
	 *     year: string
	 * }>
	 */
	private function get_archives_to_restore(): array {
		if ( ! $this->has_admin_access() ) {
			return [];
		}

		// might happen during initialization.
		if ( ! $this->table_exists( 'burst_archived_months' ) ) {
			return [];
		}

		global $wpdb;

		// remove duplicates.
		$sql = "DELETE bm1
                FROM {$wpdb->prefix}burst_archived_months bm1
                JOIN {$wpdb->prefix}burst_archived_months bm2
                  ON bm1.month = bm2.month
                 AND bm1.year = bm2.year
                 AND bm1.id < bm2.id;";
		$wpdb->query( $sql );

		$archives = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_archived_months WHERE status='restoring'" );
		if ( empty( $archives ) ) {
			return [];
		}

		// create array of file names in y-m.zip format.
		return array_map(
			static function ( $archive ) {
				// enforce two digits for month number.
				$month = sprintf( '%02d', $archive->month );
				$year  = sprintf( '%02d', $archive->year );
				return [
					'file'  => $year . '-' . $month . '.zip',
					'month' => $month,
					'year'  => $year,
				];
			},
			$archives
		);
	}

	/**
	 * Start restoring archives
	 */
	private function start_restoring( array $archives ): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		// get highest batch_id from database.
		global $wpdb;
		$batch_id = $wpdb->get_var( "SELECT MAX(batch_id) FROM {$wpdb->prefix}burst_archived_months" );
		$batch_id = (int) $batch_id + 1;
		foreach ( $archives as $archive ) {
			// get month and year from y-m.zip string.
			$month_year = $this->get_month_year_from_file( $archive );
			global $wpdb;
			$id = $wpdb->get_var( $wpdb->prepare( "select ID from {$wpdb->prefix}burst_archived_months where month=%s AND year=%s", $month_year['month'], $month_year['year'] ) );
			if ( empty( $id ) ) {
				$wpdb->insert(
					"{$wpdb->prefix}burst_archived_months",
					[
						'month'    => $month_year['month'],
						'year'     => $month_year['year'],
						'status'   => 'restoring',
						'batch_id' => $batch_id,
					]
				);
			} else {
				$wpdb->update(
					"{$wpdb->prefix}burst_archived_months",
					[
						'status'   => 'restoring',
						'batch_id' => $batch_id,
					],
					[
						'month' => $month_year['month'],
						'year'  => $month_year['year'],
					]
				);
			}
		}
	}

	/**
	 * Set the status for a month
	 */
	private function set_month_status( int $month, int $year, string $status ): void {
		global $wpdb;
		$status = $this->sanitize_archive_status( $status );
		$table  = $wpdb->prefix . 'burst_archived_months';
		$wpdb->query( $wpdb->prepare( "INSERT INTO $table (month, year, status) VALUES (%d, %d, %s) ON DUPLICATE KEY UPDATE status = %s", $month, $year, $status, $status ) );
	}

	/**
	 * Delete one archive month
	 */
	private function delete_month( int $month, int $year ): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		global $wpdb;
		$wpdb->delete(
			"{$wpdb->prefix}burst_archived_months",
			[
				'month' => $month,
				'year'  => $year,
			]
		);
	}

	/**
	 * Update the row count for a month, for usage in progress percentage while restoring
	 */
	private function set_month_row_count( int $month, int $year, int $count ): void {
		global $wpdb;
		$id = $wpdb->get_var( $wpdb->prepare( "select ID from {$wpdb->prefix}burst_archived_months where month=%s AND year=%s", $month, $year ) );
		if ( ! $id ) {
			$wpdb->insert(
				"{$wpdb->prefix}burst_archived_months",
				[
					'month'     => $month,
					'year'      => $year,
					'row_count' => $count,
				]
			);
		} else {
			$wpdb->update(
				"{$wpdb->prefix}burst_archived_months",
				[ 'row_count' => $count ],
				[ 'ID' => $id ]
			);
		}
	}

	/**
	 * Get row count from a month
	 *
	 * @return int $row_count
	 */
	private function get_month_row_count( int $month, int $year ): int {
		global $wpdb;
		$count = $wpdb->get_var( $wpdb->prepare( "select row_count from {$wpdb->prefix}burst_archived_months where month=%s AND year=%s", $month, $year ) );
		if ( ! $count ) {
			return 0;
		}
		return (int) $count;
	}

	/**
	 * Get the oldest available timestamp from the database
	 */
	private function get_oldest_timestamp(): int {
		global $wpdb;
		return (int) $wpdb->get_var( "SELECT MIN(time) FROM {$wpdb->prefix}burst_statistics" );
	}

	/**
	 * Based on the current month, add x months, and return the timestamp for the first second of that month
	 */
	private function get_timestamp_for_month( int $current_timestamp, int $add_months = 0 ): int {
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
	 * Zip CSV file
	 */
	private function zip( array $data_args ): void {
		$file = $this->get_file_name( $data_args );
		if ( ! file_exists( $file ) ) {
			return;
		}

		// remove last 4 characters to strip .csv.
		$file_no_extension = substr( $file, 0, -4 );

		// if zip already exists, delete it first.
		if ( file_exists( $file_no_extension . '.zip' ) ) {
			wp_delete_file( $file_no_extension . '.zip' );
		}

		// zip the contents of the file.
		$zip = new \ZipArchive();
		$zip->open( $file_no_extension . '.zip', \ZipArchive::CREATE );
		$zip->addFile( $file, basename( $file ) );
		$zip->close();
	}

	/**
	 * Unzip a file
	 */
	private function unzip( string $file ): bool {
		if ( ! file_exists( $file ) ) {
			return false;
		}
		$zip = new \ZipArchive();
		$res = $zip->open( $file );
		if ( $res === true ) {
			$zip->extractTo( dirname( $file ) );
			$zip->close();
			return true;
		}

		return false;
	}

	/**
	 * Create csv file from array
	 *
	 * @throws \Exception //exception.
	 */
	private function append_to_csv_file( array $data, array $data_args ): void {
		// set the path.
		$file    = $this->get_file_name( $data_args );
		$headers = false;
		if ( ! file_exists( $file ) ) {
			// file doesn't exist yet, so add headers based on $data.
			$headers = (array) $data[0];
			$headers = array_keys( $headers );
		}

		// 'a' creates file if not existing, otherwise appends.
        // phpcs:ignore
		$csv_handle = fopen( $file, 'ab' );

		if ( $headers ) {
			fputcsv( $csv_handle, $headers, ',', '"', '\\' );
		}
		foreach ( $data as $line ) {
			$line = array_values( get_object_vars( $line ) );
			fputcsv( $csv_handle, $line, ',', '"', '\\' );
		}

        //phpcs:ignore
		fclose( $csv_handle );
	}

	/**
	 * Get `rows_per_batch` rows of data from a CSV file and remove the extracted data from the file.
	 *
	 * @param string $filename Path to the CSV file.
	 * @return array{
	 *     columns: array<int, string>,
	 *     data: array<int, array<int, string|null>>
	 * }|array{} Returns structured CSV data, or an empty array on failure.
	 */
	private function get_csv_data( string $filename ): array {
		global $wp_filesystem;
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( ! WP_Filesystem() ) {
			return [];
		}

		if ( ! file_exists( $filename ) ) {
			return [];
		}

		$rows_to_extract = $this->rows_per_batch;
		$extracted_rows  = [];
		$output_file     = str_replace( '.csv', '.tmp', $filename );

		// Open the input CSV file for reading.
        //phpcs:ignore
		$input_file = fopen( $filename, 'r' );
		if ( $input_file === false ) {
			return [];
		}

		// Open a temporary output file for writing the remaining rows.
        //phpcs:ignore
		$output_file_tmp = fopen( $output_file . '.tmp', 'w' );
		if ( $output_file_tmp === false ) {
            //phpcs:ignore
			fclose( $input_file );
			return [];
		}
		// retrieve the first row, which contains the column names.
		$columns = fgetcsv( $input_file, null, ',', '"', '\\' );
		// Extract the first 500 rows and write them to the output file.
		for ( $i = 0; $i < $rows_to_extract; $i++ ) {
			$row = fgetcsv( $input_file, null, ',', '"', '\\' );
			if ( $row !== false ) {
				$extracted_rows[] = $row;
			} else {
				// Exit the loop if no more rows are available.
				break;
			}
		}

		// write the headers again.
		fputcsv( $output_file_tmp, $columns, ',', '"', '\\' );
		// Write the remaining rows to the temporary output file.
        // phpcs:ignore
		while ( ( $row = fgetcsv( $input_file, null, ',', '"', '\\' ) ) !== false ) {
			fputcsv( $output_file_tmp, $row, ',', '"', '\\' );
		}

		// Close the input and temporary output files.
        //phpcs:ignore
		fclose( $input_file );
        //phpcs:ignore
		fclose( $output_file_tmp );
		wp_delete_file( $filename );

		// Replace the original CSV file with the modified version.
		if ( ! $wp_filesystem->move( $output_file . '.tmp', $filename, true ) ) {
			return [];
		}

		if ( count( $extracted_rows ) <= 1 ) {
			wp_delete_file( $filename );
			return [];
		}

		return [
			'columns' => $columns,
			'data'    => $extracted_rows,
		];
	}

	/**
	 * Delete the csv file
	 */
	private function delete_csv( array $data_args ): void {
		$file = $this->get_file_name( $data_args );
		if ( file_exists( $file ) ) {
			wp_delete_file( $file );
		}
	}

	/**
	 * Get file name including path
	 */
	private function get_file_name( array $data_args, string $ext = 'csv' ): string {
		$year  = (int) $data_args['year'];
		$month = (int) $data_args['month'];
		// enforce two digits for month number.
		$month = sprintf( '%02d', $month );
		$year  = sprintf( '%02d', $year );
		$name  = $year . '-' . $month;
		require_once ABSPATH . 'wp-admin/includes/file.php';

		$upload_dir = $this->archive_upload_dir();

		// set the path.
		return $upload_dir . $name . ".$ext";
	}

	/**
	 * Get the download url
	 */
	public function download_url(): string {
		if ( ! $this->user_can_manage() ) {
			return '';
		}
		// create random directory name with a hash of 24 characters.
		$dir = get_option( 'burst_archive_dir' );
		$url = $this->upload_url( $dir );
		return trailingslashit( $url );
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
	private function get_data_args(): array {
		// get oldest timestamp from the database.
		$oldest_timestamp = $this->get_oldest_timestamp();
		$month            = gmdate( 'm', $oldest_timestamp );
		$year             = gmdate( 'y', $oldest_timestamp );

		// get the timestamp for the first second of the next month.
		$unix_start = $this->get_timestamp_for_month( $oldest_timestamp, 0 );
		$unix_end   = $this->get_timestamp_for_month( $oldest_timestamp, 1 );

		// never archive after the months_ago limit.
		$months_ago = apply_filters( 'burst_archive_after_months', $this->archive_after_months );
		// enforce at least 12 months.
		if ( $months_ago <= 12 ) {
			$months_ago = 12;
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
                              PRIMARY KEY (ID)
                            ) $charset_collate;";
		dbDelta( $sql );
	}
}
