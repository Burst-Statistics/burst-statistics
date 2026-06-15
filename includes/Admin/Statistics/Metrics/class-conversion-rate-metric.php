<?php
/**
 * Conversion rate metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Conversion_Rate_Metric - Handles SQL generation for the 'conversion_rate' metric.
 */
class Conversion_Rate_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'conversion_rate';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'ROUND(COALESCE(COUNT(DISTINCT goals.ID) / NULLIF(COUNT(DISTINCT statistics.session_id), 0), 0) * 100, 2) AS conversion_rate' );
		$qd->with( 'goals' );
	}
}
