<?php
/**
 * Campaign conversion query shape.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Campaign_Conversion_Shape - FROM strategy for campaign+conversion queries.
 */
class Campaign_Conversion_Shape implements From_Strategy_Interface {

	private const CAMPAIGN_PARAMS = [ 'source', 'medium', 'campaign', 'term', 'content' ];

	/**
	 * Populates the Statistics_Query accumulator with a campaign attribution subquery as FROM clause.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$select  = $qd->get_select();
		$filters = $qd->get_filters();

		$params_in_select = array_intersect( self::CAMPAIGN_PARAMS, $select );
		$params_in_filter = array_intersect( self::CAMPAIGN_PARAMS, array_keys( $filters ) );
		$all_params       = array_values( array_unique( array_merge( $params_in_select, $params_in_filter ) ) );

		$param_cols = array_map(
			static function ( string $p ): string {
				return 'ca.' . preg_replace( '/[^a-zA-Z0-9_]/', '', $p );
			},
			$all_params
		);

		$inner = \Burst\Admin\Database\Query::create()
			->select_raw( 's.uid, ' . implode( ', ', $param_cols ) . ', MIN(s.time) AS first_visit_time' )
			->from( 'burst_campaigns', 'ca' )
			->inner_join( 'burst_statistics', 's.ID = ca.statistic_id', 's' )
			->where_between( 's.time', $qd->get_date_start(), $qd->get_date_end(), '%d' )
			->group_by( 's.uid, ' . implode( ', ', $param_cols ) );

		$qd->set_from_subquery( $inner, 'campaigns' );
		$qd->join(
			'statistics',
			'burst_statistics',
			'statistics.uid = campaigns.uid AND statistics.time >= campaigns.first_visit_time',
			'LEFT'
		);

		// GROUP BY aliases: campaign params → campaigns.param.
		$aliases = [];
		foreach ( $all_params as $p ) {
			$aliases[ $p ] = 'campaigns.' . preg_replace( '/[^a-zA-Z0-9_]/', '', $p );
		}
		$qd->set_group_by_aliases( $aliases );
	}
}
