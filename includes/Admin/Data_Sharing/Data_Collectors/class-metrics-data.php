<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Data_Sharing\Data_Collectors\Metrics\Traffic_Metrics;
use Burst\Admin\Data_Sharing\Data_Collectors\Metrics\Ecommerce_Metrics;
use Burst\Admin\Data_Sharing\Data_Collectors\Metrics\Database_Metrics;
use Burst\Admin\Data_Sharing\Data_Collectors\Metrics\Query_Stats_Metrics;

/**
 * Class Metrics_Data
 * Collects aggregated, non-personal metrics data
 */
class Metrics_Data extends Data_Collector {
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
	 * Collect all aggregated metrics
	 */
	public function collect_data(): array {
		return [
			'aggregation_period' => $this->get_aggregation_period(),
			'traffic'            => $this->collect_traffic_metrics(),
			'ecommerce'          => $this->collect_ecommerce_metrics(),
			'database'           => $this->collect_database_metrics(),
			'query_stats'        => $this->collect_query_stats_metrics(),
		];
	}

	/**
	 * Aggregation period (last fully completed calendar month)
	 */
	private function get_aggregation_period(): array {
		return [
			'start_date' => gmdate( 'Y-m-d', $this->capture_data_from ),
			'end_date'   => gmdate( 'Y-m-d', $this->capture_data_to ),
		];
	}

	/**
	 * Traffic metrics (aggregated)
	 */
	private function collect_traffic_metrics(): array {
		$collector = new Traffic_Metrics( $this->capture_data_from, $this->capture_data_to );

		return $collector->collect();
	}

	/**
	 * Ecommerce metrics (conditional)
	 */
	private function collect_ecommerce_metrics(): ?array {
		$collector = new Ecommerce_Metrics( $this->capture_data_from, $this->capture_data_to );

		return $collector->collect();
	}

	/**
	 * Database metrics
	 */
	private function collect_database_metrics(): array {
		$collector = new Database_Metrics();

		return $collector->collect();
	}

	/**
	 * Query performance metrics
	 */
	private function collect_query_stats_metrics(): array {
		$collector = new Query_Stats_Metrics( $this->capture_data_from, $this->capture_data_to );

		return $collector->collect();
	}
}
