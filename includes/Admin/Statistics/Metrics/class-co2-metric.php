<?php
/**
 * CO2 metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Co2_Config;
use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Handles SQL generation for the 'co2' metric.
 */
class Co2_Metric implements Metric_Handler_Interface {

	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'co2';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$grams_per_gb      = Co2_Config::get_grams_per_gb();
		$non_bounce        = 'COALESCE(sessions.bounce, 0) = 0';
		$group_by_page_url = array_intersect( [ 'page_url', 'statistics.page_url' ], $qd->get_group_by() );

		// The stored weight is what a pageview actually transferred, averaged
		// over new and returning visitors alike, so every pageview is charged it
		// as it is.
		if ( ! empty( $group_by_page_url ) ) {
			$eligible_visits = $qd->get_exclude_bounces()
				? "COUNT(DISTINCT CASE WHEN {$non_bounce} THEN statistics.ID END)"
				: 'COUNT(DISTINCT statistics.ID)';
			// No eligible hits is a genuine 0; an unmeasured page (no page_weights row) stays NULL.
			$transferred_bytes = "CASE WHEN {$eligible_visits} = 0 THEN 0 ELSE MAX(page_weights.page_weight) * {$eligible_visits} END";
		} elseif ( $qd->get_exclude_bounces() ) {
			$transferred_bytes = "SUM(CASE WHEN {$non_bounce} THEN page_weights.page_weight ELSE 0 END)";
		} else {
			$transferred_bytes = 'SUM(page_weights.page_weight)';
		}

		$qd->add_select( 'ROUND(' . $transferred_bytes . ' / ' . Co2_Config::BYTES_PER_GB . ' * ' . $grams_per_gb . ', 6) AS co2' );
		$qd->with( 'page_weights' );
		if ( $qd->get_exclude_bounces() ) {
			$qd->with( 'sessions' );
		}
	}
}
