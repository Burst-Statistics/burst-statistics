<?php
/**
 * Avg session duration metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Avg_Session_Duration_Metric - Handles SQL generation for the 'avg_session_duration' metric.
 */
class Avg_Session_Duration_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'avg_session_duration';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		// Sum per-pageview durations and divide by distinct sessions so a 5-pageview
		// session contributes its full duration, not a single pageview's average.
		$qd->add_select( 'COALESCE(SUM(statistics.time_on_page) / NULLIF(COUNT(DISTINCT statistics.session_id), 0), 0) AS avg_session_duration' );
	}
}
