<?php
/**
 * Referrer query shape.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

use Burst\Admin\Database\Query;
use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Class Referrer_Shape - FROM strategy for referrer queries; pre-filters statistics to rows with a referrer.
 */
class Referrer_Shape implements From_Strategy_Interface {

	/**
	 * Populates the Statistics_Query accumulator with a pre-filtered referrer subquery as FROM clause.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$inner = Query::create()
			->select_raw( 'statistics.ID, statistics.time, statistics.page_url, statistics.page_id, statistics.page_type, statistics.uid, statistics.time_on_page, statistics.session_id' )
			->from( 'burst_statistics', 'statistics' )
			->inner_join( 'burst_sessions', 'statistics.session_id = sessions.ID', 'sessions' )
			->where_between( 'statistics.time', $qd->get_date_start(), $qd->get_date_end(), '%d' )
			->where( 'sessions.referrer', '', '!=' )
			->where_not_null( 'sessions.referrer' );
		$qd->set_from_subquery( $inner, 'statistics' );
	}
}
