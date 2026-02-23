<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Reports\Report;
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

		$reports_sent = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}burst_report_logs WHERE time >= %d",
				$this->capture_data_from
			)
		);

		$successful_sends = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) 
            FROM {$wpdb->prefix}burst_report_logs
            WHERE time >= %d 
            AND status IN ('sent', 'success')",
				$this->capture_data_from
			)
		);

		$failed_sends = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) 
            FROM {$wpdb->prefix}burst_report_logs 
            WHERE time >= %d 
            AND status IN ('failed', 'error')",
				$this->capture_data_from
			)
		);

		if ( empty( $reports_sent ) && empty( $successful_sends ) && empty( $failed_sends ) ) {
			return null;
		}

		return [
			'reports_sent_last_month' => (int) $reports_sent,
			'successful_sends'        => (int) $successful_sends,
			'failed_sends'            => (int) $failed_sends,
		];
	}
}
