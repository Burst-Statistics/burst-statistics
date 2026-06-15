<?php
/**
 * Session ID metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Session_Id_Metric - Handles SQL generation for the 'session_id' metric.
 */
class Session_Id_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'session_id';
	}

	/**
	 * Accumulates SELECT expression onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'statistics.session_id AS session_id' );
	}
}
