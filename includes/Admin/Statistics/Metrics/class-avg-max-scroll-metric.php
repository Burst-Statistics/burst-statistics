<?php
/**
 * Avg max scroll metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Avg_Max_Scroll_Metric - Handles SQL generation for the 'avg_max_scroll' metric.
 *
 * The max_scroll column is written by the shared tracker, so the metric is available in
 * free and Pro alike (reading engagement, page revisions).
 */
class Avg_Max_Scroll_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'avg_max_scroll';
	}

	/**
	 * Accumulates the SELECT expression onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'AVG( statistics.max_scroll ) AS avg_max_scroll' );
	}
}
