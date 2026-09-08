<?php
/**
 * Bootstraps metric handlers and FROM strategies for the free tier.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

use Burst\Admin\Statistics\Filter_Registry;
use Burst\Admin\Statistics\Metrics\Metric_Registry;
use Burst\Admin\Statistics\Query_Shapes\From_Strategy_Registry;
use Burst\Admin\Statistics\Query_Shapes\Parameter_Conversion_Shape;
use Burst\Admin\Statistics\Query_Shapes\Referrer_Shape;
use Burst\Admin\Statistics\Query_Shapes\Campaign_Conversion_Shape;
use Burst\Admin\Statistics\Query_Shapes\Session_Grain_Shape;

defined( 'ABSPATH' ) || die();

/**
 * Class Metric_Bootstrap - Registers all free-tier metric handlers and FROM strategies on plugin init.
 */
class Metric_Bootstrap {

	/**
	 * Initialize all registries. Idempotent — safe to call multiple times.
	 */
	public static function init(): void {
		if ( ! empty( Metric_Registry::all() ) ) {
			return;
		}
		self::register_metrics();
		self::register_strategies();
		self::register_joins();
		self::register_filters();
	}

	/**
	 * Register all built-in metric handlers.
	 */
	private static function register_metrics(): void {
		$handlers = [
			new Metrics\Pageviews_Metric(),
			new Metrics\Count_Metric(),
			new Metrics\Bounces_Metric(),
			new Metrics\Bounce_Rate_Metric(),
			new Metrics\Sessions_Metric(),
			new Metrics\Avg_Time_On_Page_Metric(),
			new Metrics\Avg_Session_Duration_Metric(),
			new Metrics\First_Time_Visitors_Metric(),
			new Metrics\Visitors_Metric(),
			new Metrics\Page_Url_Metric(),
			new Metrics\Host_Metric(),
			new Metrics\Conversions_Metric(),
			new Metrics\Conversion_Rate_Metric(),
			new Metrics\Referrer_Metric(),
			new Metrics\Device_Id_Metric(),
			new Metrics\Browser_Id_Metric(),
			new Metrics\Platform_Id_Metric(),
			new Metrics\Browser_Version_Id_Metric(),
			new Metrics\First_Time_Visit_Metric(),
			new Metrics\Device_Resolution_Id_Metric(),
			new Metrics\Session_Id_Metric(),
			new Metrics\Time_Metric(),
			new Metrics\Time_On_Page_Metric(),
		];
		foreach ( $handlers as $handler ) {
			Metric_Registry::register( $handler );
		}
	}

	/**
	 * Register free-tier named joins.
	 */
	private static function register_joins(): void {
		Join_Registry::register(
			'sessions',
			[
				'table'      => 'burst_sessions',
				'on'         => 'statistics.session_id = sessions.ID',
				'type'       => 'INNER',
				'depends_on' => [],
			]
		);
		// Goal completions are sparse relative to statistics, but a plain
		// row-level join probes the goal table for every hit in range.
		// Pre-filtering into a derived table (goal_statistics has no time
		// column, so the date filter goes through the hit it belongs to) keeps
		// that lookup structure small. Alias and column names are unchanged, so
		// the goal_id baking in Statistics_Query::get_available_joins() and all
		// metric expressions keep working as-is.
		Join_Registry::register_dynamic(
			'goals',
			function ( Statistics_Query $qd ): array {
				global $wpdb;
				$date_start = $qd->get_date_start();
				$date_end   = $qd->get_date_end();

				if ( $date_start <= 0 || $date_end <= 0 ) {
					return [
						'table'      => 'burst_goal_statistics',
						'on'         => 'statistics.ID = goals.statistic_id',
						'type'       => 'LEFT',
						'depends_on' => [],
					];
				}

				return [
					'table'      => "(SELECT g.*
			FROM {$wpdb->prefix}burst_goal_statistics g
			JOIN {$wpdb->prefix}burst_statistics s_g ON g.statistic_id = s_g.ID
			WHERE s_g.time BETWEEN {$date_start} AND {$date_end})",
					'on'         => 'statistics.ID = goals.statistic_id',
					'type'       => 'LEFT',
					'depends_on' => [],
				];
			}
		);
	}

	/**
	 * Register free-tier filter key → qualified SQL column mappings.
	 */
	private static function register_filters(): void {
		$free_filters = [
			'bounces'          => 'sessions.bounce',
			'host'             => 'sessions.host',
			'new_visitor'      => 'new_visitor',
			'page_url'         => 'statistics.page_url',
			'referrer'         => 'sessions.referrer',
			'browser'          => 'sessions.browser_id',
			'first_time_visit' => 'sessions.first_time_visit',
			'platform'         => 'sessions.platform_id',
			'platform_id'      => 'sessions.platform_id',
			'browser_id'       => 'sessions.browser_id',
			'device'           => 'sessions.device_id',
			'device_id'        => 'sessions.device_id',
			'entry_exit_pages' => 'entry_exit_pages',
			'parameter'        => 'parameter',
			'parameters'       => 'statistics.parameters',
			'goal_id'          => 'goals.goal_id',
			// Virtual filter: resolved against page_type in add_filter_condition(), there is no status column.
			'status'           => 'statistics.page_type',
		];
		foreach ( $free_filters as $key => $column ) {
			Filter_Registry::register( $key, $column );
		}
	}

	/**
	 * Register all built-in FROM strategies by query ID.
	 */
	private static function register_strategies(): void {
		From_Strategy_Registry::register( [ 'datatable_statistics_referrers', 'datatable_sources_referrers' ], new Referrer_Shape() );
		// Session-grain routing: these queries group on session/location dimensions
		// and (in their default column sets) select only session-grain metrics, so
		// they can skip the statistics scan entirely. The shape verifies per query
		// that every metric, filter and group_by is session-grain and falls back
		// otherwise — the map requests send a single visitors/sessions metric, and
		// callers hitting the pageviews defaults fall back automatically.
		// statistics_conversions is deliberately NOT registered: conversions is a
		// sparse metric — the goals join drives from the tiny goal_statistics
		// table, so the raw path is a cheap goal-driven join while session grain
		// would scan every session in range (measured 3.6x slower on the
		// performance dataset). Session grain only pays off for metrics that
		// need the full session set anyway (visitors, sessions, bounce).
		From_Strategy_Registry::register(
			[
				'datatable_sources_countries',
				'statistics_bounces',
				'statistics_get_session_data',
				'statistics_map_data_world',
				'statistics_map_data_country',
			],
			new Session_Grain_Shape()
		);
		From_Strategy_Registry::register( [ 'datatable_statistics_parameters' ], new Parameter_Conversion_Shape() );
		From_Strategy_Registry::register( [ 'datatable_sources_campaigns' ], new Campaign_Conversion_Shape() );
	}
}
