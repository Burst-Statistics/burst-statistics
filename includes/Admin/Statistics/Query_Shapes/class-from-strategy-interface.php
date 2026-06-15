<?php
/**
 * From strategy interface for special-case FROM-clause routing.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Interface From_Strategy_Interface - Contract for FROM clause strategy implementations.
 */
interface From_Strategy_Interface {
	/**
	 * Mutates the Statistics_Query accumulator with FROM/JOIN/group_by state for this shape.
	 *
	 * @param Statistics_Query $qd The query data accumulator to populate.
	 */
	public function apply( Statistics_Query $qd ): void;
}
