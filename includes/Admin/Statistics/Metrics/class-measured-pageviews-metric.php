<?php
/**
 * Measured pageviews metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Handles SQL generation for the 'measured_pageviews' metric.
 */
class Measured_Pageviews_Metric implements Metric_Handler_Interface {

	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'measured_pageviews';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * Counts the hits on a page with enough samples to report. Held against
	 * pageviews this gives the measurement coverage the block shows while it is
	 * still sampling.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		// Same two branches as Pageviews_Metric, so the coverage ratio always
		// divides like by like. COUNT(column) skips the NULL weights of
		// unmeasured pages without the dedup temp table COUNT(DISTINCT) needs.
		$expr = 'COUNT(page_weights.page_weight) AS measured_pageviews';
		if ( $qd->get_exclude_bounces() ) {
			$expr = 'COUNT(DISTINCT CASE WHEN COALESCE(sessions.bounce, 0) = 0 AND page_weights.page_weight IS NOT NULL THEN statistics.ID END) AS measured_pageviews';
			$qd->with( 'sessions' );
		}

		$qd->add_select( $expr );
		$qd->with( 'page_weights' );
	}
}
