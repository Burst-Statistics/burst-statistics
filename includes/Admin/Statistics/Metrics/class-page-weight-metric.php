<?php
/**
 * Page weight metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Handles SQL generation for the 'page_weight' metric.
 */
class Page_Weight_Metric implements Metric_Handler_Interface {

	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'page_weight';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * Grouped by page url this is the measured weight of that page; ungrouped it
	 * is the average weight carried by a single pageview, which is what the
	 * headline figure on the Page weight block reports.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce        = 'COALESCE(sessions.bounce, 0) = 0';
		$group_by_page_url = array_intersect( [ 'page_url', 'statistics.page_url' ], $qd->get_group_by() );

		if ( ! empty( $group_by_page_url ) ) {
			$qd->add_select( 'MAX(page_weights.page_weight) AS page_weight' );
			$qd->with( 'page_weights' );
			return;
		}

		// Only measured hits may contribute to the average, otherwise unmeasured
		// pages would drag the mean towards zero instead of being left out.
		$measured = 'page_weights.page_weight IS NOT NULL';
		if ( $qd->get_exclude_bounces() ) {
			$measured = "{$non_bounce} AND {$measured}";
			$qd->with( 'sessions' );
		}

		$qd->add_select( "ROUND(AVG(CASE WHEN {$measured} THEN page_weights.page_weight END), 0) AS page_weight" );
		$qd->with( 'page_weights' );
	}
}
