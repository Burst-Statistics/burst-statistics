<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

use Burst\Pro\Admin\Ecommerce\Sales;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Ecommerce_Metrics
 */
class Ecommerce_Metrics {

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
	 * Collect ecommerce metrics
	 *
	 * @return array|null
	 */
	public function collect(): ?array {
		$metrics     = [];
		$order_stats = $this->get_order_statistics();
		$platforms   = $this->get_platforms_used();

		if ( ! empty( $platforms ) ) {
			$metrics['platforms'] = $platforms;
		} else {
			$metrics['platforms'] = [];
		}

		if ( $order_stats ) {
			$metrics['total_orders']  = (int) $order_stats->total_orders;
			$metrics['total_revenue'] = (float) $order_stats->total_revenue;
		} else {
			$metrics['total_orders']  = 0;
			$metrics['total_revenue'] = 0.0;
		}

		$args = [
			'date_start' => $this->capture_data_from,
			'date_end'   => $this->capture_data_to,
		];

		$sales_data = Sales::get_data( [], $args );

		if ( ! empty( $sales_data ) ) {

			$metrics['conversion_rate'] = isset( $sales_data['conversion-rate']['current']['conversion_rate'] )
				? (float) $sales_data['conversion-rate']['current']['conversion_rate']
				: 0.0;

			$metrics['abandoned_cart_rate'] = isset( $sales_data['abandonment-rate']['current']->abandoned_rate )
				? (float) $sales_data['abandonment-rate']['current']->abandoned_rate
				: 0.0;

			$metrics['average_order_value'] = isset( $sales_data['average-order']['current']['average_order_value'] )
				? (float) $sales_data['average-order']['current']['average_order_value']
				: 0.0;

		} else {
			$metrics['conversion_rate']     = 0.0;
			$metrics['abandoned_cart_rate'] = 0.0;
			$metrics['average_order_value'] = 0.0;
		}

		$has_data =
			! empty( $metrics['platforms'] ) ||
			0 !== $metrics['total_orders'] ||
			0.0 !== $metrics['total_revenue'] ||
			0.0 !== $metrics['conversion_rate'] ||
			0.0 !== $metrics['abandoned_cart_rate'] ||
			0.0 !== $metrics['average_order_value'];

		if ( ! $has_data ) {
			return null;
		}

		return $metrics;
	}


	/**
	 * Get eCommerce platforms used
	 */
	private function get_platforms_used(): array {
		global $wpdb;
		$platforms = [];

		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DISTINCT o.platform FROM {$wpdb->prefix}burst_orders o INNER JOIN {$wpdb->prefix}burst_statistics s ON o.statistic_id = s.ID WHERE s.time >= %d AND s.time <= %d",
				$this->capture_data_from,
				$this->capture_data_to
			)
		);

		if ( $results ) {
			foreach ( $results as $row ) {
				$platforms[] = $row->platform;
			}
		}

		return $platforms;
	}


	/**
	 * Get order statistics from wp_burst_statistics table
	 */
	private function get_order_statistics(): ?object {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT 
                COUNT(oi.ID) as total_orders,
                SUM(oi.amount * oi.price) as total_revenue
            FROM {$wpdb->prefix}burst_order_items oi
            INNER JOIN {$wpdb->prefix}burst_orders o ON oi.burst_order_id = o.ID
            INNER JOIN {$wpdb->prefix}burst_statistics s ON o.statistic_id = s.ID
            WHERE s.time >= %d
            AND s.time <= %d",
				$this->capture_data_from,
				$this->capture_data_to
			)
		);
	}
}
