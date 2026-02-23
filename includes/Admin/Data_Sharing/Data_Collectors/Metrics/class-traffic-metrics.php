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
	 *     @type int   $visitors                 Number of visitors.
	 *     @type int   $pageviews                Number of pageviews.
	 *     @type float $average_bounce_rate      Average bounce rate.
	 *     @type int   $average_session_duration Average session duration in seconds.
	 * }
	 */
	public function collect(): array {
		$args = [
			'date_start' => $this->capture_data_from,
			'date_end'   => $this->capture_data_to,
		];

		$data = burst_loader()->admin->statistics->get_compare_data( $args );

		if ( empty( $data ) || empty( $data['current'] ) ) {
			return [
				'visitors'                 => 0,
				'pageviews'                => 0,
				'average_bounce_rate'      => 0,
				'average_session_duration' => 0,
			];
		}

		$current_data = $data['current'];

		return [
			'visitors'                 => (int) ( $current_data['visitors'] ?? 0 ),
			'pageviews'                => (int) ( $current_data['pageviews'] ?? 0 ),
			'average_bounce_rate'      => (float) ( $current_data['bounce_rate'] ?? 0 ),
			'average_session_duration' => (float) ( $current_data['avg_time_on_page'] ?? 0 ),
		];
	}
}
