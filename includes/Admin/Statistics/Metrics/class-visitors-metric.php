<?php
/**
 * Visitors metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Visitors_Metric - Handles SQL generation for the 'visitors' metric.
 */
class Visitors_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'visitors';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce = 'COALESCE(sessions.bounce, 0) = 0';
		// NULLIF: the uid-0 bucket (unresolved visitors) is many unknown
		// visitors collapsed into one value — counting it as one fake visitor
		// made the SQL paths disagree by one with the bitmap path, which
		// excludes uid 0. The alias survives the session-grain FROM swap
		// (uid = uid_id there), so both grains stay aligned with bitmaps.
		$expr = $qd->get_exclude_bounces()
			? "COUNT(DISTINCT CASE WHEN {$non_bounce} THEN NULLIF(statistics.uid_id, 0) END) AS visitors"
			: 'COUNT(DISTINCT NULLIF(statistics.uid_id, 0)) AS visitors';
		$qd->add_select( $expr );
		$qd->with( 'sessions' );
	}
}
