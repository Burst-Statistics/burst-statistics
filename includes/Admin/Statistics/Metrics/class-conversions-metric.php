<?php
/**
 * Conversions metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Conversions_Metric - Handles SQL generation for the 'conversions' metric.
 */
class Conversions_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'conversions';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'COUNT(DISTINCT goals.ID) AS conversions' );
		$qd->with( 'goals' );
	}
}
