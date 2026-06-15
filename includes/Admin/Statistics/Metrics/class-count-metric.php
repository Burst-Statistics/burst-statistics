<?php
/**
 * Count metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Count_Metric - Handles SQL generation for the 'count' metric.
 */
class Count_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'count';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce = 'COALESCE(sessions.bounce, 0) = 0';
		$expr       = $qd->get_exclude_bounces()
			? "COUNT(DISTINCT CASE WHEN {$non_bounce} THEN statistics.ID END) AS count"
			: 'COUNT(DISTINCT statistics.ID) AS count';
		$qd->add_select( $expr );
		if ( $qd->get_exclude_bounces() ) {
			$qd->with( 'sessions' );
		}
	}
}
