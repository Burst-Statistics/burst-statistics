<?php
/**
 * Parameter conversion query shape.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

use Burst\Admin\Database\Query;
use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Parameter_Conversion_Shape - FROM strategy for parameter+conversion queries.
 */
class Parameter_Conversion_Shape implements From_Strategy_Interface {

	/**
	 * Populates the Statistics_Query accumulator with a pre-aggregated parameter subquery as FROM clause.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$inner = Query::create()
			->select_raw( 'p.parameter, p.value, s.uid, MIN(s.time) AS first_visit_time' )
			->from( 'burst_parameters', 'p' )
			->inner_join( 'burst_statistics', 's.ID = p.statistic_id', 's' )
			->where_between( 's.time', $qd->get_date_start(), $qd->get_date_end(), '%d' )
			->where_not_null( 's.parameters' )
			->where( 's.parameters', '', '!=' )
			->group_by( 'p.parameter, p.value, s.uid' );

		$qd->set_from_subquery( $inner, 'params' );
		$qd->join(
			'statistics',
			'burst_statistics',
			'statistics.uid = params.uid AND statistics.time >= params.first_visit_time',
			'LEFT'
		);
		$qd->set_group_by_aliases( [ 'parameter' => 'params.parameter, params.value' ] );
	}
}
