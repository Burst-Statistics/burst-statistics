<?php
/**
 * Bounces metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Bounces_Metric - Handles SQL generation for the 'bounces' metric.
 */
class Bounces_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'bounces';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'COUNT(DISTINCT CASE WHEN sessions.bounce = 1 THEN sessions.ID END) AS bounces' );
		$qd->with( 'sessions' );
	}
}
