<?php
/**
 * Metric handler interface for analytics query metrics.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Interface Metric_Handler_Interface - Contract for all metric handler implementations.
 */
interface Metric_Handler_Interface {
	/**
	 * Returns the metric key string.
	 */
	public function key(): string;

	/**
	 * Accumulates SELECT expressions and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator to populate.
	 */
	public function apply( Statistics_Query $qd ): void;
}
