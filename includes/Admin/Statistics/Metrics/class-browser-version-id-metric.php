<?php
/**
 * Browser version ID metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Browser_Version_Id_Metric - Handles SQL generation for the 'browser_version_id' metric.
 */
class Browser_Version_Id_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'browser_version_id';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'sessions.browser_version_id AS browser_version_id' );
		$qd->with( 'sessions' );
	}
}
