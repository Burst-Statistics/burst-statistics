<?php
/**
 * First time visitors metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class First_Time_Visitors_Metric - Handles SQL generation for the 'first_time_visitors' metric.
 */
class First_Time_Visitors_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'first_time_visitors';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce = 'COALESCE(sessions.bounce, 0) = 0';
		$expr       = $qd->get_exclude_bounces()
			? "COALESCE( COUNT(DISTINCT CASE WHEN {$non_bounce} AND sessions.first_time_visit = 1 THEN statistics.uid END), 0) AS first_time_visitors"
			: 'COUNT(DISTINCT CASE WHEN sessions.first_time_visit = 1 THEN statistics.uid END) AS first_time_visitors';
		$qd->add_select( $expr );
		$qd->with( 'sessions' );
	}
}
