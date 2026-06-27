<?php
namespace Burst\Admin\Abilities_Api;

use Burst\Admin\Admin;
use Burst\Frontend\Endpoint;
use Burst\Pro\Admin\Licensing\Licensing;
use Burst\Traits\Admin_Helper;

use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Abilities_Api {
	use Admin_Helper;

	private const ENABLE_OPTION     = 'enable_abilities_api';
	private const CATEGORY_SLUG     = 'burst-statistics';
	private const CHAT_ABILITY_LIST = [
		'burst/live-visitors',
		'burst/live-traffic',
		'burst/today-summary',
		'burst/tasks',
		'burst/tracking-status',
		'burst/license-notices',
		'burst/data',
		'burst/subscriptions-data',
	];

	/**
	 * Abilities_Api constructor.
	 */
	public function __construct() {
		add_action( 'update_option_burst_options_settings', [ $this, 'on_update_options_settings' ], 10, 2 );
	}

	/**
	 * Check whether the Abilities API setting is enabled.
	 */
	public static function is_enabled(): bool {
		return (bool) burst_get_option( self::ENABLE_OPTION, false );
	}

	/**
	 * Show the chat enable notice only when the feature can actually be enabled.
	 */
	public static function should_show_enable_notice(): bool {
		return function_exists( 'wp_register_ability' ) && ! self::is_enabled();
	}

	/**
	 * Initialize Abilities API integration.
	 */
	public function init(): void {
		if ( self::is_enabled() ) {
			add_action( 'rest_api_init', [ $this, 'register_chat_rest_routes' ], 9 );
			add_filter( 'burst_do_action', [ $this, 'handle_ajax_chat_actions' ], 10, 3 );
			add_action( 'wp_abilities_api_categories_init', [ self::class, 'register_category' ] );
			add_action( 'wp_abilities_api_init', [ self::class, 'register' ] );
			add_action( 'abilities_api_init', [ self::class, 'register' ] );
		}
	}

	/**
	 * Register the ability category used by Burst abilities.
	 */
	public static function register_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		if ( function_exists( 'wp_has_ability_category' ) && wp_has_ability_category( self::CATEGORY_SLUG ) ) {
			return;
		}

		wp_register_ability_category(
			self::CATEGORY_SLUG,
			[
				'label'       => __( 'Burst Statistics', 'burst-statistics' ),
				'description' => __( 'Read-only analytics abilities provided by Burst.', 'burst-statistics' ),
			]
		);
	}

	/**
	 * Manually register category and abilities inside a mock WordPress action hook loop.
	 *
	 * This prevents PHP notices check triggers by satisfying doing_action() checks
	 * while shielding other plugins from duplicate registrations.
	 */
	public static function register_abilities_manually(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		global $wp_filter, $wp_current_filter;

		// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		// Back up current hook states.
		$backup_wp_filter = $wp_filter;
		$backup_current   = $wp_current_filter;

		try {
			// Clear/mock hook structures with only our registration callbacks.
			$wp_filter['wp_abilities_api_categories_init'] = new \WP_Hook();
			$wp_filter['wp_abilities_api_categories_init']->add_filter( 'wp_abilities_api_categories_init', [ self::class, 'register_category' ], 10, 0 );

			$wp_filter['wp_abilities_api_init'] = new \WP_Hook();
			$wp_filter['wp_abilities_api_init']->add_filter( 'wp_abilities_api_init', [ self::class, 'register' ], 10, 0 );

			$wp_filter['abilities_api_init'] = new \WP_Hook();
			$wp_filter['abilities_api_init']->add_filter( 'abilities_api_init', [ self::class, 'register' ], 10, 0 );

			// Execute hooks dynamically.
			do_action( 'wp_abilities_api_categories_init' );
			do_action( 'wp_abilities_api_init' );
			do_action( 'abilities_api_init' );
		} finally {
			// Restore original hook states.
			$wp_filter         = $backup_wp_filter;
			$wp_current_filter = $backup_current;
		}

		// phpcs:enable WordPress.WP.GlobalVariablesOverride.Prohibited
		// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	}

	/**
	 * Register all V1 read-only abilities.
	 */
	public static function register(): void {
		static $registered = false;
		if ( $registered || ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		if ( ! function_exists( 'wp_has_ability_category' ) || ! wp_has_ability_category( self::CATEGORY_SLUG ) ) {
			self::register_category();
		}

		$api = new self();

		wp_register_ability(
			'burst/live-visitors',
			[
				'label'               => __( 'Get live visitors', 'burst-statistics' ),
				'description'         => __( 'Returns the current number of live visitors.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => $api->empty_object_schema(),
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'visitors' ],
					'properties'           => [
						'visitors' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_live_visitors' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/live-traffic',
			[
				'label'               => __( 'Get live traffic', 'burst-statistics' ),
				'description'         => __( 'Returns active visitors and pages from the live traffic feed.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'limit' => [
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 100,
						],
					],
				],
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'items', 'total' ],
					'properties'           => [
						'items' => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'additionalProperties' => false,
								'required'             => [ 'active_time', 'page_url', 'uid', 'time', 'time_on_page', 'entry', 'checkout', 'exit' ],
								'properties'           => [
									'active_time'  => [ 'type' => 'number' ],
									'page_url'     => [ 'type' => 'string' ],
									'uid'          => [ 'type' => 'string' ],
									'time'         => [ 'type' => 'integer' ],
									'time_on_page' => [ 'type' => 'integer' ],
									'entry'        => [ 'type' => 'boolean' ],
									'checkout'     => [ 'type' => 'boolean' ],
									'exit'         => [ 'type' => 'boolean' ],
								],
							],
						],
						'total' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_live_traffic' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/today-summary',
			[
				'label'               => __( 'Get today summary', 'burst-statistics' ),
				'description'         => __( 'Returns a read-only summary of key Burst statistics for a date range.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'date_start' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
						'date_end'   => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
				],
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'live', 'today', 'most_viewed', 'top_referrer', 'pageviews', 'avg_time_on_page' ],
					'properties'           => [
						'live'             => [
							'type'    => 'integer',
							'minimum' => 0,
						],
						'today'            => [
							'type'    => 'integer',
							'minimum' => 0,
						],
						'most_viewed'      => [
							'type'                 => 'object',
							'additionalProperties' => false,
							'required'             => [ 'title', 'value' ],
							'properties'           => [
								'title' => [ 'type' => 'string' ],
								'value' => [
									'type'    => 'integer',
									'minimum' => 0,
								],
							],
						],
						'top_referrer'     => [
							'type'                 => 'object',
							'additionalProperties' => false,
							'required'             => [ 'title', 'value' ],
							'properties'           => [
								'title' => [ 'type' => 'string' ],
								'value' => [
									'type'    => 'integer',
									'minimum' => 0,
								],
							],
						],
						'pageviews'        => [
							'type'    => 'integer',
							'minimum' => 0,
						],
						'avg_time_on_page' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_today_summary' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/tasks',
			[
				'label'               => __( 'Get tasks', 'burst-statistics' ),
				'description'         => __( 'Returns the current Burst task list and status.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => $api->empty_object_schema(),
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'tasks' ],
					'properties'           => [
						'tasks' => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'additionalProperties' => false,
								'required'             => [ 'id', 'label', 'status', 'icon' ],
								'properties'           => [
									'id'     => [ 'type' => 'string' ],
									'label'  => [ 'type' => 'string' ],
									'status' => [ 'type' => 'string' ],
									'icon'   => [ 'type' => 'string' ],
									'url'    => [ 'type' => 'string' ],
								],
							],
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_tasks' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/tracking-status',
			[
				'label'               => __( 'Get tracking status', 'burst-statistics' ),
				'description'         => __( 'Returns Burst tracking transport status and last test time.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => $api->empty_object_schema(),
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'status', 'last_test' ],
					'properties'           => [
						'status'    => [ 'type' => 'string' ],
						'last_test' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_tracking_status' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/license-notices',
			[
				'label'               => __( 'Get license notices', 'burst-statistics' ),
				'description'         => __( 'Returns license state and notices for Burst Pro.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => $api->empty_object_schema(),
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => [ 'license_status', 'notices' ],
					'properties'           => [
						'license_status' => [ 'type' => 'string' ],
						'notices'        => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'additionalProperties' => false,
								'required'             => [ 'msg', 'icon', 'label', 'url', 'plusone', 'dismissible', 'highlight_field_id' ],
								'properties'           => [
									'msg'                => [ 'type' => 'string' ],
									'icon'               => [ 'type' => 'string' ],
									'label'              => [ 'type' => 'string' ],
									'url'                => [ 'type' => [ 'string', 'boolean' ] ],
									'plusone'            => [ 'type' => 'boolean' ],
									'dismissible'        => [ 'type' => 'boolean' ],
									'highlight_field_id' => [ 'type' => 'boolean' ],
								],
							],
						],
					],
				],
				'execute_callback'    => [ $api, 'ability_license_notices' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/data',
			[
				'label'               => __( 'Get data', 'burst-statistics' ),
				'description'         => __( 'Returns analytics data: pages overview with insights or a specific datatable.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'type'         => [
							'type' => 'string',
							'enum' => [ 'insights', 'datatable' ],
						],
						'datatable_id' => [
							'type'        => 'string',
							'enum'        => [ 'statistics_pages', 'statistics_parameters', 'statistics_referrers', 'sources_countries', 'sources_campaigns', 'sales_products', 'subscription_products', 'sources_referrers', 'outgoing-links', 'search-terms', 'forms' ],
							'description' => 'Datatable endpoint ID, for example statistics_pages. Required when type is datatable.',
						],
						'date_start'   => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for start date',
						],
						'date_end'     => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for end date',
						],
						'interval'     => [
							'type'        => 'string',
							'enum'        => [ 'auto', 'hour', 'day', 'week', 'month' ],
							'description' => 'Insights-only interval override. Use auto/hour/day/week/month.',
						],
						'metrics'      => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Metrics to retrieve (e.g., pageviews, visitors)',
						],
						'filters'      => [
							'type'        => 'array',
							'items'       => [ 'type' => 'object' ],
							'description' => 'Filter objects for data retrieval',
						],
						'group_by'     => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for datatable results',
						],
						'limit'        => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Limit number of results',
						],
					],
				],
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => true,
					'description'          => 'Analytics data response containing either insights timeseries or datatable records',
				],
				'execute_callback'    => [ $api, 'ability_data' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/sales-data',
			[
				'label'               => __( 'Get sales data', 'burst-statistics' ),
				'description'         => __( 'Returns ecommerce sales metrics (Burst Pro only).', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'date_start' => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for start date',
						],
						'date_end'   => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for end date',
						],
						'metrics'    => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Metrics to retrieve',
						],
						'filters'    => [
							'type'        => 'array',
							'items'       => [ 'type' => 'object' ],
							'description' => 'Additional filter objects for sales retrieval',
						],
						'group_by'   => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for sales results',
						],
						'limit'      => [
							'type'        => 'integer',
							'minimum'     => 1,
							'maximum'     => 500,
							'description' => 'Maximum number of rows to return',
						],
					],
				],
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => true,
					'description'          => 'Sales data response',
				],
				'execute_callback'    => [ $api, 'ability_sales_data' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		wp_register_ability(
			'burst/subscriptions-data',
			[
				'label'               => __( 'Get subscriptions data', 'burst-statistics' ),
				'description'         => __( 'Returns ecommerce subscriptions metrics (Burst Pro only).', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => [
						'date_start' => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for start date',
						],
						'date_end'   => [
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => 'Unix timestamp for end date',
						],
						'metrics'    => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Metrics to retrieve',
						],
						'filters'    => [
							'type'        => 'array',
							'items'       => [ 'type' => 'object' ],
							'description' => 'Additional filter objects for subscription retrieval',
						],
						'group_by'   => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for subscription results',
						],
						'limit'      => [
							'type'        => 'integer',
							'minimum'     => 1,
							'maximum'     => 500,
							'description' => 'Maximum number of rows to return',
						],
					],
				],
				'output_schema'       => [
					'type'                 => 'object',
					'additionalProperties' => true,
					'description'          => 'Subscriptions data response',
				],
				'execute_callback'    => [ $api, 'ability_subscriptions_data' ],
				'permission_callback' => [ $api, 'permission_callback' ],
				'meta'                => [
					'show_in_rest' => true,
					'annotations'  => [
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					],
				],
			]
		);

		$registered = true;
	}

	/**
	 * Permission callback for all Burst abilities.
	 *
	 * @param mixed $input Optional ability input.
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability permission_callback); the validated input shape varies per ability.
	 */
	public function permission_callback( mixed $input = null ): bool|\WP_Error {
		unset( $input );

		if ( $this->user_can_manage() ) {
			return true;
		}

		return new \WP_Error(
			'burst_abilities_forbidden',
			'You are not allowed to use this ability.',
			[ 'status' => 403 ]
		);
	}

	/**
	 * Execute: burst/live-visitors.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, int>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_live_visitors( mixed $input ): array|\WP_Error {
		unset( $input );
		$rate_limit = $this->enforce_rate_limit( 'live-visitors' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		try {
			$visitors = $admin->statistics->get_live_visitors_data();
			return [
				'visitors' => max( 0, $visitors ),
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch live visitors right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/live-traffic.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_live_traffic( mixed $input ): array|\WP_Error {
		$rate_limit = $this->enforce_rate_limit( 'live-traffic' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$limit = 100;
		if ( is_array( $input ) && isset( $input['limit'] ) ) {
			if ( ! is_numeric( $input['limit'] ) ) {
				return new \WP_Error(
					'burst_abilities_invalid_input',
					'The provided input is invalid.',
					[ 'status' => 400 ]
				);
			}

			$limit = (int) $input['limit'];
			$limit = max( 1, min( 100, $limit ) );
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		try {
			$rows  = $admin->statistics->get_live_traffic_data();
			$total = count( $rows );
			$items = [];
			foreach ( $rows as $row ) {
				$items[] = [
					'active_time'  => (float) ( $row->active_time ?? 0 ),
					'page_url'     => (string) ( $row->page_url ?? '' ),
					'uid'          => (string) ( $row->uid ?? '' ),
					'time'         => (int) ( $row->time ?? 0 ),
					'time_on_page' => (int) ( $row->time_on_page ?? 0 ),
					'entry'        => ! empty( $row->entry ),
					'checkout'     => ! empty( $row->checkout ),
					'exit'         => ! empty( $row->exit ),
				];
			}

			$items = array_slice( $items, 0, $limit );
			return [
				'items' => $items,
				'total' => $total,
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch live traffic right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/today-summary.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_today_summary( mixed $input ): array|\WP_Error {
		$rate_limit = $this->enforce_rate_limit( 'today-summary' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$args = [];
		if ( is_array( $input ) ) {
			if ( isset( $input['date_start'] ) ) {
				if ( ! is_numeric( $input['date_start'] ) ) {
					return new \WP_Error(
						'burst_abilities_invalid_input',
						'The provided input is invalid.',
						[ 'status' => 400 ]
					);
				}
				$args['date_start'] = absint( $input['date_start'] );
			}

			if ( isset( $input['date_end'] ) ) {
				if ( ! is_numeric( $input['date_end'] ) ) {
					return new \WP_Error(
						'burst_abilities_invalid_input',
						'The provided input is invalid.',
						[ 'status' => 400 ]
					);
				}
				$args['date_end'] = absint( $input['date_end'] );
			}
		} elseif ( $input !== null ) {
			return new \WP_Error(
				'burst_abilities_invalid_input',
				'The provided input is invalid.',
				[ 'status' => 400 ]
			);
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		try {
			$data = $admin->statistics->get_today_data( $args );
			return [
				'live'             => max( 0, (int) ( $data['live']['value'] ?? 0 ) ),
				'today'            => max( 0, (int) ( $data['today']['value'] ?? 0 ) ),
				'most_viewed'      => [
					'title' => (string) ( $data['mostViewed']['title'] ?? '' ),
					'value' => max( 0, (int) ( $data['mostViewed']['value'] ?? 0 ) ),
				],
				'top_referrer'     => [
					'title' => (string) ( $data['referrer']['title'] ?? '' ),
					'value' => max( 0, (int) ( $data['referrer']['value'] ?? 0 ) ),
				],
				'pageviews'        => max( 0, (int) ( $data['pageviews']['value'] ?? 0 ) ),
				'avg_time_on_page' => max( 0, (int) ( $data['timeOnPage']['value'] ?? 0 ) ),
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch the summary right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/tasks.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_tasks( mixed $input ): array|\WP_Error {
		unset( $input );
		$rate_limit = $this->enforce_rate_limit( 'tasks' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		try {
			$raw_tasks = $admin->tasks->get();
			$tasks     = [];
			foreach ( (array) ( $raw_tasks['tasks'] ?? [] ) as $task ) {
				if ( ! is_array( $task ) ) {
					continue;
				}

				$item = [
					'id'     => (string) ( $task['id'] ?? '' ),
					'label'  => (string) ( $task['label'] ?? '' ),
					'status' => (string) ( $task['status'] ?? '' ),
					'icon'   => (string) ( $task['icon'] ?? '' ),
				];
				if ( isset( $task['url'] ) ) {
					$item['url'] = (string) $task['url'];
				}
				$tasks[] = $item;
			}

			return [
				'tasks' => $tasks,
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch tasks right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/tracking-status.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_tracking_status( mixed $input ): array|\WP_Error {
		unset( $input );
		$rate_limit = $this->enforce_rate_limit( 'tracking-status' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		try {
			$tracking = Endpoint::get_tracking_status_and_time();
			return [
				'status'    => (string) ( $tracking['status'] ?? 'error' ),
				'last_test' => max( 0, (int) ( $tracking['last_test'] ?? 0 ) ),
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch tracking status right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/license-notices.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_license_notices( mixed $input ): array|\WP_Error {
		unset( $input );
		$rate_limit = $this->enforce_rate_limit( 'license-notices' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		if ( ! class_exists( Licensing::class ) ) {
			return [
				'license_status' => 'unavailable',
				'notices'        => [],
			];
		}

		try {
			$licensing = new Licensing();
			$data      = $licensing->license_notices();
			return [
				'license_status' => (string) ( $data['licenseStatus'] ?? 'unknown' ),
				'notices'        => is_array( $data['notices'] ?? null ) ? $data['notices'] : [],
			];
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch license notices right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/v1/data.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_data( mixed $input ): array|\WP_Error {
		$rate_limit = $this->enforce_rate_limit( 'data' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$input = is_array( $input ) ? $input : [];
		return $this->execute_data_request( $input );
	}

	/**
	 * Shared implementation for data-like abilities.
	 *
	 * @param array<string, mixed> $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 */
	private function execute_data_request( array $input ): array|\WP_Error {

		if ( ! isset( $input['type'] ) ) {
			return new \WP_Error(
				'burst_abilities_invalid_input',
				'The type parameter is required.',
				[ 'status' => 400 ]
			);
		}

		$type  = (string) $input['type'];
		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		$date_start   = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end     = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$datatable_id = isset( $input['datatable_id'] ) ? sanitize_title( (string) $input['datatable_id'] ) : '';

		$default_group_by_map = [
			'statistics_pages'      => [ 'page_url' ],
			'statistics_parameters' => [ 'parameter' ],
			'statistics_referrers'  => [ 'referrer' ],
			'sources_countries'     => [ 'country_code' ],
			'sources_campaigns'     => [ 'campaign' ],
			'sales_products'        => [ 'product' ],
			'subscription_products' => [ 'plan' ],
			'sources_referrers'     => [ 'referrer' ],
			'outgoing-links'        => [ 'url' ],
			'search-terms'          => [ 'term' ],
			'forms'                 => [ 'form_id' ],
		];

		$default_metrics_map = [
			'statistics_pages'      => [ 'pageviews', 'visitors', 'sessions', 'bounce_rate', 'avg_time_on_page' ],
			'statistics_parameters' => [ 'visitors', 'sessions', 'bounce_rate' ],
			'statistics_referrers'  => [ 'visitors', 'sessions', 'bounce_rate' ],
			'sources_countries'     => [ 'visitors', 'sessions', 'bounce_rate' ],
			'sources_campaigns'     => [ 'visitors', 'bounce_rate' ],
			'sales_products'        => [ 'sales', 'revenue' ],
			'subscription_products' => [ 'active_subscribers', 'monthly_recurring_revenue' ],
			'sources_referrers'     => [ 'visitors', 'sessions', 'bounce_rate' ],
			'outgoing-links'        => [ 'clicks', 'previous_clicks' ],
			'search-terms'          => [ 'volume', 'results' ],
			'forms'                 => [ 'submissions', 'pageviews', 'conversion_rate' ],
		];

		$default_group_by = [ 'page_url' ];
		if ( 'datatable' === $type && isset( $default_group_by_map[ $datatable_id ] ) ) {
			$default_group_by = $default_group_by_map[ $datatable_id ];
		}

		$default_metrics = [ 'pageviews' ];
		if ( 'datatable' === $type && isset( $default_metrics_map[ $datatable_id ] ) ) {
			$default_metrics = $default_metrics_map[ $datatable_id ];
		}

		$metrics  = isset( $input['metrics'] ) ? (array) $input['metrics'] : $default_metrics;
		$filters  = isset( $input['filters'] ) ? (array) $input['filters'] : [];
		$group_by = isset( $input['group_by'] ) ? (array) $input['group_by'] : $default_group_by;
		$group_by = $this->normalize_group_by( $group_by );
		$interval = $this->normalize_insights_interval( $input['interval'] ?? null );

		// Backward compatibility: if interval is omitted and callers used group_by
		// for insights, honor the first value as interval hint.
		if ( 'auto' === $interval && isset( $input['group_by'] ) ) {
			$insights_group_by = $input['group_by'];
			if ( is_array( $insights_group_by ) ) {
				$interval = $this->normalize_insights_interval( $insights_group_by[0] ?? null );
			} else {
				$interval = $this->normalize_insights_interval( $insights_group_by );
			}
		}
		$limit = isset( $input['limit'] ) ? absint( $input['limit'] ) : 0;

		try {
			if ( 'insights' === $type ) {
				$data = $admin->statistics->get_insights_data(
					[
						'date_start' => $date_start,
						'date_end'   => $date_end,
						'metrics'    => $metrics,
						'group_by'   => $interval,
					]
				);
				return $this->format_agent_insights_response( $data, $metrics );
			} elseif ( 'datatable' === $type ) {
				if ( empty( $datatable_id ) ) {
					return new \WP_Error(
						'burst_abilities_invalid_input',
						'The datatable_id parameter is required when type is datatable.',
						[ 'status' => 400 ]
					);
				}

				$metrics = $this->filter_datatable_metrics( $admin, $datatable_id, $metrics, $default_metrics );
				if ( is_wp_error( $metrics ) ) {
					return $metrics;
				}

				$data = $admin->statistics->get_datatables_data(
					[
						'date_start' => $date_start,
						'date_end'   => $date_end,
						'metrics'    => $metrics,
						'filters'    => $filters,
						'group_by'   => $group_by,
						'limit'      => $limit,
						'id'         => $datatable_id,
					]
				);

				return $this->format_agent_datatable_response( $data, $group_by, $metrics );
			}

			return new \WP_Error(
				'burst_abilities_invalid_input',
				'Invalid type parameter. Must be either insights or datatable.',
				[ 'status' => 400 ]
			);
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch data right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/sales-data.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_sales_data( mixed $input ): array|\WP_Error {
		if ( ! defined( 'BURST_PRO' ) ) {
			return new \WP_Error(
				'burst_abilities_pro_required',
				'Sales data retrieval is available in Burst Pro.',
				[ 'status' => 503 ]
			);
		}

		$rate_limit = $this->enforce_rate_limit( 'sales-data' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		$input = is_array( $input ) ? $input : [];

		$date_start      = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end        = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$datatable_id    = 'sales_products';
		$default_metrics = [
			'product',
			'sales',
			'revenue',
		];
		$metrics         = isset( $input['metrics'] ) ? (array) $input['metrics'] : $default_metrics;
		$metrics         = $this->filter_datatable_metrics( $admin, $datatable_id, $metrics, $default_metrics );
		if ( is_wp_error( $metrics ) ) {
			return $metrics;
		}
		$group_by  = isset( $input['group_by'] ) ? (array) $input['group_by'] : [ 'product' ];
		$group_by  = $this->normalize_group_by( $group_by );
		$limit     = isset( $input['limit'] ) ? absint( $input['limit'] ) : 100;
		$limit     = max( 1, min( 500, $limit ) );
		$filters   = $this->normalize_agent_filter_objects( $input['filters'] ?? [] );
		$filters[] = [
			'key'   => 'type',
			'value' => 'purchase',
		];

		try {
			$data = $admin->statistics->get_datatables_data(
				[
					'date_start' => $date_start,
					'date_end'   => $date_end,
					'metrics'    => $metrics,
					'filters'    => $filters,
					'group_by'   => $group_by,
					'limit'      => $limit,
					'id'         => $datatable_id,
				]
			);

			return $this->format_agent_datatable_response( $data, $group_by, $metrics );
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch sales data right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Execute: burst/subscriptions-data.
	 *
	 * @param mixed $input Ability input.
	 * @return array<string, mixed>|\WP_Error
	 *
	 * Mixed $input: signature is dictated by the WordPress Abilities API (wp_register_ability execute_callback); the validated input shape varies per ability.
	 */
	public function ability_subscriptions_data( mixed $input ): array|\WP_Error {
		if ( ! defined( 'BURST_PRO' ) ) {
			return new \WP_Error(
				'burst_abilities_pro_required',
				'Subscriptions data retrieval is available in Burst Pro.',
				[ 'status' => 503 ]
			);
		}

		$rate_limit = $this->enforce_rate_limit( 'subscriptions-data' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$admin = $this->get_admin_instance();
		if ( is_wp_error( $admin ) ) {
			return $admin;
		}

		$input = is_array( $input ) ? $input : [];

		$date_start      = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end        = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$datatable_id    = 'subscription_products';
		$default_metrics = [
			'plan',
			'active_subscribers',
			'canceled_subscribers',
			'trialling_subscribers',
			'monthly_recurring_revenue',
			'product_churn_value',
		];
		$metrics         = isset( $input['metrics'] ) ? (array) $input['metrics'] : $default_metrics;
		$metrics         = $this->filter_datatable_metrics( $admin, $datatable_id, $metrics, $default_metrics );
		if ( is_wp_error( $metrics ) ) {
			return $metrics;
		}
		$group_by  = isset( $input['group_by'] ) ? (array) $input['group_by'] : [ 'plan' ];
		$group_by  = $this->normalize_group_by( $group_by );
		$limit     = isset( $input['limit'] ) ? absint( $input['limit'] ) : 100;
		$limit     = max( 1, min( 500, $limit ) );
		$filters   = $this->normalize_agent_filter_objects( $input['filters'] ?? [] );
		$filters[] = [
			'key'   => 'type',
			'value' => 'subscription',
		];

		try {
			$data = $admin->statistics->get_datatables_data(
				[
					'date_start' => $date_start,
					'date_end'   => $date_end,
					'metrics'    => $metrics,
					'filters'    => $filters,
					'group_by'   => $group_by,
					'limit'      => $limit,
					'id'         => $datatable_id,
				]
			);

			return $this->format_agent_datatable_response( $data, $group_by, $metrics );
		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'burst_abilities_execution_failed',
				'Unable to fetch subscriptions data right now.',
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Reformat insights responses so agents receive explicit metric metadata and points.
	 *
	 * @param array<string, mixed> $data Raw insights response.
	 * @param array<int, string>   $metrics Requested metrics.
	 * @return array<string, mixed>
	 */
	private function format_agent_insights_response( array $data, array $metrics ): array {
		$datasets   = is_array( $data['datasets'] ?? null ) ? $data['datasets'] : [];
		$timestamps = is_array( $data['timestamps'] ?? null ) ? array_values( $data['timestamps'] ) : [];
		$series     = [];

		foreach ( $metrics as $index => $metric ) {
			$dataset = is_array( $datasets[ $index ] ?? null ) ? $datasets[ $index ] : [];
			$values  = is_array( $dataset['data'] ?? null ) ? array_values( $dataset['data'] ) : [];
			$points  = [];

			foreach ( $timestamps as $point_index => $timestamp ) {
				$points[] = [
					'timestamp' => (int) $timestamp,
					'value'     => isset( $values[ $point_index ] ) ? (float) $values[ $point_index ] : 0.0,
				];
			}

			$series[] = [
				'id'     => $metric,
				'label'  => (string) ( $dataset['label'] ?? ucwords( str_replace( '_', ' ', $metric ) ) ),
				'points' => $points,
			];
		}

		return [
			'type'                 => 'insights',
			'interval'             => (string) ( $data['interval'] ?? 'auto' ),
			'spans_multiple_years' => ! empty( $data['spans_multiple_years'] ),
			'series'               => $series,
			'point_count'          => count( $timestamps ),
		];
	}

	/**
	 * Normalize insights interval coming from API clients.
	 *
	 * Mixed $interval: unvalidated value from API/agent client input that may not be a string; the is_string guard defaults anything else to 'auto'.
	 */
	private function normalize_insights_interval( mixed $interval ): string {
		if ( ! is_string( $interval ) ) {
			return 'auto';
		}

		$interval = strtolower( trim( $interval ) );
		$allowed  = [ 'auto', 'hour', 'day', 'week', 'month' ];

		return in_array( $interval, $allowed, true ) ? $interval : 'auto';
	}

	/**
	 * Normalize generic filter objects passed by agent clients.
	 *
	 * @param mixed $filters Input filters; expected array of objects with key/value.
	 * @return array<int, array{key: string, value: mixed}>
	 *
	 * Mixed $filters: unvalidated value from agent client input that may not be an array; the is_array guard returns [] for anything else.
	 */
	private function normalize_agent_filter_objects( mixed $filters ): array {
		if ( ! is_array( $filters ) ) {
			return [];
		}

		$normalized = [];
		foreach ( $filters as $filter ) {
			if ( ! is_array( $filter ) ) {
				continue;
			}

			$key = isset( $filter['key'] ) ? (string) $filter['key'] : '';
			if ( '' === $key ) {
				continue;
			}

			$normalized[] = [
				'key'   => $key,
				'value' => $filter['value'] ?? '',
			];
		}

		return $normalized;
	}

	/**
	 * Normalize group_by keys coming from API clients.
	 *
	 * @param array<int, string> $group_by Grouping keys from input.
	 * @return array<int, string>
	 */
	private function normalize_group_by( array $group_by ): array {
		$map = [
			'utm_source' => 'source',
		];

		$normalized = [];
		foreach ( $group_by as $key ) {
			$key          = (string) $key;
			$normalized[] = $map[ $key ] ?? $key;
		}

		if ( empty( $normalized ) ) {
			return [ 'page_url' ];
		}

		return array_values( array_unique( $normalized ) );
	}

	/**
	 * Restrict requested metrics to the granular datatable endpoint allow-list.
	 *
	 * @param Admin              $admin Admin instance.
	 * @param string             $datatable_id Datatable endpoint ID.
	 * @param array<int, mixed>  $metrics Requested metric keys.
	 * @param array<int, string> $fallback_metrics Metrics to use when none of the requested metrics are valid.
	 * @return array<int, string>|\WP_Error
	 */
	private function filter_datatable_metrics( Admin $admin, string $datatable_id, array $metrics, array $fallback_metrics ): array|\WP_Error {
		$allow_list = $admin->app->get_datatable_metric_allow_list();
		if ( ! isset( $allow_list[ $datatable_id ] ) ) {
			return new \WP_Error(
				'burst_abilities_unknown_datatable',
				'Unknown datatable endpoint.',
				[ 'status' => 404 ]
			);
		}

		if ( ! $admin->app->user_can_access_datatable( $datatable_id ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have sufficient permissions to access this endpoint.', 'burst-statistics' ),
				[ 'status' => 403 ]
			);
		}

		$metrics = array_values(
			array_unique(
				array_map(
					// mixed $metric: array_map over an unvalidated request-supplied metric list whose items may be string or int; cast to string here.
					static function ( mixed $metric ): string {
						return (string) $metric;
					},
					$metrics
				)
			)
		);

		$filtered_metrics = array_values( array_intersect( $metrics, $allow_list[ $datatable_id ] ) );
		if ( empty( $filtered_metrics ) ) {
			$filtered_metrics = array_values( array_intersect( $fallback_metrics, $allow_list[ $datatable_id ] ) );
		}

		if ( empty( $filtered_metrics ) ) {
			return new \WP_Error(
				'burst_abilities_invalid_metrics',
				'No valid metrics were requested for this datatable endpoint.',
				[ 'status' => 400 ]
			);
		}

		return $filtered_metrics;
	}

	/**
	 * Reformat datatable responses so agents can distinguish dimensions from metrics.
	 *
	 * @param array<string, mixed> $data Raw datatable response.
	 * @param array<int, string>   $group_by Grouping columns.
	 * @param array<int, string>   $metrics Metric columns.
	 * @return array<string, mixed>
	 */
	private function format_agent_datatable_response( array $data, array $group_by, array $metrics ): array {
		$label_map   = [];
		$raw_columns = $data['columns'] ?? [];

		if ( is_array( $raw_columns ) ) {
			foreach ( $raw_columns as $column ) {
				if ( is_array( $column ) && isset( $column['id'], $column['name'] ) ) {
					$label_map[ (string) $column['id'] ] = (string) $column['name'];
				}
			}
		}

		$dimensions = array_map(
			static function ( string $key ) use ( $label_map ): array {
				return [
					'id'    => $key,
					'label' => $label_map[ $key ] ?? ucwords( str_replace( '_', ' ', $key ) ),
				];
			},
			$group_by
		);

		$metric_defs = array_map(
			static function ( string $key ) use ( $label_map ): array {
				return [
					'id'    => $key,
					'label' => $label_map[ $key ] ?? ucwords( str_replace( '_', ' ', $key ) ),
				];
			},
			$metrics
		);

		$raw_rows = is_array( $data['data'] ?? null ) ? $data['data'] : [];
		$rows     = $this->normalize_agent_datatable_rows( $raw_rows, $group_by, $metrics );

		return [
			'type'       => 'datatable',
			'dimensions' => $dimensions,
			'metrics'    => $metric_defs,
			'rows'       => $rows,
			'row_count'  => count( $rows ),
		];
	}

	/**
	 * Normalize datatable rows to match declared dimensions/metrics.
	 *
	 * @param array<int, mixed>  $rows Raw data rows.
	 * @param array<int, string> $group_by Declared dimensions.
	 * @param array<int, string> $metrics Declared metrics.
	 * @return array<int, array<string, mixed>>
	 */
	private function normalize_agent_datatable_rows( array $rows, array $group_by, array $metrics ): array {
		$normalized = [];

		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$out = [];

			foreach ( $group_by as $dimension ) {
				if ( array_key_exists( $dimension, $row ) ) {
					$out[ $dimension ] = $row[ $dimension ];
				}
			}

			foreach ( $metrics as $metric ) {
				if ( array_key_exists( $metric, $row ) ) {
					$out[ $metric ] = $row[ $metric ];
					continue;
				}

				if ( 1 === count( $metrics ) && 'pageviews' !== $metric && array_key_exists( 'pageviews', $row ) ) {
					$out[ $metric ] = $row['pageviews'];
					continue;
				}

				$out[ $metric ] = 0;
			}

			$normalized[] = $out;
		}

		return $normalized;
	}

	/**
	 * Register chat REST routes when abilities are enabled.
	 */
	public function register_chat_rest_routes(): void {
		register_rest_route(
			'burst/v1',
			'chat',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_chat' ],
				'permission_callback' => [ $this, 'permission_callback' ],
				'args'                => [
					'message' => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => static function ( $value ): string {
							return is_scalar( $value ) ? sanitize_textarea_field( (string) $value ) : '';
						},
					],
					'history' => [
						'required'          => false,
						'default'           => [],
						'type'              => 'array',
						'sanitize_callback' => static function ( $value ): array {
							return is_array( $value ) ? $value : [];
						},
					],
					'model'   => [
						'required'          => false,
						'default'           => '',
						'type'              => 'string',
						'sanitize_callback' => static function ( $value ): string {
							return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
						},
					],
				],
			]
		);

		register_rest_route(
			'burst/v1',
			'chat/status',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_api_chat_status' ],
				'permission_callback' => [ $this, 'permission_callback' ],
			]
		);

		register_rest_route(
			'burst/v1',
			'chat/models',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_api_chat_models' ],
				'permission_callback' => [ $this, 'permission_callback' ],
			]
		);
	}

	/**
	 * Handle chat actions through the existing do_action fallback channel.
	 *
	 * @param mixed                $result Existing action result.
	 * @param string               $action Action name.
	 * @param array<string, mixed> $data   Action payload.
	 *
	 * Mixed $result/return: filter callback in the generic ajax-action chain — it passes through whatever earlier handlers returned for non-'chat' actions, so the type stays open.
	 */
	public function handle_ajax_chat_actions( mixed $result, string $action, array $data ): mixed {
		if ( ! $this->user_can_manage() ) {
			return $result;
		}

		if ( 'chat' === $action ) {
			$request = new \WP_REST_Request();
			$request->set_param( 'message', $data['message'] ?? '' );
			$request->set_param( 'history', isset( $data['history'] ) && is_array( $data['history'] ) ? $data['history'] : [] );
			$request->set_param( 'model', isset( $data['model'] ) && is_string( $data['model'] ) ? $data['model'] : '' );

			$response = $this->rest_api_chat( $request );
			if ( is_wp_error( $response ) ) {
				return [
					'success' => false,
					'message' => $response->get_error_message(),
					'code'    => (int) ( $response->get_error_data()['status'] ?? 500 ),
				];
			}

			return is_array( $response->get_data() ) ? $response->get_data() : [];
		}

		if ( 'chat_status' === $action ) {
			return self::get_chat_availability();
		}

		if ( 'chat_models' === $action ) {
			$response = $this->rest_api_chat_models();
			return is_array( $response->get_data() ) ? $response->get_data() : [];
		}

		return $result;
	}

	/**
	 * Chat endpoint using the WordPress AI Client and Burst abilities.
	 */
	public function rest_api_chat( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$rate_limit = $this->enforce_chat_rate_limit();
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		if ( function_exists( 'wp_register_ability' ) && ! wp_has_ability( 'burst/data' ) ) {
			self::register_abilities_manually();
		}

		$availability = self::get_chat_availability();
		if ( empty( $availability['enabled'] ) ) {
			// Generic server-side message; the dashboard UI surfaces the specific
			// disabled-reason based on the availability flags returned above.
			return new \WP_Error(
				'burst_chat_unavailable',
				'AI chat is currently unavailable.',
				[ 'status' => 403 ]
			);
		}

		if (
			! function_exists( 'wp_ai_client_prompt' )
			|| ! class_exists( '\\WP_AI_Client_Ability_Function_Resolver' )
			|| ! class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\Message' )
			|| ! class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\MessagePart' )
			|| ! class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\ModelMessage' )
			|| ! class_exists( '\\WordPress\\AiClient\\Messages\\DTO\\UserMessage' )
		) {
			return new \WP_Error(
				'burst_ai_client_unavailable',
				'The WordPress AI Client is not available. Please install and activate the AI plugin and configure a connector.',
				[ 'status' => 503 ]
			);
		}

		$this->prime_ai_provider_authentication();

		$message = trim( (string) $request->get_param( 'message' ) );
		$message = $this->sanitize_chat_text( $message, $this->get_prompt_character_limit() );
		if ( '' === $message ) {
			return new \WP_Error(
				'burst_chat_invalid_prompt',
				'Message is required.',
				[ 'status' => 400 ]
			);
		}

		$selected_model = trim( (string) ( $request->get_param( 'model' ) ?? '' ) );
		$history        = $request->get_param( 'history' );

		$messages = $this->normalize_chat_history( is_array( $history ) ? $history : [] );
		if ( is_wp_error( $messages ) ) {
			return $messages;
		}

		$user_message = $this->create_user_message( $message );
		if ( is_wp_error( $user_message ) ) {
			return $user_message;
		}

		$messages[] = $user_message;
		$this->log_chat_debug(
			'request_prepared',
			[
				'prompt_length'    => strlen( $message ),
				'history_messages' => count( $messages ),
			]
		);

		$now          = time();
		$month_start  = (int) strtotime( 'first day of this month midnight', $now );
		$month_end    = (int) strtotime( 'first day of next month midnight', $now ) - 1;
		$week_start   = (int) strtotime( 'monday this week midnight', $now );
		$today_start  = (int) strtotime( 'today midnight', $now );
		$today_end    = $today_start + DAY_IN_SECONDS - 1;
		$current_date = gmdate( 'l, F j, Y', $now );

		$system_prompt = implode(
			"\n",
			[
				'You are the Burst Analytics assistant.',
				'Always use available abilities for data lookups and tasks.',
				'Never fabricate numbers and keep responses concise.',
				'When calling abilities, prefer exact metric names and date ranges from the user context.',
				sprintf( 'Today is %s (UTC).', $current_date ),
				sprintf( 'Current Unix timestamps — today: %d–%d | this week (Mon): %d–now | this month: %d–%d.', $today_start, $today_end, $week_start, $month_start, $month_end ),
				'Always use these timestamps for relative date references such as "today", "this week", or "this month".',
				'At the very end of your response, you MUST append a JSON object wrapped in <telemetry>...</telemetry> tags.',
				'This JSON object must contain the following keys:',
				'- "anonymized_question": A short (3-8 words), generalized, and completely anonymized version of the user\'s latest question (e.g. "show todays summary"). Remove all specific names, exact metrics, dates, URLs, or personal data.',
				'- "answered": A boolean flag indicating whether you successfully answered the user\'s question (true) or if it was not answerable/out of scope/unrecognized (false).',
				'Example format to append:',
				'<telemetry>{"anonymized_question": "show today summary", "answered": true}</telemetry>',
			]
		);

		try {
			$resolver_class = '\\WP_AI_Client_Ability_Function_Resolver';
			if ( ! class_exists( $resolver_class ) ) {
				return new \WP_Error(
					'burst_ai_client_unavailable',
					'The WordPress AI Client ability resolver is not available.',
					[ 'status' => 503 ]
				);
			}

			$resolver        = new \WP_AI_Client_Ability_Function_Resolver( ...self::CHAT_ABILITY_LIST );
			$max_turns       = 5;
			$turn            = 0;
			$assistant_reply = '';

			while ( $turn < $max_turns ) {
				$chat_builder = $this->build_chat_prompt_builder( $messages, $system_prompt, true, $selected_model );

				// First pass or loop pass: get a full result object so we can inspect for tool calls.
				$result = $chat_builder->generate_text_result();

				if ( is_wp_error( $result ) ) {
					$this->log_chat_debug(
						'generate_error',
						[
							'error' => $result->get_error_message(),
							'turn'  => $turn,
						]
					);

					if ( $this->is_provider_protocol_error( $result ) ) {
						$compat = $this->build_chat_prompt_builder( $messages, $system_prompt, false, $selected_model )
							->generate_text();

						if ( is_wp_error( $compat ) ) {
							return $result;
						}

						$assistant_reply = trim( wp_unslash( (string) $compat ) );
						break;
					} else {
						return $result;
					}
				}

				// Extract the model message from the first candidate.
				$model_msg_obj = null;
				if ( method_exists( $result, 'getCandidates' ) ) {
					$candidates = $result->getCandidates();
					if ( ! empty( $candidates ) && method_exists( $candidates[0], 'getMessage' ) ) {
						$model_msg_obj = $candidates[0]->getMessage();
					}
				}

				if ( null === $model_msg_obj ) {
					if ( method_exists( $result, 'toText' ) ) {
						try {
							$assistant_reply = trim( wp_unslash( (string) $result->toText() ) );
						} catch ( \Throwable $e ) {
							$assistant_reply = '';
						}
					}
					break;
				}

				// Map underscores to hyphens for the resolver to check and execute them.
				$this->map_message_function_names( $model_msg_obj, '_' );

				// Check whether the model issued any function/tool calls.
				$has_calls = false;
				if ( method_exists( $resolver, 'has_ability_calls' ) ) {
					$has_calls = $resolver->has_ability_calls( $model_msg_obj );
				} elseif ( method_exists( $model_msg_obj, 'getParts' ) ) {
					foreach ( $model_msg_obj->getParts() as $part ) {
						if ( method_exists( $part, 'getFunctionCall' ) && null !== $part->getFunctionCall() ) {
							$has_calls = true;
							break;
						}
					}
				}

				if ( $has_calls ) {
					// Append the model's tool-call turn then resolve abilities.
					$messages[] = $model_msg_obj;

					$tool_result_msg = $resolver->execute_abilities( $model_msg_obj );

					// Map hyphens back to underscores for Anthropic compatibility.
					$this->map_message_function_names( $model_msg_obj, '-' );
					if ( null !== $tool_result_msg && ! is_wp_error( $tool_result_msg ) ) {
						$this->map_message_function_names( $tool_result_msg, '-' );
						$messages[] = $tool_result_msg;
					}

					++$turn;
				} else {
					// No tool calls – this is the final answer! Read the text directly.
					$this->map_message_function_names( $model_msg_obj, '-' );

					if ( method_exists( $result, 'toText' ) ) {
						try {
							$assistant_reply = trim( wp_unslash( (string) $result->toText() ) );
						} catch ( \Throwable $e ) {
							$assistant_reply = '';
						}
					}
					break;
				}
			}

			// Final pass fallback if the loop finished but left us without an assistant reply text.
			if ( '' === $assistant_reply ) {
				$this->log_chat_debug(
					'max_turns_reached',
					[
						'turns' => $turn,
					]
				);

				$final = $this->build_chat_prompt_builder( $messages, $system_prompt, false, $selected_model )
					->generate_text();

				if ( ! is_wp_error( $final ) ) {
					$assistant_reply = trim( wp_unslash( (string) $final ) );
				}
			}

			if ( '' === $assistant_reply ) {
				return new \WP_Error(
					'burst_ai_client_empty_response',
					'The AI did not return a response.',
					[ 'status' => 502 ]
				);
			}

			$anonymized_question = 'Chat assistant query';
			$answered            = false;

			if ( str_contains( $assistant_reply, '<telemetry>' ) ) {
				$parts             = explode( '<telemetry>', $assistant_reply, 2 );
				$assistant_reply   = trim( $parts[0] );
				$telemetry_content = $parts[1];

				if ( str_contains( $telemetry_content, '</telemetry>' ) ) {
					$subparts          = explode( '</telemetry>', $telemetry_content, 2 );
					$telemetry_content = $subparts[0];
					if ( trim( $subparts[1] ) !== '' ) {
						$assistant_reply .= "\n" . trim( $subparts[1] );
					}
				}

				$telemetry_data = json_decode( trim( $telemetry_content ), true );
				if ( is_array( $telemetry_data ) ) {
					if ( isset( $telemetry_data['anonymized_question'] ) && '' !== trim( (string) $telemetry_data['anonymized_question'] ) ) {
						$anonymized_question = sanitize_text_field( trim( (string) $telemetry_data['anonymized_question'] ) );
					}
					if ( isset( $telemetry_data['answered'] ) ) {
						$answered = (bool) $telemetry_data['answered'];
					}
				}
			}

			$model_message = $this->create_model_message( $assistant_reply );
			if ( ! is_wp_error( $model_message ) ) {
				$messages[] = $model_message;
			}

			$this->record_chat_question( $anonymized_question, $selected_model, $answered );

			return new \WP_REST_Response(
				[
					'reply'   => $assistant_reply,
					'history' => $this->serialize_chat_history( $messages ),
				],
				200
			);
		} catch ( \Throwable $throwable ) {
			$this->log_chat_debug(
				'chat_exception',
				[
					'exception' => get_class( $throwable ),
					'message'   => $throwable->getMessage(),
					'code'      => $throwable->getCode(),
				]
			);

			$message     = $throwable->getMessage();
			$status_code = 500;

			if ( '' !== $message && false !== stripos( $message, 'provider' ) && false !== stripos( $message, 'not configured' ) ) {
				$status_code = 503;
			}

			$error_data = [
				'status'      => $status_code,
				'diagnostics' => $this->get_ai_provider_diagnostics(),
			];

			$expose_exception = (bool) apply_filters( 'burst_chat_expose_exception', false );
			if ( $expose_exception ) {
				$error_data['exception'] = get_class( $throwable ) . ': ' . $message;
			}

			return new \WP_Error(
				'burst_ai_client_exception',
				'Unable to generate a chat response right now.',
				$error_data
			);
		}
	}

	/**
	 * Chat models endpoint — returns available AI models from the configured provider.
	 */
	public function rest_api_chat_models(): \WP_REST_Response {
		$models  = $this->get_available_chat_models();
		$default = $this->get_default_chat_model( $models );
		return new \WP_REST_Response(
			[
				'models'  => $models,
				'default' => $default,
			],
			200
		);
	}

	/**
	 * Resolve the default AI model based on provider preference list.
	 *
	 * @param array<int, array<string, string>> $available_models Available models list.
	 * @return array<string, string>|null Default model object or null.
	 */
	private function get_default_chat_model( array $available_models ): ?array {
		if ( ! class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			return null;
		}

		$preferred = [];
		if ( function_exists( 'WordPress\\AI\\get_preferred_models_for_text_generation' ) ) {
			$preferred = \WordPress\AI\get_preferred_models_for_text_generation();
		}

		if ( ! empty( $preferred ) ) {
			foreach ( $preferred as $pref ) {
				if ( ! is_array( $pref ) || count( $pref ) < 2 ) {
					continue;
				}
				$provider_id = $pref[0];
				$model_id    = $pref[1];

				foreach ( $available_models as $m ) {
					if ( strtolower( $m['provider'] ) === strtolower( $provider_id ) && $m['id'] === $model_id ) {
						return $m;
					}
				}
			}
		}

		return ! empty( $available_models ) ? $available_models[0] : null;
	}


	/**
	 * Retrieve a flat list of available AI models from the provider registry.
	 *
	 * Each entry has `id` (string), `label` (string), and `provider` (string).
	 *
	 * @return array<int, array<string, string>>
	 */
	private function get_available_chat_models(): array {
		if ( ! class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			return [];
		}

		try {
			$registry = \WordPress\AiClient\AiClient::defaultRegistry();
			$this->ensure_ai_providers_registered( $registry );

			if ( ! method_exists( $registry, 'getRegisteredProviderIds' ) ) {
				return [];
			}

			$models = [];

			foreach ( $registry->getRegisteredProviderIds() as $provider_id ) {
				$option_name = 'connectors_ai_' . str_replace( '-', '_', $provider_id ) . '_api_key';
				$api_key     = get_option( $option_name, '' );
				if ( ! is_string( $api_key ) || '' === $api_key ) {
					continue;
				}

				$provider_models = [];

				try {
					// getProviderClassName() is the public API (resolveProviderClassName is private).
					if ( ! method_exists( $registry, 'getProviderClassName' ) ) {
						continue;
					}

					$provider_class = $registry->getProviderClassName( $provider_id );

					if ( ! $provider_class || ! method_exists( $provider_class, 'modelMetadataDirectory' ) ) {
						continue;
					}

					$directory = $provider_class::modelMetadataDirectory();
					if ( ! method_exists( $directory, 'listModelMetadata' ) ) {
						continue;
					}

					$provider_labels = [
						'openai'    => 'OpenAI',
						'anthropic' => 'Anthropic',
						'google'    => 'Google',
					];
					$provider_label  = $provider_labels[ $provider_id ] ?? ucwords( $provider_id );

					foreach ( $directory->listModelMetadata() as $meta ) {
						// ModelMetadata uses getId(), not getModelId().
						if ( ! method_exists( $meta, 'getId' ) ) {
							continue;
						}

						$model_id = (string) $meta->getId();
						$label    = method_exists( $meta, 'getName' ) ?
							(string) $meta->getName() :
							$model_id;

						$provider_models[] = [
							'id'       => $model_id,
							'label'    => $label,
							'provider' => $provider_label,
							'meta'     => $meta,
						];
					}
				} catch ( \Throwable $e ) {
					// Skip providers that error during model introspection.
					continue;
				}

				foreach ( $provider_models as $model_data ) {
					$meta        = $model_data['meta'];
					$is_text_gen = true;
					if ( method_exists( $meta, 'getSupportedCapabilities' ) ) {
						$capabilities = $meta->getSupportedCapabilities();
						$is_text_gen  = false;
						if ( class_exists( '\WordPress\AiClient\Providers\Models\Enums\CapabilityEnum' ) ) {
							$text_gen_cap = \WordPress\AiClient\Providers\Models\Enums\CapabilityEnum::textGeneration();
							foreach ( $capabilities as $cap ) {
								if ( $cap === $text_gen_cap
									|| ( isset( $cap->value ) && $cap->value === $text_gen_cap->value )
									|| ( method_exists( $cap, 'getValue' ) && $cap->getValue() === $text_gen_cap->getValue() )
								) {
									$is_text_gen = true;
									break;
								}
							}
						}
					}

					if ( $is_text_gen ) {
						$models[] = [
							'id'       => $model_data['id'],
							'label'    => $model_data['label'],
							'provider' => $model_data['provider'],
						];
					}
				}
			}

			return $models;
		} catch ( \Throwable $e ) {
			return [];
		}
	}

	/**
	 * Chat status endpoint for dashboard availability checks.
	 */
	public function rest_api_chat_status(): \WP_REST_Response {
		return new \WP_REST_Response( self::get_chat_availability(), 200 );
	}

	/**
	 * Shared chat availability payload with extension filter.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_chat_availability(): array {
		$instance = new self();
		$payload  = $instance->build_chat_availability();

		return apply_filters( 'burst_chat_availability', $payload );
	}

	/**
	 * Normalize incoming history payload into SDK message objects.
	 *
	 * @param array<int, mixed> $history
	 * @return array<int, object>|\WP_Error
	 */
	private function normalize_chat_history( array $history ): array|\WP_Error {
		$messages      = [];
		$history       = array_slice( $history, -1 * $this->get_history_max_items() );
		$text_limit    = $this->get_prompt_character_limit();
		$parts_limit   = $this->get_parts_max_items();
		$message_class = implode( '\\', [ 'WordPress', 'AiClient', 'Messages', 'DTO', 'Message' ] );

		foreach ( $history as $index => $raw_message ) {
			if ( ! is_array( $raw_message ) ) {
				return new \WP_Error(
					'burst_chat_invalid_history',
					sprintf( 'History item %d is invalid.', (int) $index ),
					[ 'status' => 400 ]
				);
			}

			$role = $this->sanitize_history_role( $raw_message['role'] ?? '' );
			if ( '' === $role ) {
				return new \WP_Error(
					'burst_chat_invalid_history',
					sprintf( 'History item %d has an unsupported role.', (int) $index ),
					[ 'status' => 400 ]
				);
			}

			if ( isset( $raw_message['parts'] ) && is_array( $raw_message['parts'] ) ) {
				if ( ! class_exists( $message_class ) ) {
					return new \WP_Error(
						'burst_ai_client_unavailable',
						'The WordPress AI Client message classes are not available.',
						[ 'status' => 503 ]
					);
				}

				$parts = array_slice( $raw_message['parts'], 0, $parts_limit );
				$parts = array_values(
					array_filter(
						array_map( [ $this, 'sanitize_chat_part' ], $parts ),
						static fn( $part ): bool => null !== $part
					)
				);

				$normalized = [
					'role'  => $role,
					'parts' => $parts,
				];

				try {
					$messages[] = call_user_func( [ $message_class, 'fromArray' ], $normalized );
					continue;
				} catch ( \Throwable $e ) {
					return new \WP_Error(
						'burst_chat_invalid_history',
						sprintf( 'History item %d has invalid message parts.', (int) $index ),
						[ 'status' => 400 ]
					);
				}
			}

			$content = isset( $raw_message['content'] ) ? $this->sanitize_chat_text( (string) $raw_message['content'], $text_limit ) : '';

			if ( 'model' === $role ) {
				$model_message = $this->create_model_message( $content );
				if ( is_wp_error( $model_message ) ) {
					return $model_message;
				}

				$messages[] = $model_message;
			} elseif ( 'user' === $role ) {
				$user_message = $this->create_user_message( $content );
				if ( is_wp_error( $user_message ) ) {
					return $user_message;
				}

				$messages[] = $user_message;
			}
		}

		return $messages;
	}

	/**
	 * Build a chat prompt builder with a service-aware fallback.
	 *
	 * @throws \RuntimeException When the AI client prompt builder is unavailable.
	 */
	private function build_chat_prompt_builder( array $messages, string $system_prompt, bool $with_abilities = true, string $preferred_model = '' ): object {
		if ( function_exists( 'WordPress\\AI\\get_ai_service' ) ) {
			$builder = \WordPress\AI\get_ai_service()->create_textgen_prompt();
		} else {
			if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
				throw new \RuntimeException( 'wp_ai_client_prompt is unavailable.' );
			}

			$builder = wp_ai_client_prompt();
		}

		$builder = $builder
			->with_history( ...$messages )
			->using_system_instruction( $system_prompt );

		// Apply the model preference when the user has explicitly selected one.
		if ( '' !== $preferred_model && method_exists( $builder, 'using_model_preference' ) ) {
			$builder = $builder->using_model_preference( $preferred_model );
		}

		if ( $with_abilities ) {
			$declarations = $this->get_normalized_chat_function_declarations();
			if ( ! empty( $declarations ) ) {
				$builder = $builder->using_function_declarations( ...$declarations );
			}
		}

		return $builder;
	}

	/**
	 * Build tool declarations with provider-compatible input schemas.
	 *
	 * @return array<int, object>
	 */
	private function get_normalized_chat_function_declarations(): array {
		$declaration_class = '\\WordPress\\AiClient\\Tools\\DTO\\FunctionDeclaration';

		if ( ! function_exists( 'wp_get_ability' ) || ! class_exists( $declaration_class ) ) {
			return [];
		}

		$declarations = [];

		foreach ( self::CHAT_ABILITY_LIST as $ability_name ) {
			$ability = wp_get_ability( $ability_name );
			if ( null === $ability ) {
				continue;
			}

			$function_name = $this->ability_name_to_function_name( $ability->get_name() );
			$function_name = str_replace( '-', '_', $function_name );
			$input_schema  = $this->normalize_tool_input_schema( $ability->get_input_schema() );

			$declarations[] = new $declaration_class(
				$function_name,
				$ability->get_description(),
				$input_schema
			);
		}

		return $declarations;
	}

	/**
	 * Normalize ability input schema to providers that require type=object.
	 *
	 * @return array<string, mixed>
	 *
	 * Mixed $schema: an ability's registered input_schema which is not guaranteed to be an array; the is_array guard coerces anything else to [].
	 */
	private function normalize_tool_input_schema( mixed $schema ): array {
		if ( ! is_array( $schema ) ) {
			$schema = [];
		}

		$type = $schema['type'] ?? 'object';
		if ( is_array( $type ) ) {
			$schema['type'] = 'object';
		} elseif ( ! is_string( $type ) || 'object' !== $type ) {
			$schema['type'] = 'object';
		}

		if ( isset( $schema['properties'] ) ) {
			if ( ! is_array( $schema['properties'] ) || array_is_list( $schema['properties'] ) || empty( $schema['properties'] ) ) {
				unset( $schema['properties'] );
			} else {
				foreach ( $schema['properties'] as $property_name => $property_schema ) {
					if ( ! is_string( $property_name ) ) {
						unset( $schema['properties'][ $property_name ] );
						continue;
					}

					$schema['properties'][ $property_name ] = $this->normalize_schema_branch( $property_schema );
				}

				if ( empty( $schema['properties'] ) ) {
					unset( $schema['properties'] );
				}
			}
		}

		return $schema;
	}

	/**
	 * Recursively normalize JSON schema branches for provider compatibility.
	 *
	 * @return array<string, mixed>
	 *
	 * Mixed $branch: a nested schema node that may be any JSON value during recursion (array or scalar leaf); the is_array guard handles non-array leaves.
	 */
	private function normalize_schema_branch( mixed $branch ): array {
		if ( ! is_array( $branch ) ) {
			return [ 'type' => 'string' ];
		}

		if ( isset( $branch['type'] ) && is_array( $branch['type'] ) ) {
			$preferred_types = [ 'object', 'array', 'string', 'number', 'integer', 'boolean' ];
			foreach ( $preferred_types as $preferred_type ) {
				if ( in_array( $preferred_type, $branch['type'], true ) ) {
					$branch['type'] = $preferred_type;
					break;
				}
			}
		}

		if ( isset( $branch['type'] ) && 'object' === $branch['type'] ) {
			if ( isset( $branch['properties'] ) ) {
				if ( ! is_array( $branch['properties'] ) || array_is_list( $branch['properties'] ) || empty( $branch['properties'] ) ) {
					unset( $branch['properties'] );
				} else {
					foreach ( $branch['properties'] as $property_name => $property_schema ) {
						if ( ! is_string( $property_name ) ) {
							unset( $branch['properties'][ $property_name ] );
							continue;
						}

						$branch['properties'][ $property_name ] = $this->normalize_schema_branch( $property_schema );
					}
					if ( empty( $branch['properties'] ) ) {
						unset( $branch['properties'] );
					}
				}
			}
		}

		if ( isset( $branch['items'] ) ) {
			if ( is_array( $branch['items'] ) ) {
				$branch['items'] = $this->normalize_schema_branch( $branch['items'] );
			} else {
				unset( $branch['items'] );
			}
		}

		foreach ( [ 'anyOf', 'allOf', 'oneOf' ] as $combinator ) {
			if ( isset( $branch[ $combinator ] ) && is_array( $branch[ $combinator ] ) ) {
				$branch[ $combinator ] = array_values(
					array_map( [ $this, 'normalize_schema_branch' ], $branch[ $combinator ] )
				);
			}
		}

		return $branch;
	}

	/**
	 * Ensure AI provider request authentication is set from connector options.
	 */
	private function prime_ai_provider_authentication(): void {
		if ( ! class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			return;
		}

		try {
			$registry = \WordPress\AiClient\AiClient::defaultRegistry();
		} catch ( \Throwable $e ) {
			return;
		}

		$this->ensure_ai_providers_registered( $registry );

		foreach ( $registry->getRegisteredProviderIds() as $provider_id ) {
			$option_name = 'connectors_ai_' . str_replace( '-', '_', $provider_id ) . '_api_key';
			$api_key     = get_option( $option_name, '' );

			if ( ! is_string( $api_key ) || '' === $api_key ) {
				continue;
			}

			try {
				$provider_class = $registry->getProviderClassName( $provider_id );
				$auth_method    = $provider_class::metadata()->getAuthenticationMethod();
				$auth_class     = $auth_method ? $auth_method->getImplementationClass() : null;

				if ( ! is_string( $auth_class ) || ! class_exists( $auth_class ) || ! method_exists( $auth_class, 'fromArray' ) ) {
					continue;
				}

				$registry->setProviderRequestAuthentication(
					$provider_id,
					$auth_class::fromArray( [ 'apiKey' => $api_key ] )
				);
			} catch ( \Throwable $e ) {
				continue;
			}
		}
	}

	/**
	 * Provide non-sensitive AI provider diagnostics for troubleshooting.
	 *
	 * @return array<string, mixed>
	 */
	private function get_ai_provider_diagnostics(): array {
		if ( ! $this->is_wp_ai_plugin_active() || ! class_exists( '\\WordPress\\AiClient\\AiClient' ) ) {
			return [ 'ai_client_loaded' => false ];
		}

		try {
			$registry = \WordPress\AiClient\AiClient::defaultRegistry();
			$this->ensure_ai_providers_registered( $registry );
			$providers      = [];
			$registered_ids = $registry->getRegisteredProviderIds();

			if ( empty( $registered_ids ) ) {
				$known_provider_ids = [ 'openai', 'anthropic', 'google' ];
				foreach ( $known_provider_ids as $provider_id ) {
					$option_name = 'connectors_ai_' . str_replace( '-', '_', $provider_id ) . '_api_key';
					$api_key     = get_option( $option_name, '' );
					$key_present = is_string( $api_key ) && '' !== $api_key;

					$providers[ $provider_id ] = [
						'api_key_present' => $key_present,
					];
				}

				return [
					'ai_client_loaded' => true,
					'providers'        => $providers,
				];
			}

			foreach ( $registered_ids as $provider_id ) {
				$option_name = 'connectors_ai_' . str_replace( '-', '_', $provider_id ) . '_api_key';
				$api_key     = get_option( $option_name, '' );
				$key_present = is_string( $api_key ) && '' !== $api_key;

				$providers[ $provider_id ] = [
					'api_key_present' => $key_present,
				];
			}

			return [
				'ai_client_loaded' => true,
				'providers'        => $providers,
			];
		} catch ( \Throwable $e ) {
			return [
				'ai_client_loaded' => true,
				'error'            => $e->getMessage(),
			];
		}
	}

	/**
	 * Determine whether the WordPress AI plugin is active.
	 *
	 * Uses plugin option lists as primary source so REST/admin contexts are
	 * consistent and do not depend on optional helper availability.
	 * On multisite, also checks network-wide activated plugins.
	 */
	private function is_wp_ai_plugin_active(): bool {
		$runtime_loaded = function_exists( 'wp_ai_client_prompt' ) ||
			class_exists( 'WP_AI_Client_Ability_Function_Resolver' ) ||
			class_exists( 'WordPress\\AiClient\\AiClient' );

		$ai_basename = $this->get_ai_plugin_basename();
		// Check site-level active plugins.
		$active_plugins = get_option( 'active_plugins', [] );
		$option_check   = is_array( $active_plugins ) && in_array( $ai_basename, $active_plugins, true );

		// On multisite, also check network-wide activated plugins.
		if ( ! $option_check && is_multisite() ) {
			$network_plugins = get_site_option( 'active_sitewide_plugins', [] );
			$option_check    = is_array( $network_plugins ) && array_key_exists( $ai_basename, $network_plugins );
		}

		return $runtime_loaded && $option_check;
	}

	/**
	 * Build non-sensitive chat availability flags for the dashboard UI.
	 *
	 * @return array<string, mixed>
	 */
	private function build_chat_availability(): array {
		if ( function_exists( 'wp_register_ability' ) && ! wp_has_ability( 'burst/data' ) ) {
			self::register_abilities_manually();
		}

		$abilities_enabled = self::is_enabled();
		$ai_plugin_active  = $this->is_wp_ai_plugin_active();
		$ai_client_loaded  = $ai_plugin_active && (
			function_exists( 'WordPress\\AI\\get_ai_service' )
			|| function_exists( 'wp_ai_client_prompt' )
			|| class_exists( '\\WordPress\\AiClient\\AiClient' )
		);

		$connector_approvals_enabled = (bool) get_option( 'wpai_features_enabled', false ) && (bool) get_option( 'wpai_feature_connector-approval_enabled', false );
		$connector_approvals_missing = false;
		$missing_approvals_list      = [];

		$has_configured_provider = false;
		if ( $ai_client_loaded ) {
			$diagnostics = $this->get_ai_provider_diagnostics();
			$providers   = isset( $diagnostics['providers'] ) && is_array( $diagnostics['providers'] )
				? $diagnostics['providers']
				: [];

			foreach ( $providers as $provider_id => $provider ) {
				if ( is_array( $provider ) && ! empty( $provider['api_key_present'] ) ) {
					$has_configured_provider = true;

					if ( $connector_approvals_enabled ) {
						// Check the three approvals for this provider connector.
						$burst_basename    = defined( 'BURST_PLUGIN' ) ? BURST_PLUGIN : 'burst-pro/burst-pro.php';
						$ai_basename       = $this->get_ai_plugin_basename();
						$provider_basename = $this->get_connector_plugin_basename( $provider_id );

						$burst_approved    = $this->is_caller_approved( $burst_basename, $provider_id );
						$ai_approved       = $this->is_caller_approved( $ai_basename, $provider_id );
						$provider_approved = empty( $provider_basename ) || $this->is_caller_approved( $provider_basename, $provider_id );

						if ( ! $burst_approved || ! $ai_approved || ! $provider_approved ) {
							$connector_approvals_missing = true;

							if ( ! $burst_approved ) {
								$missing_approvals_list[] = 'Burst';
							}
							if ( ! $ai_approved ) {
								$missing_approvals_list[] = 'WordPress AI';
							}
							if ( ! $provider_approved ) {
								$provider_names           = [
									'openai'    => 'OpenAI',
									'anthropic' => 'Anthropic',
									'google'    => 'Google',
								];
								$provider_name            = $provider_names[ $provider_id ] ?? ucwords( $provider_id );
								$missing_approvals_list[] = $provider_name . ' Provider';
							}
						}
					}
					break;
				}
			}
		}

		// Also require plugin to be truly active (runtime signals) to avoid false positives if plugin is deactivated but classes persist.
		$enabled = $abilities_enabled && $ai_client_loaded && $has_configured_provider && $ai_plugin_active && ! $connector_approvals_missing;

		// Disabled-reason strings are assembled client-side in the React UI so
		// translations live in one place. We only ship the raw flags and the
		// list of missing approval names — React formats the user-facing copy.
		return [
			'enabled'                 => $enabled,
			'abilities_enabled'       => $abilities_enabled,
			'ai_client_loaded'        => $ai_client_loaded,
			'has_configured_provider' => $has_configured_provider,
			'missing_approvals'       => array_values( array_unique( $missing_approvals_list ) ),
		];
	}

	/**
	 * Register known provider classes if they are installed but not yet registered.
	 *
	 * @param object $registry AI provider registry instance.
	 */
	private function ensure_ai_providers_registered( object $registry ): void {
		if ( ! method_exists( $registry, 'hasProvider' ) || ! method_exists( $registry, 'registerProvider' ) ) {
			return;
		}

		$providers = [
			'\\WordPress\\AnthropicAiProvider\\Provider\\AnthropicProvider',
			'\\WordPress\\OpenAiProvider\\Provider\\OpenAiProvider',
			'\\WordPress\\GoogleAiProvider\\Provider\\GoogleProvider',
		];

		foreach ( $providers as $provider_class ) {
			// Only register if the class is already in memory — never load files here.
			if ( ! class_exists( $provider_class, false ) ) {
				continue;
			}

			if ( $registry->hasProvider( $provider_class ) ) {
				continue;
			}

			try {
				$registry->registerProvider( $provider_class );
			} catch ( \Throwable $e ) {
				continue;
			}
		}
	}

	/**
	 * Get the plugin basename for the WordPress AI plugin.
	 *
	 * Falls back to 'ai/ai.php' if WPAI_PLUGIN_FILE is not defined.
	 */
	private function get_ai_plugin_basename(): string {
		if ( defined( 'WPAI_PLUGIN_FILE' ) ) {
			return plugin_basename( WPAI_PLUGIN_FILE );
		}
		return 'ai/ai.php';
	}

	/**
	 * Convert normalized message objects to JSON-serializable array data.
	 *
	 * @param array<int, object> $messages
	 * @return array<int, array<string, mixed>>
	 */
	private function serialize_chat_history( array $messages ): array {
		return array_map(
			static function ( object $message ): array {
				if ( method_exists( $message, 'toArray' ) ) {
					return $message->toArray();
				}

				return [];
			},
			$messages
		);
	}

	/**
	 * Detect provider protocol/format errors that should trigger compatibility fallback.
	 */
	private function is_provider_protocol_error( \WP_Error $error ): bool {
		$error_message = $error->get_error_message();

		return false !== stripos( $error_message, 'Unexpected Anthropic API response' )
			|| false !== stripos( $error_message, 'tool_result' )
			|| false !== stripos( $error_message, 'tool_use' )
			|| false !== stripos( $error_message, 'Missing the "content" key' );
	}

	/**
	 * Determine whether chat debug logging is enabled.
	 */
	private function is_chat_debug_enabled(): bool {
		$enabled = defined( 'WP_DEBUG' ) ? (bool) constant( 'WP_DEBUG' ) : false;

		return (bool) apply_filters( 'burst_chat_debug', $enabled );
	}

	/**
	 * Write structured chat debug logs when enabled.
	 *
	 * @param string               $event   Event identifier.
	 * @param array<string, mixed> $context Optional context data.
	 */
	private function log_chat_debug( string $event, array $context = [] ): void {
		if ( ! $this->is_chat_debug_enabled() ) {
			return;
		}

		$payload = [
			'event'   => $event,
			'context' => $context,
		];

		wp_trigger_error( __METHOD__, '[Burst Chat Debug] ' . wp_json_encode( $payload ), E_USER_NOTICE );
	}

	/**
	 * Apply a dedicated per-user chat rate limit.
	 */
	private function enforce_chat_rate_limit(): bool|\WP_Error {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return new \WP_Error(
				'burst_chat_forbidden',
				'You are not allowed to use this endpoint.',
				[ 'status' => 403 ]
			);
		}

		$window = max( 1, (int) apply_filters( 'burst_chat_rate_limit_window', 60 ) );
		$max    = max( 1, (int) apply_filters( 'burst_chat_rate_limit_max', 20 ) );
		$bucket = (int) floor( time() / $window );
		$key    = 'burst_chat_rl_' . $user_id . '_' . $bucket;

		$count = (int) get_transient( $key );
		if ( $count >= $max ) {
			return new \WP_Error(
				'burst_chat_rate_limited',
				'Too many chat requests. Please try again shortly.',
				[ 'status' => 429 ]
			);
		}

		set_transient( $key, $count + 1, $window );
		return true;
	}

	/**
	 * Convert an ability name (for example burst/data) to AI function name.
	 */
	private function ability_name_to_function_name( string $ability_name ): string {
		// Keep hyphens intact so resolver roundtrips function names back to the
		// original ability IDs (it maps "__" to "/").
		$normalized = str_replace( '/', '__', $ability_name );

		return 'wpab__' . ltrim( $normalized, '_' );
	}

	/**
	 * Create a UserMessage from plain text with runtime class guards.
	 */
	private function create_user_message( string $text ): object {
		$part = $this->create_message_part( $text );
		if ( is_wp_error( $part ) ) {
			return $part;
		}

		$message_class = '\\WordPress\\AiClient\\Messages\\DTO\\UserMessage';
		if ( ! class_exists( $message_class ) ) {
			return new \WP_Error(
				'burst_ai_client_unavailable',
				'The WordPress AI Client user message class is not available.',
				[ 'status' => 503 ]
			);
		}

		return new $message_class( [ $part ] );
	}

	/**
	 * Create a ModelMessage from plain text with runtime class guards.
	 */
	private function create_model_message( string $text ): object {
		$part = $this->create_message_part( $text );
		if ( is_wp_error( $part ) ) {
			return $part;
		}

		$message_class = '\\WordPress\\AiClient\\Messages\\DTO\\ModelMessage';
		if ( ! class_exists( $message_class ) ) {
			return new \WP_Error(
				'burst_ai_client_unavailable',
				'The WordPress AI Client model message class is not available.',
				[ 'status' => 503 ]
			);
		}

		return new $message_class( [ $part ] );
	}

	/**
	 * Create a MessagePart from plain text with runtime class guards.
	 */
	private function create_message_part( string $text ): object {
		$part_class = '\\WordPress\\AiClient\\Messages\\DTO\\MessagePart';
		if ( ! class_exists( $part_class ) ) {
			return new \WP_Error(
				'burst_ai_client_unavailable',
				'The WordPress AI Client message part class is not available.',
				[ 'status' => 503 ]
			);
		}

		return new $part_class( $text );
	}

	/**
	 * Normalize and sanitize a chat history role.
	 *
	 * Mixed $role: unvalidated value from a request-supplied chat-history entry that may not be a string; cast/sanitized to a known role here.
	 */
	private function sanitize_history_role( mixed $role ): string {
		$normalized = sanitize_key( (string) $role );
		if ( 'assistant' === $normalized ) {
			$normalized = 'model';
		}

		return in_array( $normalized, [ 'user', 'model' ], true ) ? $normalized : '';
	}

	/**
	 * Normalize and sanitize message part arrays, supporting all types of parts.
	 *
	 * @param mixed $part Raw part.
	 * @return array<string, mixed>|null
	 *
	 * Mixed $part: unvalidated value from a request-supplied message-parts list that may not be an array; the is_array guard returns null for anything else.
	 */
	private function sanitize_chat_part( mixed $part ): ?array {
		if ( ! is_array( $part ) ) {
			return null;
		}

		$channel = sanitize_key( (string) ( $part['channel'] ?? '' ) );
		if ( '' === $channel ) {
			$channel = 'content';
		}

		$type = sanitize_key( (string) ( $part['type'] ?? '' ) );

		$sanitized = [
			'channel' => $channel,
			'type'    => $type,
		];

		if ( isset( $part['text'] ) ) {
			$sanitized['text'] = $this->sanitize_chat_text( (string) $part['text'], $this->get_prompt_character_limit() );
		}

		if ( isset( $part['thoughtSignature'] ) ) {
			$sanitized['thoughtSignature'] = sanitize_text_field( (string) $part['thoughtSignature'] );
		}

		if ( isset( $part['file'] ) && is_array( $part['file'] ) ) {
			$sanitized['file'] = $this->sanitize_array_recursive( $part['file'] );
		}

		if ( isset( $part['functionCall'] ) && is_array( $part['functionCall'] ) ) {
			$call                      = $part['functionCall'];
			$sanitized['functionCall'] = [
				'id'   => sanitize_text_field( (string) ( $call['id'] ?? '' ) ),
				'name' => sanitize_text_field( (string) ( $call['name'] ?? '' ) ),
				'args' => is_array( $call['args'] ?? null ) ? $this->sanitize_array_recursive( $call['args'] ) : [],
			];
		}

		if ( isset( $part['functionResponse'] ) && is_array( $part['functionResponse'] ) ) {
			$resp                          = $part['functionResponse'];
			$raw_response                  = $resp['response'] ?? null;
			$sanitized['functionResponse'] = [
				'id'       => sanitize_text_field( (string) ( $resp['id'] ?? '' ) ),
				'name'     => sanitize_text_field( (string) ( $resp['name'] ?? '' ) ),
				'response' => is_array( $raw_response ) ? $this->sanitize_array_recursive( $raw_response ) : ( is_scalar( $raw_response ) ? wp_kses_post( (string) $raw_response ) : [] ),
			];
		}

		return $sanitized;
	}

	/**
	 * Recursively sanitize array values using sanitize_text_field or wp_kses_post.
	 *
	 * @param mixed $value The value to sanitize.
	 * @return mixed The recursively sanitized value.
	 *
	 * Mixed in/out: recurses over an arbitrary request payload (nested arrays and scalar leaves) and returns the same shape sanitized — genuinely polymorphic.
	 */
	private function sanitize_array_recursive( mixed $value ): mixed {
		if ( is_array( $value ) ) {
			$sanitized = [];
			foreach ( $value as $k => $v ) {
				$sanitized[ sanitize_text_field( (string) $k ) ] = $this->sanitize_array_recursive( $v );
			}
			return $sanitized;
		}

		if ( is_string( $value ) ) {
			return wp_kses_post( $value );
		}

		return $value;
	}

	/**
	 * Sanitize and clamp freeform chat text.
	 */
	private function sanitize_chat_text( string $text, int $max_length ): string {
		$sanitized = sanitize_textarea_field( $text );
		if ( strlen( $sanitized ) > $max_length ) {
			$sanitized = substr( $sanitized, 0, $max_length );
		}

		return $sanitized;
	}

	/**
	 * Chat prompt input max character limit.
	 */
	private function get_prompt_character_limit(): int {
		return max( 1, (int) apply_filters( 'burst_chat_prompt_max_length', 8000 ) );
	}

	/**
	 * Chat history max item count.
	 */
	private function get_history_max_items(): int {
		return max( 1, (int) apply_filters( 'burst_chat_history_max_items', 40 ) );
	}

	/**
	 * Message part max count per history message.
	 */
	private function get_parts_max_items(): int {
		return max( 1, (int) apply_filters( 'burst_chat_parts_max_items', 50 ) );
	}

	/**
	 * Enforce a simple per-user rate limit.
	 *
	 * @param string $ability Ability name.
	 */
	private function enforce_rate_limit( string $ability ): bool|\WP_Error {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return new \WP_Error(
				'burst_abilities_forbidden',
				'You are not allowed to use this ability.',
				[ 'status' => 403 ]
			);
		}

		$window = max( 1, (int) apply_filters( 'burst_abilities_rate_limit_window', 60, $ability ) );
		$max    = max( 1, (int) apply_filters( 'burst_abilities_rate_limit_max', 30, $ability ) );
		$bucket = (int) floor( time() / $window );
		$key    = 'burst_abilities_rl_' . $user_id . '_' . hash( 'sha256', $ability ) . '_' . $bucket;

		$count = (int) get_transient( $key );
		if ( $count >= $max ) {
			return new \WP_Error(
				'burst_abilities_rate_limited',
				'Too many ability requests. Please try again shortly.',
				[ 'status' => 429 ]
			);
		}

		set_transient( $key, $count + 1, $window );
		return true;
	}

	/**
	 * Get Burst admin instance in REST contexts where admin may not be bootstrapped.
	 */
	private function get_admin_instance(): Admin|\WP_Error {
		$loader = burst_loader();

		if ( isset( $loader->admin ) ) {
			return $loader->admin;
		}

		if ( ! class_exists( Admin::class ) ) {
			return new \WP_Error(
				'burst_abilities_unavailable',
				'Burst admin services are not available right now.',
				[ 'status' => 503 ]
			);
		}

		$loader->admin = new Admin();
		$loader->admin->init();

		if ( ! isset( $loader->admin ) ) {
			return new \WP_Error(
				'burst_abilities_unavailable',
				'Burst admin services are not available right now.',
				[ 'status' => 503 ]
			);
		}

		return $loader->admin;
	}

	/**
	 * Schema helper for abilities that do not accept input.
	 *
	 * @return array<string, mixed>
	 */
	private function empty_object_schema(): array {
		return [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => (object) [],
		];
	}

	/**
	 * Check if a caller is approved for a connector in Connector Approvals.
	 */
	private function is_caller_approved( string $caller_basename, string $connector_id ): bool {
		if ( class_exists( 'WordPress\\AI\\Connector_Approval\\Approvals_Store' ) ) {
			try {
				$store = new \WordPress\AI\Connector_Approval\Approvals_Store();
				return $store->is_approved( $caller_basename, $connector_id );
			} catch ( \Throwable $e ) {
				// Fallback to manual check.
				unset( $e );
			}
		}

		// Manual check fallback.
		$approvals = get_option( 'wpai_connector_approvals', [] );
		if ( ! is_array( $approvals ) ) {
			return false;
		}

		// Check exact match.
		if ( ! empty( $approvals[ $caller_basename ][ $connector_id ] ) ) {
			return true;
		}

		// Check bare slug match (e.g. if stored as 'ai' instead of 'ai/ai.php').
		$slug = dirname( $caller_basename );
		if ( '.' !== $slug && '' !== $slug && ! empty( $approvals[ $slug ][ $connector_id ] ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Get the plugin basename for a connector ID.
	 */
	private function get_connector_plugin_basename( string $connector_id ): string {
		$connectors = [];
		if ( function_exists( 'WordPress\\AI\\get_ai_connectors' ) ) {
			$connectors = \WordPress\AI\get_ai_connectors( false );
		} elseif ( function_exists( 'wp_get_connectors' ) ) {
			$connectors = wp_get_connectors();
		}

		if ( is_array( $connectors ) && isset( $connectors[ $connector_id ] ) ) {
			$connector_data = $connectors[ $connector_id ];
			if ( isset( $connector_data['plugin'] ) && is_array( $connector_data['plugin'] ) ) {
				$plugin_data = $connector_data['plugin'];
				if ( ! empty( $plugin_data['file'] ) && is_string( $plugin_data['file'] ) ) {
					return $plugin_data['file'];
				}
				if ( ! empty( $plugin_data['plugin_file'] ) && is_string( $plugin_data['plugin_file'] ) ) {
					return $plugin_data['plugin_file'];
				}
				if ( ! empty( $plugin_data['pluginFile'] ) && is_string( $plugin_data['pluginFile'] ) ) {
					return $plugin_data['pluginFile'];
				}
			}
		}

		// Fallbacks for known providers if metadata is missing.
		$known_fallbacks = [
			'anthropic' => 'connectors-ai-anthropic/connectors-ai-anthropic.php',
			'openai'    => 'connectors-ai-openai/connectors-ai-openai.php',
			'google'    => 'connectors-ai-google/connectors-ai-google.php',
		];

		return $known_fallbacks[ $connector_id ] ?? '';
	}

	/**
	 * Map function/tool names in message parts between hyphens and underscores for compatibility.
	 *
	 * @param mixed  $message The message object.
	 * @param string $from    Character to map from ('-' or '_').
	 *
	 * Mixed $message: an optional AI-SDK message object whose class may be unavailable; the is_object + method_exists guard skips anything without getParts().
	 */
	private function map_message_function_names( mixed $message, string $from ): void {
		if ( ! is_object( $message ) || ! method_exists( $message, 'getParts' ) ) {
			return;
		}

		$mapping = [];
		foreach ( self::CHAT_ABILITY_LIST as $ability_name ) {
			$function_name = $this->ability_name_to_function_name( $ability_name );

			if ( '-' === $from ) {
				$key = $function_name;
				$val = str_replace( '-', '_', $function_name );
			} else {
				$key = str_replace( '-', '_', $function_name );
				$val = $function_name;
			}

			$mapping[ $key ] = $val;
		}

		foreach ( $message->getParts() as $part ) {
			if ( ! is_object( $part ) || ! method_exists( $part, 'getType' ) ) {
				continue;
			}

			if ( $part->getType()->isFunctionCall() && method_exists( $part, 'getFunctionCall' ) ) {
				$call = $part->getFunctionCall();
				if ( is_object( $call ) && method_exists( $call, 'getName' ) ) {
					$name = $call->getName();
					if ( isset( $mapping[ $name ] ) ) {
						try {
							$ref = new \ReflectionProperty( get_class( $call ), 'name' );
							$ref->setAccessible( true );
							$ref->setValue( $call, $mapping[ $name ] );
						} catch ( \Throwable $e ) {
							// Fallback.
							unset( $e );
						}
					}
				}
			} elseif ( $part->getType()->isFunctionResponse() && method_exists( $part, 'getFunctionResponse' ) ) {
				$response = $part->getFunctionResponse();
				if ( is_object( $response ) && method_exists( $response, 'getName' ) ) {
					$name = $response->getName();
					if ( isset( $mapping[ $name ] ) ) {
						try {
							$ref = new \ReflectionProperty( get_class( $response ), 'name' );
							$ref->setAccessible( true );
							$ref->setValue( $response, $mapping[ $name ] );
						} catch ( \Throwable $e ) {
							// Fallback.
							unset( $e );
						}
					}
				}
			}
		}
	}

	/**
	 * Record a chat question for telemetry/data sharing.
	 *
	 * @param string    $message  The user prompt.
	 * @param string    $model    The model name.
	 * @param bool|null $answered Whether the query was answered.
	 */
	private function record_chat_question( string $message, string $model, ?bool $answered = null ): void {
		if ( ! (bool) burst_get_option( 'anonymous_usage_data', false ) ) {
			return;
		}

		$questions = get_option( 'burst_ai_chat_questions', [] );
		if ( ! is_array( $questions ) ) {
			$questions = [];
		}

		$questions[] = [
			'text'      => $message,
			'timestamp' => time(),
			'model'     => $model,
			'answered'  => $answered,
		];

		// Defensively cap the history stored in options to prevent DB bloat.
		if ( count( $questions ) > 500 ) {
			$questions = array_slice( $questions, -500 );
		}

		update_option( 'burst_ai_chat_questions', $questions, false );
	}

	/**
	 * Delete chat question history if anonymous usage data is disabled.
	 *
	 * Mixed fallback is allowed because if the option does not exist yet
	 * or fails to load, WordPress may pass a boolean false instead of an array.
	 *
	 * @param array<string, mixed>|mixed $old_value Old settings option value.
	 * @param array<string, mixed>|mixed $value     New settings option value.
	 */
	public function on_update_options_settings( mixed $old_value, mixed $value ): void {
		if ( ! is_array( $value ) ) {
			return;
		}

		$enabled = isset( $value['anonymous_usage_data'] ) && (bool) $value['anonymous_usage_data'];
		if ( ! $enabled ) {
			delete_option( 'burst_ai_chat_questions' );
		}
	}
}
