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
		Join_Registry::register(
			'goals',
			[
				'table'      => 'burst_goal_statistics',
				'on'         => 'statistics.ID = goals.statistic_id',
				'type'       => 'LEFT',
				'depends_on' => [],
			]
		);
	}

	/**
	 * Register free-tier filter key → qualified SQL column mappings.
	 */
	private static function register_filters(): void {
		$free_filters = [
			'bounces'          => 'sessions.bounce',
			'host'             => 'sessions.host',
			'new_visitor'      => 'sessions.first_time_visit',
			'page_url'         => 'statistics.page_url',
			'referrer'         => 'sessions.referrer',
			'browser'          => 'sessions.browser_id',
			'platform'         => 'sessions.platform_id',
			'platform_id'      => 'sessions.platform_id',
			'browser_id'       => 'sessions.browser_id',
			'device'           => 'sessions.device_id',
			'device_id'        => 'sessions.device_id',
			'entry_exit_pages' => 'entry_exit_pages',
			'parameter'        => 'parameter',
			'parameters'       => 'statistics.parameters',
			'goal_id'          => 'goals.goal_id',
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
		From_Strategy_Registry::register( [ 'datatable_statistics_parameters' ], new Parameter_Conversion_Shape() );
		From_Strategy_Registry::register( [ 'datatable_sources_campaigns' ], new Campaign_Conversion_Shape() );
	}
}
