<?php
/**
 * Session-grain query shape.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

use Burst\Admin\Database\Query;
use Burst\Admin\Statistics\Filter_Registry;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Session_Grain_Shape - FROM strategy that answers session-grain queries
 * from the sessions table alone, instead of scanning every hit in range.
 *
 * A query is session-grain when every selected metric and every active filter
 * can be computed from burst_sessions and its lookup joins (locations). For
 * those queries the statistics table adds nothing except the date filter, which
 * sessions.start_time now answers directly — at a fraction of the row count.
 *
 * The strategy swaps the FROM clause for a subquery on burst_sessions that
 * exposes the columns the existing metric handlers reference, under the same
 * 'statistics' alias the rest of the builder expects:
 *
 *   - ID AS session_id      → COUNT(DISTINCT statistics.session_id) counts sessions
 *   - start_time AS time   → the builder's statistics.time date filter keeps working
 *   - uid_id                → COUNT(DISTINCT statistics.uid_id) counts visitors (dictionary ids)
 *   - 'session' AS page_type → the builder's 404-exclusion becomes a no-op
 *
 * statistics.ID is deliberately NOT exposed: anything that would join on the
 * hit id (goals, orders, campaigns) is statistic-grain and must fail loudly
 * rather than silently miscount — eligibility below prevents those queries from
 * taking this shape in the first place.
 *
 * The 'sessions' join the metric handlers request becomes a self-join on the
 * primary key (eq_ref), so expressions on sessions.bounce, sessions.ID and
 * sessions.first_time_visit work unchanged.
 *
 * Semantics: the date filter shifts from "session with a hit in range" to
 * "session started in range" — the convention GA and Matomo use. Only sessions
 * straddling a range boundary are affected.
 */
class Session_Grain_Shape implements From_Strategy_Interface {
	use Database_Helper;

	/**
	 * Metrics computable at session grain. Dimension keys (country/state/city/
	 * continent) resolve to locations.* via their metric handlers. Public so
	 * callers can partition a mixed metric list into session-grain and
	 * hit-grain subsets (see Statistics_Data::get_data()).
	 *
	 * @var string[]
	 */
	public const SESSION_GRAIN_METRICS = [
		'visitors',
		'sessions',
		'bounce_rate',
		'bounces',
		'first_time_visitors',
		'conversions',
		'conversion_rate',
		'country_code',
		'state_code',
		'state',
		'city',
		'continent',
	];

	/**
	 * Filter aliases whose columns live at session grain.
	 *
	 * @var string[]
	 */
	private const SESSION_GRAIN_FILTER_ALIASES = [ 'sessions', 'locations' ];

	/**
	 * Whether the sessions table carries the denormalized start_time/uid_id
	 * columns, cached per blog id: the multisite install loop switches blogs
	 * within one request and each blog migrates independently.
	 *
	 * @var array<int, bool>
	 */
	private static array $columns_available = [];

	/**
	 * Swap the FROM clause to the sessions table for eligible queries; no-op
	 * (keeping the statistics-based FROM) for everything else.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		// Callers building custom session-grain selects (the sources blocks)
		// request the FROM swap explicitly and own the eligibility decision —
		// the automatic check below cannot judge a custom select.
		if ( $qd->is_session_grain_from_requested() ) {
			$qd->set_from_subquery( self::sessions_from_subquery( $qd->get_date_start(), $qd->get_date_end() ), 'statistics' );
			self::maybe_add_goals_by_session( $qd );
			return;
		}

		if ( ! self::query_is_session_grain( $qd ) ) {
			return;
		}

		$qd->set_from_subquery( self::sessions_from_subquery( $qd->get_date_start(), $qd->get_date_end() ), 'statistics' );
		self::maybe_add_goals_by_session( $qd );
	}

	/**
	 * Pre-register the session-keyed goals join when the query needs goal data
	 * (conversions/conversion_rate metrics or a goal_id filter). Must run before
	 * the metric handlers: with('goals') is first-write-wins, so this join wins
	 * over the registered hit-keyed one — which would break against the
	 * session-grain FROM (statistics.ID is not exposed).
	 *
	 * The registered goals join gets the goal_id filter baked into its ON by
	 * get_available_joins(); the derived table here applies the same condition
	 * via the shared Statistics_Query::goal_condition_sql(), so both paths
	 * always count the same completions.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public static function maybe_add_goals_by_session( Statistics_Query $qd ): void {
		global $wpdb;

		$filters   = $qd->get_filters();
		$has_goals = ! empty( array_intersect( $qd->get_select(), [ 'conversions', 'conversion_rate' ] ) )
			|| isset( $filters['goal_id'] );
		if ( ! $has_goals ) {
			return;
		}

		$goal_id_filter = $filters['goal_id'] ?? 0;
		$is_exclude     = ( $qd->get_filter_exclusions()['goal_id'] ?? 'include' ) === 'exclude';
		$goal_condition = Statistics_Query::goal_condition_sql( $goal_id_filter, $is_exclude, 'g.goal_id' );

		$qd->join(
			'goals',
			"(SELECT st.session_id, g.ID, g.goal_id
			FROM {$wpdb->prefix}burst_goal_statistics g
			JOIN {$wpdb->prefix}burst_statistics st ON g.statistic_id = st.ID
			WHERE st.time BETWEEN {$qd->get_date_start()} AND {$qd->get_date_end()}{$goal_condition})",
			'statistics.session_id = goals.session_id',
			'LEFT'
		);
	}

	/**
	 * The sessions-based FROM subquery, exposing the columns the metric
	 * handlers reference under the 'statistics' alias. Public so callers that
	 * build custom session-grain queries (e.g. the sources blocks) reuse the
	 * exact same shape instead of duplicating it.
	 *
	 * @param int $date_start Range start (unix timestamp).
	 * @param int $date_end   Range end (unix timestamp).
	 */
	public static function sessions_from_subquery( int $date_start, int $date_end ): Query {
		return Query::create()
			->select_raw( "session_starts.ID AS session_id, session_starts.start_time AS time, session_starts.uid_id, 'session' AS page_type" )
			->from( 'burst_sessions', 'session_starts' )
			->where_between( 'session_starts.start_time', $date_start, $date_end, '%d' );
	}

	/**
	 * Whether session-grain querying is available at all: the denormalized
	 * session columns exist and their backfill has completed. Public for
	 * callers that build custom session-grain queries.
	 */
	public static function session_grain_ready(): bool {
		return self::session_columns_ready();
	}

	/**
	 * Whether every selected metric and active filter can be answered at
	 * session grain, and the denormalized session columns are ready. Public
	 * so callers can pre-check before deciding to split a mixed metric list
	 * into a session-grain query and a hit-grain query.
	 *
	 * @param Statistics_Query $qd            The query data accumulator.
	 * @param string[]         $extra_metrics Additional metric/dimension keys a
	 *                                        routing caller can serve at session
	 *                                        grain (e.g. the referrer columns).
	 */
	public static function query_is_session_grain( Statistics_Query $qd, array $extra_metrics = [] ): bool {
		// Custom selects bypass the metric registry, so their grain is unknown.
		if ( $qd->get_custom_select() !== '' ) {
			return false;
		}

		// The shape replaces the date filter, so an unbounded query stays on raw.
		if ( $qd->get_date_start() <= 0 || $qd->get_date_end() <= 0 ) {
			return false;
		}

		$allowed_metrics = array_merge( self::SESSION_GRAIN_METRICS, $extra_metrics );

		foreach ( $qd->get_select() as $metric ) {
			if ( ! in_array( $metric, $allowed_metrics, true ) ) {
				return false;
			}
		}

		// group_by is client-suppliable on the datatable endpoints and may name
		// statistics columns the subquery does not expose (e.g. page_url).
		foreach ( $qd->get_group_by() as $group_by ) {
			foreach ( explode( ',', $group_by ) as $group_by_column ) {
				if ( ! in_array( trim( $group_by_column ), $allowed_metrics, true ) ) {
					return false;
				}
			}
		}

		$filter_map = Filter_Registry::all();
		foreach ( $qd->get_filters() as $filter_key => $_value ) {
			// With a fully materialized sessions.source_category the filter is
			// served from the sessions column alone (see the materialized branch
			// in Statistics_Query::add_filter_condition()); the classifier
			// fallback instead pulls the campaigns join, which keys on the hit
			// id this shape does not expose.
			if ( 'source_category' === $filter_key ) {
				if ( Statistics_Query::source_category_is_materialized() ) {
					continue;
				}
				return false;
			}
			// goal_id is served by the session-keyed goals join (see
			// maybe_add_goals_by_session()).
			if ( 'goal_id' === $filter_key ) {
				continue;
			}
			$column = $filter_map[ $filter_key ] ?? '';
			$alias  = strpos( $column, '.' ) !== false ? strstr( $column, '.', true ) : '';
			if ( ! in_array( $alias, self::SESSION_GRAIN_FILTER_ALIASES, true ) ) {
				return false;
			}
		}

		return self::session_columns_ready();
	}

	/**
	 * Whether start_time/uid_id exist on burst_sessions and the historic backfill
	 * has completed. Until then, session-grain results would undercount, so
	 * every query stays on the statistics-based path.
	 */
	private static function session_columns_ready(): bool {
		// Central migration-state check plus one structural probe: a deploy
		// without a version bump never re-runs the table init, so the columns
		// can be missing even when no upgrade tasks are pending.
		if ( ! ( new self() )->db_upgrades_complete() ) {
			return false;
		}

		$blog_id = get_current_blog_id();
		if ( ! isset( self::$columns_available[ $blog_id ] ) ) {
			global $wpdb;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$columns                             = $wpdb->get_col( "DESC {$wpdb->prefix}burst_sessions" );
			self::$columns_available[ $blog_id ] = in_array( 'start_time', $columns, true ) && in_array( 'uid_id', $columns, true );
		}

		return self::$columns_available[ $blog_id ];
	}
}
