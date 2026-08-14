<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Traffic_Metrics
 */
class Traffic_Metrics {

	private int $capture_data_from;

	private int $capture_data_to;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
	}

	/**
	 * Collect traffic metrics
	 *
	 * @return array {
	 *     @type int   $visitors                   Number of visitors.
	 *     @type int   $pageviews                  Number of pageviews.
	 *     @type float $average_bounce_rate        Average bounce rate.
	 *     @type float $average_session_duration   Legacy average session duration value in milliseconds.
	 *     @type float $pageviews_per_session      Optional. Average pageviews per session when sessions exist.
	 *     @type float $time_per_session           Optional. Average time per session in milliseconds when sessions exist.
	 *     @type float $new_visitors_percentage    Percentage of visitors who are new.
	 *     @type float $conversion_rate            Optional. Aggregate goal conversions per pageview percentage when active goals exist.
	 *     @type float $average_time_on_page        Average time on page in milliseconds.
	 * }
	 */
	public function collect(): array {
		$args = [
			'date_start' => $this->capture_data_from,
			'date_end'   => $this->capture_data_to,
		];

		$data = burst_loader()->admin->statistics->get_compare_data( $args );

		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$has_active_goals = (bool) $wpdb->get_var( "SELECT 1 FROM {$wpdb->prefix}burst_goals WHERE status = 'active' LIMIT 1" );

		if ( empty( $data ) || empty( $data['current'] ) ) {
			$traffic_metrics = [
				'visitors'                 => 0,
				'pageviews'                => 0,
				'average_bounce_rate'      => 0.0,
				'average_session_duration' => 0.0,
				'new_visitors_percentage'  => 0.0,
				'average_time_on_page'     => 0.0,
				'devices'                  => [
					'desktop' => 0.0,
					'tablet'  => 0.0,
					'mobile'  => 0.0,
					'other'   => 0.0,
				],
			];

			if ( $has_active_goals ) {
				$traffic_metrics['conversion_rate'] = 0.0;
			}

			return $traffic_metrics;
		}

		$current_data = $data['current'];
		$pageviews    = (int) ( $current_data['pageviews'] ?? 0 );
		$sessions     = (int) ( $current_data['sessions'] ?? 0 );
		$visitors     = (int) ( $current_data['visitors'] ?? 0 );
		$new_visitors = (int) ( $current_data['first_time_visitors'] ?? 0 );
		$time_on_page = max( 0.0, (float) ( $current_data['avg_time_on_page'] ?? 0 ) );

		$new_visitors_percentage = 0 === $visitors ? 0.0 : min( 100.0, round( ( $new_visitors / $visitors ) * 100, 2 ) );

		$devices_data      = burst_loader()->admin->statistics->get_devices_title_and_value_data( $args );
		$all_devices_count = max( 1, (int) ( $devices_data['all']['count'] ?? 0 ) );
		$devices_shares    = [
			'desktop' => round( ( (int) ( $devices_data['desktop']['count'] ?? 0 ) / $all_devices_count ) * 100, 2 ),
			'tablet'  => round( ( (int) ( $devices_data['tablet']['count'] ?? 0 ) / $all_devices_count ) * 100, 2 ),
			'mobile'  => round( ( (int) ( $devices_data['mobile']['count'] ?? 0 ) / $all_devices_count ) * 100, 2 ),
			'other'   => round( ( (int) ( $devices_data['other']['count'] ?? 0 ) / $all_devices_count ) * 100, 2 ),
		];

		$traffic_metrics = [
			'visitors'                 => $visitors,
			'pageviews'                => $pageviews,
			'average_bounce_rate'      => (float) ( $current_data['bounce_rate'] ?? 0 ),
			'average_session_duration' => $time_on_page,
			'new_visitors_percentage'  => $new_visitors_percentage,
			'average_time_on_page'     => $time_on_page,
			'devices'                  => $devices_shares,
		];

		if ( 0 < $sessions ) {
			$traffic_metrics['pageviews_per_session'] = round( $pageviews / $sessions, 2 );
			$traffic_metrics['time_per_session']      = round( ( $pageviews / $sessions ) * $time_on_page, 2 );
		}

		if ( $has_active_goals ) {
			$goals_data                         = burst_loader()->admin->statistics->get_compare_goals_data( $args );
			$traffic_metrics['conversion_rate'] = max( 0.0, (float) ( $goals_data['current']['conversion_rate'] ?? 0 ) );
		}

		return $traffic_metrics;
	}
}
