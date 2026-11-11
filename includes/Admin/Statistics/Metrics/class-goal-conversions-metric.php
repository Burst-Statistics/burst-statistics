<?php
/**
 * Goal conversions metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Goal_Statistics;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Frontend\Goals\Goals;

defined( 'ABSPATH' ) || die();

/**
 * Class Goal_Conversions_Metric - Handles SQL generation for the 'goal_conversions' metric.
 *
 * Counts conversions as the goals dashboard reports them: by each goal's conversion
 * metric and page. The 'conversions' metric counts every completion instead.
 */
class Goal_Conversions_Metric implements Metric_Handler_Interface {
	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'goal_conversions';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$goals = ( new Goals() )->get_goals();
		$qd->add_select( ( new Goal_Statistics() )->get_goal_conversions_sql( $goals ) . ' AS goal_conversions' );
		$qd->with( 'goals' );
	}
}
