<?php
namespace Burst\Admin\Reports;

use Burst\Admin\Reports\DomainTypes\Report_Format;
use Burst\Admin\Reports\DomainTypes\Report_Log_Status;
use Burst\Traits\Database_Helper;

use function Burst\burst_loader;

defined( 'ABSPATH' ) || exit;

class Report_Logs {
	use Database_Helper;

	/**
	 * Singleton instance
	 */
	private static ?self $instance = null;

	/**
	 * Return instance of the class
	 *
	 * @return self Instance
	 */
	public static function instance(): self {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Initialize hooks
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_table' ] );
		add_filter( 'burst_all_tables', [ $this, 'burst_add_reports_table' ] );
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
	}

	/**
	 * Get the report log delete threshold in days.
	 *
	 * @return int Threshold in days.
	 */
	private function get_report_delete_threshold(): int {
		return apply_filters( 'burst_report_log_delete_threshold', 30 );
	}

	/**
	 * Clean old logs based on the delete threshold
	 */
	public function clean_old_logs(): void {
		global $wpdb;

		$threshold = time() - $this->get_report_delete_threshold() * DAY_IN_SECONDS;

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_report_logs WHERE time < %d",
				$threshold
			)
		);
	}

	/**
	 * Register REST API routes
	 */
	public function register_rest_routes(): void {
		register_rest_route(
			'burst/v1',
			'/report/logs',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_logs_rest_action' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);
	}

	/**
	 * REST API action to get report logs
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response Response object.
	 */
	public function get_logs_rest_action( \WP_REST_Request $request ): \WP_REST_Response {
		if ( ! $this->user_can_view() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}

		$nonce = $request->get_param( 'nonce' );

		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => burst_loader()->admin->app->nonce_expired_feedback,
				]
			);
		}

		$logs = $this->get_logs();

		return new \WP_REST_Response(
			[
				'request_success' => true,
				'data'            => [
					'logs' => $logs,
				],
			],
			200
		);
	}

	/**
	 * Add report logs table to all tables list.
	 *
	 * @param array $tables Tables list.
	 * @return array Updated tables list.
	 */
	public function burst_add_reports_table( array $tables ): array {
		$tables[] = 'burst_report_logs';
		return $tables;
	}

	/**
	 * Install the report logs table
	 */
	public function install_table(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$wpdb->prefix}burst_report_logs (
			ID bigint unsigned NOT NULL AUTO_INCREMENT,
			report_id bigint unsigned NOT NULL,
			queue_id varchar(32) NOT NULL,
			batch_id int unsigned DEFAULT NULL,
			status varchar(32) NOT NULL,
			message text DEFAULT NULL,
			time int unsigned NOT NULL,
			date varchar(10) NOT NULL,
			PRIMARY KEY (ID)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		$indexes = [
			[ 'report_id' ],
			[ 'queue_id' ],
			[ 'batch_id' ],
			[ 'date' ],
			[ 'status' ],
			[ 'report_id', 'queue_id' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( "{$wpdb->prefix}burst_report_logs", $index );
		}
	}

	/**
	 * Sanitize status value.
	 *
	 * @param string $status Status.
	 * @return string Sanitized status.
	 */
	private function sanitize_status( string $status ): string {
		return Report_Log_Status::from_string( $status );
	}

	/**
	 * Update a log entry.
	 *
	 * @param int      $report_id Report ID.
	 * @param string   $queue_id  Queue ID.
	 * @param int|null $batch_id  Batch ID.
	 * @param string   $status    Status.
	 * @param string   $message   Optional message.
	 */
	public function update_log(
		int $report_id,
		string $queue_id,
		?int $batch_id,
		string $status,
		string $message = ''
	): void {
		global $wpdb;
		$status = $this->sanitize_status( $status );
		$time   = time();

		if ( $batch_id === null ) {
			$wpdb->update(
				"{$wpdb->prefix}burst_report_logs",
				[
					'status'  => $status,
					'message' => $message,
					'time'    => $time,
				],
				[
					'report_id' => $report_id,
					'queue_id'  => $queue_id,
					'batch_id'  => null,
				],
				[
					'%s',
					'%s',
					'%d',
				],
				[
					'%d',
					'%s',
					'NULL',
				]
			);
		} else {
			$wpdb->update(
				"{$wpdb->prefix}burst_report_logs",
				[
					'status'  => $status,
					'message' => $message,
					'time'    => $time,
				],
				[
					'report_id' => $report_id,
					'queue_id'  => $queue_id,
					'batch_id'  => $batch_id,
				],
				[
					'%s',
					'%s',
					'%d',
				],
				[
					'%d',
					'%s',
					'%d',
				]
			);
		}
	}

	/**
	 * Insert a log entry.
	 *
	 * @param int      $report_id Report ID.
	 * @param string   $queue_id  Queue ID (date string or test-{date}-{timestamp}).
	 * @param int|null $batch_id  Batch ID.
	 * @param string   $status    Status.
	 * @param string   $message   Optional message.
	 */
	public function insert_log(
		int $report_id,
		string $queue_id,
		?int $batch_id,
		string $status,
		string $message = ''
	): void {
		global $wpdb;

		$status = $this->sanitize_status( $status );
		$time   = time();

		$wpdb->insert(
			"{$wpdb->prefix}burst_report_logs",
			[
				'report_id' => $report_id,
				'queue_id'  => $queue_id,
				'batch_id'  => $batch_id,
				'status'    => $status,
				'message'   => $message,
				'time'      => $time,
				'date'      => $this->extract_date_from_queue_id( $queue_id ),
			],
			[
				// report_id.
				'%d',
				// queue_id.
				'%s',
				// batch_id.
				$batch_id === null ? 'NULL' : '%d',
				// status.
				'%s',
				// message.
				'%s',
				// time.
				'%d',
				// date.
				'%s',
			]
		);
	}

	/**
	 * Extract date from queue_id.
	 * Handles both regular queue IDs (Y-m-d) and test queue IDs (test-Y-m-d-timestamp).
	 *
	 * @param string $queue_id Queue ID.
	 * @return string Date in Y-m-d format.
	 */
	private function extract_date_from_queue_id( string $queue_id ): string {
		// Check if it's a test queue ID (format: test-Y-m-d-timestamp).
		if ( strpos( $queue_id, 'test-' ) === 0 ) {
			// Extract the date portion (remove 'test-' prefix and timestamp suffix).
			$parts = explode( '-', $queue_id );
			if ( count( $parts ) >= 4 ) {
				return $parts[1] . '-' . $parts[2] . '-' . $parts[3];
			}
		}

		// Regular queue ID or fallback.
		return $queue_id;
	}

	/**
	 * Check if a log entry exists.
	 *
	 * @param int      $report_id Report ID.
	 * @param string   $queue_id  Queue ID.
	 * @param int|null $batch_id  Batch ID.
	 * @return bool True if exists, false otherwise.
	 */
	public function queue_exists(
		int $report_id,
		string $queue_id,
		?int $batch_id
	): bool {
		global $wpdb;

		if ( $batch_id === null ) {
			return (bool) $wpdb->get_var(
				$wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}burst_report_logs WHERE report_id=%d AND queue_id=%s AND batch_id IS NULL", $report_id, $queue_id )
			);
		}

		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_report_logs WHERE report_id=%d AND queue_id=%s AND batch_id=%d",
				$report_id,
				$queue_id,
				$batch_id
			)
		);
	}

	/**
	 * Update not sent reports and log cron misses.
	 */
	public function update_not_sent_reports(): void {
		global $wpdb;

		$reports_obj = new Reports();
		$reports     = $reports_obj->get_enabled_scheduled_reports();

		foreach ( $reports as $report ) {
			$report_obj = new Report( $report['ID'] );

			if ( empty( $report_obj->next_send_timestamp ) || $report_obj->next_send_timestamp > time() - DAY_IN_SECONDS ) {
				continue;
			}

			$date = gmdate( 'Y-m-d', $report_obj->next_send_timestamp );

			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT ID FROM {$wpdb->prefix}burst_report_logs WHERE report_id=%d AND date=%s AND batch_id IS NOT NULL",
					$report['ID'],
					$date
				)
			);

			if ( ! $exists ) {
				$this->insert_log(
					(int) $report['ID'],
					$date,
					null,
					Report_Log_Status::CRON_MISS,
					__( 'Email sending has not been triggered in time. Please check if cron jobs are configured correctly.', 'burst-statistics' )
				);
			}
		}
	}

	/**
	 * Get aggregated logs.
	 *
	 * @param int|null $report_id Optional report ID to filter.
	 * @return array Aggregated logs.
	 */
	public function get_logs( ?int $report_id = null ): array {
		global $wpdb;

		$this->update_not_sent_reports();

		$where = 'WHERE time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 MONTH))';
		if ( ! empty( $report_id ) ) {
			$where .= $wpdb->prepare( ' AND report_id=%d', $report_id );
		}

		$rows = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where is safely constructed above.
			"SELECT * FROM {$wpdb->prefix}burst_report_logs {$where} ORDER BY time DESC",
			ARRAY_A
		);

		return $this->aggregate( $rows );
	}

	/**
	 * Aggregate log entries.
	 *
	 * @param array $rows Log rows.
	 * @return array Aggregated logs.
	 */
	private function aggregate( array $rows ): array {
		$result = [];

		$parent_logs = array_filter(
			$rows,
			function ( $r ) {
				return $r['batch_id'] === null;
			}
		);

		foreach ( $parent_logs as $parent_log ) {
			$key = sprintf( '%d|%s', (int) $parent_log['report_id'], $parent_log['queue_id'] );

			$report = new Report( (int) $parent_log['report_id'] );

			if ( empty( $report->id ) ) {
				$report_name = __( 'Deleted Report', 'burst-statistics' );
			} else {
				$report_name = $report->name;
			}
			if ( ! isset( $result[ $key ] ) ) {
				$result[ $key ] = [
					'report_name' => $report_name,
					'report_id'   => (int) $parent_log['report_id'],
					'queue_id'    => $parent_log['queue_id'],
					'time'        => (int) $parent_log['time'],
					'status'      => Report_Log_Status::from_string( $parent_log['status'] ),
					'message'     => $parent_log['message'] ?? '',
					'batches'     => [],
				];
			}
		}

		$child_logs = array_filter(
			$rows,
			function ( $r ) {
				return $r['batch_id'] !== null;
			}
		);

		foreach ( $child_logs as $child_log ) {
			$key = sprintf( '%d|%s', (int) $child_log['report_id'], $child_log['queue_id'] );

			// If parent log doesn't exist, then it's a rare case but it's orphaned child log, so we skip it.
			if ( ! isset( $result[ $key ] ) ) {
				continue;
			}

			$result[ $key ]['batches'][] = [
				'batch_id' => $child_log['batch_id'],
				'status'   => Report_Log_Status::from_string( $child_log['status'] ),
				'message'  => $child_log['message'] ?? '',
				'time'     => (int) $child_log['time'],
			];

			$result[ $key ]['time'] = max(
				$result[ $key ]['time'],
				(int) $child_log['time']
			);
		}

		usort(
			$result,
			fn ( $a, $b ) => $b['time'] <=> $a['time']
		);

		return $result;
	}

	/**
	 * Finalize the queue status after all batches are processed.
	 *
	 * @param int    $report_id Report ID.
	 * @param string $queue_id  Queue ID.
	 */
	public function finalize_queue_status(
		int $report_id,
		string $queue_id
	): void {
		global $wpdb;

		$existing_status = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT status FROM {$wpdb->prefix}burst_report_logs WHERE report_id=%d AND queue_id=%s AND batch_id IS NULL",
				$report_id,
				$queue_id
			)
		);

		if ( $existing_status !== Report_Log_Status::PROCESSING ) {
			return;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT status, message
					FROM {$wpdb->prefix}burst_report_logs
					WHERE report_id = %d
					AND queue_id = %s
					AND batch_id IS NOT NULL",
				$report_id,
				$queue_id
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			$status  = Report_Log_Status::SENDING_FAILED;
			$message = __( 'No batches were processed.', 'burst-statistics' );
		} else {
			$statuses = array_column( $rows, 'status' );
			if ( in_array( Report_Log_Status::PARTLY_SENT, $statuses, true ) ) {
				$status  = Report_Log_Status::PARTLY_SENT;
				$message = Report_Log_Status::get_log_message( Report_Log_Status::PARTLY_SENT );
			} elseif ( count( array_unique( $statuses ) ) === 1 ) {
				$status  = $statuses[0];
				$message = Report_Log_Status::get_log_message( $statuses[0] );
			} else {
				$status  = Report_Log_Status::SENDING_FAILED;
				$message = Report_Log_Status::get_log_message( Report_Log_Status::SENDING_FAILED );
			}
		}

		$this->update_log(
			$report_id,
			$queue_id,
			null,
			$status,
			$message
		);
	}

	/**
	 * Get the current status of a report.
	 *
	 * @param int $report_id Report ID.
	 * @return array Status and message.
	 */
	public function get_report_status( int $report_id ): array {
		$report = new Report( $report_id );

		if ( $report->format === Report_Format::STORY ) {
			return [
				'status'  => 'ready_to_send',
				'message' => __( 'Ready to send', 'burst-statistics' ),
			];
		}

		if ( ! $report->enabled ) {
			return [
				'status'  => 'concept',
				'message' => __( 'Concept', 'burst-statistics' ),
			];
		}

		$logs   = $this->get_logs( $report_id );
		$latest = $logs[0] ?? null;

		if ( ! $latest ) {
			return [
				'status'  => 'scheduled',
				'message' => __( 'Scheduled', 'burst-statistics' ),
			];
		}

		return [
			'status'  => $latest['status'],
			'message' => Report_Log_Status::get_log_message( $latest['status'] ),
		];
	}


	/**
	 * Check if a parent processing log exists for a report and queue.
	 *
	 * @param int    $report_id Report ID.
	 * @param string $queue_id  Queue ID.
	 * @return bool True if exists, false otherwise.
	 */
	public function parent_processing_exists(
		int $report_id,
		string $queue_id
	): bool {
		global $wpdb;

		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->prefix}burst_report_logs
            		WHERE report_id=%d
            		AND queue_id=%s
            		AND batch_id IS NULL",
				$report_id,
				$queue_id
			)
		);
	}
}
