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

	/**
	 * Metric/filter keys that resolve to a burst_campaigns column. 'utm_source'
	 * and 'source' share the same column: the campaigns table stores the UTM
	 * value in 'source', while the 'source' key elsewhere means the
	 * referrer-derived session source.
	 */
	private const CAMPAIGN_PARAMS = [
		'source'     => 'source',
		'utm_source' => 'source',
		'medium'     => 'medium',
		'campaign'   => 'campaign',
		'term'       => 'term',
		'content'    => 'content',
	];

	/**
	 * Populates the Statistics_Query accumulator with a campaign attribution subquery as FROM clause.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$select  = $qd->get_select();
		$filters = $qd->get_filters();

		$param_keys     = array_keys( self::CAMPAIGN_PARAMS );
		$keys_in_select = array_intersect( $param_keys, $select );
		$keys_in_filter = array_intersect( $param_keys, array_keys( $filters ) );
		$all_params     = array_values( array_unique( array_merge( $keys_in_select, $keys_in_filter ) ) );

		$param_cols = array_map(
			static function ( string $column ): string {
				return 'ca.' . preg_replace( '/[^a-zA-Z0-9_]/', '', $column );
			},
			array_values( array_unique( array_map( static fn( string $p ): string => self::CAMPAIGN_PARAMS[ $p ], $all_params ) ) )
		);

		$inner = \Burst\Admin\Database\Query::create()
			->select_raw( 's.uid_id, ' . implode( ', ', $param_cols ) . ', MIN(s.time) AS first_visit_time' )
			->from( 'burst_campaigns', 'ca' )
			->inner_join( 'burst_statistics', 's.ID = ca.statistic_id', 's' )
			->where_between( 's.time', $qd->get_date_start(), $qd->get_date_end(), '%d' )
			->group_by( 's.uid_id, ' . implode( ', ', $param_cols ) );

		$qd->set_from_subquery( $inner, 'campaigns' );
		$qd->join(
			'statistics',
			'burst_statistics',
			'statistics.uid_id = campaigns.uid_id AND statistics.time >= campaigns.first_visit_time',
			'LEFT'
		);

		// GROUP BY aliases: campaign param keys → campaigns.column.
		$aliases = [];
		foreach ( $all_params as $p ) {
			$aliases[ $p ] = 'campaigns.' . self::CAMPAIGN_PARAMS[ $p ];
		}
		$qd->set_group_by_aliases( $aliases );
	}
}
