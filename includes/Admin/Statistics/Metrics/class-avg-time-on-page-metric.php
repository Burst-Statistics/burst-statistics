<?php
/**
 * Avg time on page metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Avg_Time_On_Page_Metric - Handles SQL generation for the 'avg_time_on_page' metric.
 */
class Avg_Time_On_Page_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'avg_time_on_page';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$non_bounce = 'COALESCE(sessions.bounce, 0) = 0';
		$expr       = $qd->get_exclude_bounces()
			? "COALESCE( AVG( CASE WHEN {$non_bounce} THEN statistics.time_on_page END ), 0 ) AS avg_time_on_page"
			: 'AVG( statistics.time_on_page ) AS avg_time_on_page';
		$qd->add_select( $expr );
		$qd->with( 'sessions' );
	}
}
