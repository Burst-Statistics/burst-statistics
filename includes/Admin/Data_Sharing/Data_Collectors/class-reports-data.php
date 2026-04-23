<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Reports\Report;
use Burst\Admin\Reports\DomainTypes\Report_Log_Status;
use Burst\Traits\Helper;

/**
 * Class Reports_Data
 */
class Reports_Data extends Data_Collector {
	use Helper;

	private int $capture_data_from;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from ) {
		$this->capture_data_from = $capture_data_from;
	}

	/**
	 * Collect data from reports
	 */
	public function collect_data(): array {
		return [
			'reports' => $this->get_reports_configuration(),
			'logs'    => $this->get_report_logs(),
		];
	}

	/**
	 * Get reports configuration
	 */
	private function get_reports_configuration(): array {
		global $wpdb;

		$ids = $wpdb->get_col(
			"SELECT ID FROM {$wpdb->prefix}burst_reports ORDER BY last_edit DESC"
		);

		$reports = [];

		foreach ( $ids as $id ) {
			$report = new Report( (int) $id );

			if ( empty( $report->id ) ) {
				continue;
			}

			$filtered_report              = [];
			$filtered_report['report_id'] = $report->id;
			$filtered_report['frequency'] = $report->frequency;
			$filtered_report['format']    = $report->format;

			// Extract only the string IDs from content blocks, filter out any non-strings.
			$filtered_report['content_types']    = array_values(
				array_filter(
					array_map(
						function ( $block ) {
							if ( is_string( $block ) ) {
								return $block;
							}

							if ( is_array( $block ) && isset( $block['id'] ) && is_string( $block['id'] ) ) {
								return $block['id'];
							}

							return null;
						},
						$report->content
					),
					function ( $value ) {
						return is_string( $value ) && ! empty( $value );
					}
				)
			);
			$filtered_report['recipients_count'] = count( $report->recipients );
			$reports[]                           = $filtered_report;
		}

		return $reports;
	}

	/**
	 * Get report logs statistics
	 *
	 * @return array|null Report logs data or null if no data
	 */
	private function get_report_logs(): ?array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT report_id, queue_id, batch_id, status
				FROM {$wpdb->prefix}burst_report_logs
				WHERE time >= %d
				AND queue_id NOT LIKE %s",
				$this->capture_data_from,
				'test-%'
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return null;
		}

		$queue_states = [];

		foreach ( $rows as $row ) {
			$key = sprintf( '%d|%s', (int) $row['report_id'], $row['queue_id'] );

			if ( ! isset( $queue_states[ $key ] ) ) {
				$queue_states[ $key ] = [
					'parent_status'  => null,
					'child_statuses' => [],
				];
			}

			if ( $row['batch_id'] === null ) {
				$queue_states[ $key ]['parent_status'] = Report_Log_Status::from_string( (string) $row['status'] );
				continue;
			}

			$queue_states[ $key ]['child_statuses'][] = Report_Log_Status::from_string( (string) $row['status'] );
		}

		$reports_sent     = 0;
		$successful_sends = 0;
		$failed_sends     = 0;

		foreach ( $queue_states as $queue_state ) {
			$final_status = $this->resolve_queue_status( $queue_state['parent_status'], $queue_state['child_statuses'] );

			if ( $final_status === null || Report_Log_Status::PROCESSING === $final_status ) {
				continue;
			}

			++$reports_sent;

			if ( Report_Log_Status::SENDING_SUCCESSFUL === $final_status ) {
				++$successful_sends;
				continue;
			}

			if ( $this->is_failed_status( $final_status ) ) {
				++$failed_sends;
			}
		}

		if ( empty( $reports_sent ) && empty( $successful_sends ) && empty( $failed_sends ) ) {
			return null;
		}

		return [
			'reports_sent_last_month' => $reports_sent,
			'successful_sends'        => $successful_sends,
			'failed_sends'            => $failed_sends,
		];
	}

	/**
	 * Resolve the final queue status from parent and child logs.
	 *
	 * @param string|null $parent_status  Parent queue status (batch_id is null).
	 * @param array       $child_statuses Child batch statuses.
	 * @return string|null Resolved queue status
	 */
	private function resolve_queue_status( ?string $parent_status, array $child_statuses ): ?string {
		if ( ! empty( $parent_status ) && Report_Log_Status::PROCESSING !== $parent_status ) {
			return $parent_status;
		}

		if ( empty( $child_statuses ) ) {
			return $parent_status;
		}

		if ( in_array( Report_Log_Status::PARTLY_SENT, $child_statuses, true ) ) {
			return Report_Log_Status::PARTLY_SENT;
		}

		$unique_statuses = array_values( array_unique( $child_statuses ) );

		if ( count( $unique_statuses ) === 1 ) {
			return $unique_statuses[0];
		}

		return Report_Log_Status::SENDING_FAILED;
	}

	/**
	 * Check if status should be counted as failed.
	 *
	 * @param string $status Status.
	 * @return bool whether given status is true or false
	 */
	private function is_failed_status( string $status ): bool {
		return in_array(
			$status,
			[
				Report_Log_Status::SENDING_FAILED,
				Report_Log_Status::EMAIL_DOMAIN_ERROR,
				Report_Log_Status::EMAIL_ADDRESS_ERROR,
				Report_Log_Status::CRON_MISS,
				Report_Log_Status::PARTLY_SENT,
			],
			true
		);
	}
}
