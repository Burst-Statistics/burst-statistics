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

	private const ENABLE_OPTION = 'enable_abilities_api';
	private const CATEGORY_SLUG = 'burst-statistics';

	/**
	 * Initialize Abilities API integration.
	 */
	public function init(): void {
		if ( function_exists( 'wp_register_ability' ) && (bool) burst_get_option( self::ENABLE_OPTION, false ) ) {
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
					'type'                 => [ 'object', 'null' ],
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
					'type'                 => [ 'object', 'null' ],
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
				'description'         => __( 'Returns analytics data: pages overview with insights or datatable data.', 'burst-statistics' ),
				'category'            => self::CATEGORY_SLUG,
				'input_schema'        => [
					'type'                 => [ 'object', 'null' ],
					'additionalProperties' => false,
					'properties'           => [
						'type'       => [
							'type' => 'string',
							'enum' => [ 'insights', 'datatable' ],
						],
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
							'description' => 'Metrics to retrieve (e.g., pageviews, visitors)',
						],
						'filters'    => [
							'type'        => 'array',
							'items'       => [ 'type' => 'object' ],
							'description' => 'Filter objects for data retrieval',
						],
						'group_by'   => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for datatable results',
						],
						'limit'      => [
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
					'type'                 => [ 'object', 'null' ],
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
						'group_by'   => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for sales results',
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
					'type'                 => [ 'object', 'null' ],
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
						'group_by'   => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Grouping columns for subscription results',
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
	 */
	public function permission_callback( mixed $input = null ): bool|\WP_Error {
		unset( $input );

		if ( $this->user_can_view() ) {
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
	 */
	public function ability_data( mixed $input ): array|\WP_Error {
		$rate_limit = $this->enforce_rate_limit( 'data' );
		if ( is_wp_error( $rate_limit ) ) {
			return $rate_limit;
		}

		$input = is_array( $input ) ? $input : [];

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

		$date_start = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end   = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$metrics    = isset( $input['metrics'] ) ? (array) $input['metrics'] : [ 'pageviews' ];
		$filters    = isset( $input['filters'] ) ? (array) $input['filters'] : [];
		$group_by   = isset( $input['group_by'] ) ? (array) $input['group_by'] : [ 'page_url' ];
		$group_by   = $this->normalize_group_by( $group_by );
		$limit      = isset( $input['limit'] ) ? absint( $input['limit'] ) : 0;

		try {
			if ( 'insights' === $type ) {
				$data = $admin->statistics->get_insights_data(
					[
						'date_start' => $date_start,
						'date_end'   => $date_end,
						'metrics'    => $metrics,
					]
				);

				return $this->format_agent_insights_response( $data, $metrics );
			} elseif ( 'datatable' === $type ) {
				$data = $admin->statistics->get_datatables_data(
					[
						'date_start' => $date_start,
						'date_end'   => $date_end,
						'metrics'    => $metrics,
						'filters'    => $filters,
						'group_by'   => $group_by,
						'limit'      => $limit,
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

		$date_start = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end   = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$metrics    = isset( $input['metrics'] ) ? (array) $input['metrics'] : [ 'revenue' ];
		$group_by   = isset( $input['group_by'] ) ? (array) $input['group_by'] : [ 'source' ];
		$group_by   = $this->normalize_group_by( $group_by );

		try {
			// Use the datatables method with ecommerce filter for sales data.
			$data = $admin->statistics->get_datatables_data(
				[
					'date_start' => $date_start,
					'date_end'   => $date_end,
					'metrics'    => $metrics,
					'filters'    => [
						[
							'key'   => 'type',
							'value' => 'purchase',
						],
					],
					'group_by'   => $group_by,
					'limit'      => 100,
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

		$date_start = isset( $input['date_start'] ) ? absint( $input['date_start'] ) : 0;
		$date_end   = isset( $input['date_end'] ) ? absint( $input['date_end'] ) : 0;
		$metrics    = isset( $input['metrics'] ) ? (array) $input['metrics'] : [ 'revenue' ];
		$group_by   = isset( $input['group_by'] ) ? (array) $input['group_by'] : [ 'source' ];
		$group_by   = $this->normalize_group_by( $group_by );

		try {
			// Use the datatables method with ecommerce filter for subscription data.
			$data = $admin->statistics->get_datatables_data(
				[
					'date_start' => $date_start,
					'date_end'   => $date_end,
					'metrics'    => $metrics,
					'filters'    => [
						[
							'key'   => 'type',
							'value' => 'subscription',
						],
					],
					'group_by'   => $group_by,
					'limit'      => 100,
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

		return [
			'type'       => 'datatable',
			'dimensions' => $dimensions,
			'metrics'    => $metric_defs,
			'rows'       => is_array( $data['data'] ?? null ) ? $data['data'] : [],
			'row_count'  => is_array( $data['data'] ?? null ) ? count( $data['data'] ) : 0,
		];
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
			'type'                 => [ 'object', 'null' ],
			'additionalProperties' => false,
			'properties'           => [],
		];
	}
}
