<?php
/**
 * Bounce rate metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Bounce_Rate_Metric - Handles SQL generation for the 'bounce_rate' metric.
 */
class Bounce_Rate_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'bounce_rate';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'ROUND(COALESCE(COUNT(DISTINCT CASE WHEN sessions.bounce = 1 THEN sessions.ID END) / NULLIF(COUNT(DISTINCT sessions.ID), 0), 0) * 100, 2) AS bounce_rate' );
		$qd->with( 'sessions' );
	}
}
