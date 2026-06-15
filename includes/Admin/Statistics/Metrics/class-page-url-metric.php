<?php
/**
 * Page URL metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Page_Url_Metric - Handles SQL generation for the 'page_url' metric.
 */
class Page_Url_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'page_url';
	}

	/**
	 * Accumulates SELECT expression onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'statistics.page_url AS page_url' );
	}
}
