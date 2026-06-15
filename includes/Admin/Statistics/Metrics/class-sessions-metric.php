<?php
/**
 * Sessions metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Sessions_Metric - Handles SQL generation for the 'sessions' metric.
 */
class Sessions_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'sessions';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce = 'COALESCE(sessions.bounce, 0) = 0';
		$expr       = $qd->get_exclude_bounces()
			? "COUNT( DISTINCT CASE WHEN {$non_bounce} THEN statistics.session_id END ) AS sessions"
			: 'COUNT( DISTINCT statistics.session_id ) AS sessions';
		$qd->add_select( $expr );
		$qd->with( 'sessions' );
	}
}
