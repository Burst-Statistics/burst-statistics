<?php
/**
 * Device resolution ID metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Device_Resolution_Id_Metric - Handles SQL generation for the 'device_resolution_id' metric.
 */
class Device_Resolution_Id_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'device_resolution_id';
	}

	/**
	 * Accumulates SELECT expression onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$qd->add_select( 'statistics.device_resolution_id AS device_resolution_id' );
	}
}
