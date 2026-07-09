<?php

namespace Burst\Admin\Share\Services;

use Burst\Admin\Reports\Report;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;
use Burst\Admin\Share\Share;

class Share_Routing {
	use Admin_Helper;
	use Save;
	use Sanitize;

	public Share $share;

	/**
	 * Constructor.
	 *
	 * @param Share $share The main Share class instance.
	 */
	public function __construct( Share $share ) {
		$this->share = $share;
	}

	/**
	 * Resource mapping for report blocks.
	 * Maps block IDs to allowed endpoints, tabs, or datatable IDs.
	 *
	 * @var array<string, array<string, string[]>>
	 */
	private const BLOCK_RESOURCE_MAP = [
		'insights'           => [ 'endpoints' => [ 'data/insights' ] ],
		'compare_story'      => [ 'endpoints' => [ 'data/compare' ] ],
		'compare'            => [ 'endpoints' => [ 'data/compare' ] ],
		'devices'            => [ 'endpoints' => [ 'data/devicesTitleAndValue', 'data/devicesSubtitle' ] ],
		'world'              => [ 'endpoints' => [ 'data/geo' ] ],
		'pages'              => [ 'datatable_ids' => [ 'statistics_pages' ] ],
		'referrers'          => [ 'datatable_ids' => [ 'statistics_referrers', 'sources_referrers' ] ],
		'locations'          => [ 'datatable_ids' => [ 'sources_countries' ] ],
		'campaigns'          => [ 'datatable_ids' => [ 'sources_campaigns' ] ],
		'sales'              => [ 'endpoints' => [ 'data/ecommerce/sales' ] ],
		'top_performers'     => [ 'endpoints' => [ 'data/ecommerce/top-performers' ] ],
		'funnel'             => [ 'endpoints' => [ 'data/ecommerce/sales-funnel' ] ],
		'most_visited_pages' => [ 'datatable_ids' => [ 'statistics_pages' ] ],
		'top_referrers'      => [ 'datatable_ids' => [ 'statistics_referrers' ] ],
		'top_campaigns'      => [ 'datatable_ids' => [ 'sources_campaigns' ] ],
	];

	/**
	 * Get the endpoint-to-tab map.
	 *
	 * Returns the base (free-tier) mapping and applies the
	 * 'burst_endpoint_tab_map' filter so Pro can append its own entries.
	 *
	 * @return array<string, string> Endpoint path => tab slug.
	 */
	public function get_endpoint_tab_map(): array {
		$map = [
			// Statistics / Insights tab (shareable).
			'data/insights'                => 'statistics',
			'data/compare'                 => 'statistics',
			'data/devicesTitleAndValue'    => 'statistics',
			'data/devicesSubtitle'         => 'statistics',
			'data/goals'                   => 'statistics',
			'data/reading_engagement'      => 'engagement',

			// Sources tab — the world map (country data) is free.
			'data/geo'                     => 'sources',

			// Dashboard tab (NOT shareable).
			'data/live-goals'              => 'dashboard',
			'data/live-traffic'            => 'dashboard',
			'data/live-visitors'           => 'dashboard',
			'data/today'                   => 'dashboard',
			'get_action/otherpluginsdata'  => 'dashboard',
			'get_action/tracking'          => 'dashboard',
			'get_action/get_article_data'  => 'dashboard',
			'get_action/tasks'             => 'dashboard',
			'do_action/fix_task'           => 'dashboard',
			'do_action/dismiss_task'       => 'dashboard',
			'do_action/plugin_actions'     => 'dashboard',

			'get_action/story-report-data' => 'story',
		];

		/**
		 * Filter the endpoint-to-tab map.
		 *
		 * Pro modules use this filter to register their own endpoint-to-tab
		 * mappings (sources, sales, settings, etc.).
		 *
		 * @param array<string, string> $map Endpoint path => tab slug.
		 */
		return apply_filters( 'burst_endpoint_tab_map', $map );
	}

	/**
	 * Get the datatable-ID-to-tab map.
	 *
	 * Since `data/datatable` and `data/ecommerce/datatable` are generic endpoints,
	 * we use the datatable `id` query parameter to resolve which tab the request
	 * belongs to. The base map contains free-tier IDs; Pro appends its own via
	 * the 'burst_datatable_id_tab_map' filter.
	 *
	 * @return array<string, string> Datatable ID => tab slug.
	 */
	public function get_datatable_id_tab_map(): array {
		$map = [
			'statistics_pages'      => 'statistics',
			'statistics_referrers'  => 'statistics',
			'statistics_parameters' => 'statistics',
			// Locations (country) datatable is free.
			'sources_countries'     => 'sources',
		];

		/**
		 * Filter the datatable-ID-to-tab map.
		 *
		 * Pro modules use this filter to register their own datatable IDs
		 * (sources, sales).
		 *
		 * @param array<string, string> $map Datatable ID => tab slug.
		 */
		return apply_filters( 'burst_datatable_id_tab_map', $map );
	}

	/**
	 * Resolve the tab for the current REST endpoint path.
	 *
	 * For `data/datatable` and `data/ecommerce/datatable` endpoints, uses the
	 * `id` query parameter to look up the datatable-ID-to-tab map.
	 * For all other endpoints, uses the endpoint-to-tab map.
	 *
	 * @param string $endpoint_path The relative endpoint path (e.g. 'data/insights').
	 * @return string|null The tab slug, or null if not mapped.
	 */
	public function resolve_endpoint_tab( string $endpoint_path ): ?string {
		// Check if this is a datatable endpoint.
		if ( 'data/datatable' === $endpoint_path || 'data/ecommerce/datatable' === $endpoint_path ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reading the id param for access control mapping.
			$datatable_id = isset( $_GET['id'] ) ? sanitize_text_field( wp_unslash( $_GET['id'] ) ) : '';
			if ( empty( $datatable_id ) ) {
				return null;
			}

			$datatable_map = self::get_datatable_id_tab_map();
			return $datatable_map[ $datatable_id ] ?? null;
		}

		// Handle per-datatable endpoints: data/datatable/{id} and data/ecommerce/datatable/{id}.
		$datatable_id = '';
		if ( str_starts_with( $endpoint_path, 'data/ecommerce/datatable/' ) ) {
			$datatable_id = substr( $endpoint_path, 25 );
		} elseif ( str_starts_with( $endpoint_path, 'data/datatable/' ) ) {
			$datatable_id = substr( $endpoint_path, 15 );
		}

		if ( ! empty( $datatable_id ) ) {
			$datatable_map = self::get_datatable_id_tab_map();
			if ( isset( $datatable_map[ $datatable_id ] ) ) {
				return $datatable_map[ $datatable_id ];
			}
		}

		$endpoint_map = self::get_endpoint_tab_map();
		return $endpoint_map[ $endpoint_path ] ?? null;
	}

	/**
	 * Extract the Burst REST endpoint path from the current request.
	 *
	 * For real REST API requests (`/wp-json/burst/v1/...`), the endpoint must be
	 * resolved from REQUEST_URI so auth and execution use the same route.
	 *
	 * For AJAX fallback requests, the endpoint can be resolved from `rest_action`
	 * or request payload fields.
	 *
	 * @return string The relative endpoint path (e.g. 'data/insights'), or empty string if not a Burst REST request.
	 */
	public function get_current_rest_endpoint_path(): string {
		// Standard REST API: always parse REQUEST_URI first.
		if ( ! isset( $_SERVER['REQUEST_URI'] ) ) {
			$path = '';
		} else {
			$request_uri = esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) );
			$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
			if ( ! is_string( $path ) ) {
				$path = '';
			}
		}

		// Regex: `#burst/v1/(.+?)$#` extracts the path after `burst/v1/` to end-of-string (no query string here).
		// Example: `/wp-json/burst/v1/data/insights` -> `data/insights`.
		if ( preg_match( '#burst/v1/(.+?)$#', $path, $matches ) ) {
			return trim( $matches[1], '/' );
		}

		// Try AJAX fallback first: rest_action query param.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['rest_action'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$rest_action = sanitize_text_field( wp_unslash( $_GET['rest_action'] ) );
			// Regex: `#burst/v1/(.+?)(?:\\?|$)#` extracts the path after `burst/v1/` up to `?` or end-of-string.
			// Example: `...rest_action=/wp-json/burst/v1/data/insights?foo=1` -> `data/insights`.
			if ( preg_match( '#burst/v1/(.+?)(?:\?|$)#', $rest_action, $matches ) ) {
				return trim( $matches[1], '/' );
			}
		}

		// Try AJAX fallback: POST body path.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( isset( $_POST['path'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$post_path = sanitize_text_field( wp_unslash( $_POST['path'] ) );
			// Regex: `#burst/v1/(.+?)(?:\\?|$)#` extracts the path after `burst/v1/` up to `?` or end-of-string.
			// Example: `/wp-json/burst/v1/data/datatable?id=foo` -> `data/datatable`.
			if ( preg_match( '#burst/v1/(.+?)(?:\?|$)#', $post_path, $matches ) ) {
				return trim( $matches[1], '/' );
			}
		} else {
			// Handle JSON payloads for AJAX fallback.
			$input = file_get_contents( 'php://input' );
			if ( ! empty( $input ) ) {
				$json = json_decode( $input, true );
				if ( is_array( $json ) && isset( $json['path'] ) ) {
					$post_path = sanitize_text_field( wp_unslash( $json['path'] ) );
					// Regex: `#burst/v1/(.+?)(?:\\?|$)#` extracts the path after `burst/v1/` up to `?` or end-of-string.
					// Example: `{ "path": "/wp-json/burst/v1/goals/get?goal_id=1" }` -> `goals/get`.
					if ( preg_match( '#burst/v1/(.+?)(?:\?|$)#', $post_path, $matches ) ) {
						return trim( $matches[1], '/' );
					}
				}
			}
		}

		return '';
	}

	/**
	 * Add custom query var.
	 *
	 * @param array $vars Query vars.
	 * @return array Modified query vars.
	 */
	public function add_query_vars( array $vars ): array {
		$vars[] = 'burst_share_page';
		$vars[] = 'burst_share_path';
		$vars[] = 'burst_share_token';
		return $vars;
	}

	/**
	 * Add custom rewrite rule for /burst/dashboard.
	 */
	public function add_rewrite_rules(): void {
		add_rewrite_rule(
			'^burst-dashboard(?:/([^/]+))?/?$',
			'index.php?burst_share_page=1&burst_share_path=$matches[1]',
			'top'
		);
	}

	/**
	 * Flush rewrite rules if the transient is set.
	 */
	public function maybe_flush_rewrite_rules(): void {
		if ( get_transient( 'burst_flush_rewrite_rules' ) ) {
			flush_rewrite_rules();
			delete_transient( 'burst_flush_rewrite_rules' );
		}
	}

	/**
	 * Resolve the currently accessed shared-dashboard tab from the request.
	 *
	 * For direct shared-page loads we can read the routed path. For API requests
	 * triggered from the shared dashboard, fall back to the referrer path.
	 *
	 * @return string The requested tab slug, or an empty string when unknown.
	 */
	public function get_current_shared_request_tab(): string {
		// We can't use get_query_var function in this as, this function is called in user_can_view_sales which is getting called before global $wp_query is defined, and get_query_var relies on $wp_query.
		$request_target = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

		if ( empty( $request_target ) || ! is_string( $request_target ) ) {
			return '';
		}

		$path = wp_parse_url( $request_target, PHP_URL_PATH );
		if ( ! is_string( $path ) ) {
			$path = $request_target;
		}

		// Regex: `#/burst-dashboard/([^/]+)/?$#` captures a single path segment after `/burst-dashboard/`.
		// Example: `/burst-dashboard/statistics/` -> `statistics` (rejects `/burst-dashboard/statistics/foo/`).
		if ( preg_match( '#/burst-dashboard/([^/]+)/?$#', $path, $matches ) ) {
			return $this->share->sanitize_tab( $matches[1] );
		}

		return '';
	}

	/**
	 * Check whether the currently accessed shared-dashboard tab is allowed for
	 * the active share token.
	 *
	 * For REST API requests, resolves the tab from the actual endpoint path
	 * using the endpoint-to-tab map (not spoofable).
	 * For non-API requests (initial page loads), uses the routed path.
	 *
	 * Implements deny-by-default: unmapped endpoints are denied for shared viewers.
	 *
	 * @return bool True when the current shared request is allowed.
	 */
	public function current_shared_request_tab_is_allowed(): bool {
		$share_link = $this->share->tokens->get_current_share_link_data();
		if ( empty( $share_link ) ) {
			return false;
		}

		$report_id = (int) ( $share_link['report_id'] ?? 0 );

		// For REST API / AJAX requests, resolve the tab from the endpoint path.
		$endpoint_path = $this->get_current_rest_endpoint_path();
		if ( ! empty( $endpoint_path ) ) {
			// Report-based share links allow 'story' endpoints, and any endpoints mapped to shareable tabs.
			if ( $report_id > 0 ) {
				return $this->is_story_request_allowed( $report_id, $endpoint_path );
			}

			// Special case: Filter-dependent endpoints are only allowed if the share link has the can_filter permission.
			$filter_dependent_endpoints = [ 'get_action/get_filter_options', 'goals/get', 'posts', 'posts/' ];
			if ( in_array( $endpoint_path, $filter_dependent_endpoints, true ) ) {
				$permissions = $this->share->tokens->get_current_share_link_permissions();
				return ! empty( $permissions['can_filter'] );
			}

			// Resolve the tab from the endpoint path or datatable ID.
			$resolved_tab = self::resolve_endpoint_tab( $endpoint_path );

			// Deny-by-default: if the endpoint is not mapped, deny access.
			if ( null === $resolved_tab ) {
				return false;
			}

			if ( 'all' === $resolved_tab ) {
				return true;
			}

			return $this->is_tab_shared( $resolved_tab );
		}

		// Non-API requests (initial page loads): use the routed path.
		$requested_tab = $this->get_current_shared_request_tab();
		if ( empty( $requested_tab ) ) {
			return false;
		}

		if ( $report_id > 0 ) {
			return 'story' === $requested_tab;
		}

		return $this->is_tab_shared( $requested_tab );
	}

	/**
	 * Check if a specific tab is shared for the current share token.
	 *
	 * @param string $tab The tab to check.
	 * @return bool True if the tab is in the shared tabs, false otherwise.
	 */
	public function is_tab_shared( string $tab ): bool {
		$share_link = $this->share->tokens->get_current_share_link_data();
		if ( empty( $share_link ) ) {
			return false;
		}

		$shared_tabs = $share_link['shared_tabs'] ?? [];

		return in_array( $tab, $shared_tabs, true );
	}


	/**
	 * Filter wrapper for `burst_get_data_request_args` so enforced dates/filters
	 * land in $args before raw-SQL callers (sales, quick-wins, funnel) read them.
	 *
	 * @param array            $args    Request arguments.
	 * @param string           $type    Data type (unused).
	 * @param \WP_REST_Request $request REST request (unused).
	 */
	public function apply_share_link_restrictions_filter( array $args, string $type, \WP_REST_Request $request ): array {
		unset( $type, $request );
		return $this->apply_share_link_restrictions( $args );
	}

	/**
	 * Apply share-link restrictions to request arguments.
	 * If the current request is from a shared viewer with restricted permissions,
	 * override date_start, date_end, and filters with values from the share token's initial_state.
	 *
	 * @param array $args The request arguments (date_start, date_end, filters, etc.).
	 * @return array Modified arguments with share-link restrictions applied.
	 */
	public function apply_share_link_restrictions( array $args ): array {
		// Only enforce restrictions if the current user is a shared link viewer.
		// This prevents admins who happen to have a share token from being restricted.
		if ( ! self::is_shareable_link_viewer() ) {
			return $args;
		}

		$token = $this->share->tokens->get_current_token();

		if ( empty( $token ) ) {
			return $args;
		}

		$share_links = $this->share->tokens->get_share_links( 'all', $token );

		if ( empty( $share_links ) ) {
			return $args;
		}

		// Only one result when token is specified.
		$share_link  = $share_links[0];
		$permissions = $this->share->tokens->get_current_share_link_permissions();

		$report_id = (int) ( $share_link['report_id'] ?? 0 );
		if ( $report_id > 0 ) {
			// Story Mode restrictions: Apply block-specific filters and dates.
			$endpoint_path = $this->get_current_rest_endpoint_path();
			if ( empty( $endpoint_path ) ) {
				return $args;
			}

			$report = new Report( $report_id );
			if ( empty( $report->id ) ) {
				return $args;
			}

			// Derive datatable_id from endpoint path if possible.
			$datatable_id = '';
			if ( str_starts_with( $endpoint_path, 'data/ecommerce/datatable/' ) ) {
				$datatable_id = substr( $endpoint_path, 25 );
			} elseif ( str_starts_with( $endpoint_path, 'data/datatable/' ) ) {
				$datatable_id = substr( $endpoint_path, 15 );
			}

			// If it's not a per-datatable endpoint, fall back to $_GET['id'] for legacy support.
			if ( empty( $datatable_id ) || 'datatable' === $datatable_id ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended
				$datatable_id = isset( $_GET['id'] ) ? sanitize_text_field( wp_unslash( $_GET['id'] ) ) : '';
			}

			foreach ( $report->content as $block ) {
				if ( $this->is_block_match( $block, $endpoint_path, $datatable_id ) ) {
					// Force the block's filters into the arguments.
					if ( isset( $block['filters'] ) ) {
						$args['filters'] = $block['filters'];
					}
					return $args;
				}
			}

			return $args;
		}

		$initial_state = $share_link['initial_state'] ?? [];

		// If can_change_date is false, enforce the stored date_range from initial_state.
		if ( ! ( $permissions['can_change_date'] ?? false ) ) {
			if ( ! empty( $initial_state['date_range']['start'] ) ) {
				// Use the normalize_date method from Sanitize trait.
				$args['date_start'] = $this->normalize_date( $initial_state['date_range']['start'] . ' 00:00:00' );
			}
			if ( ! empty( $initial_state['date_range']['end'] ) ) {
				$args['date_end'] = $this->normalize_date( $initial_state['date_range']['end'] . ' 23:59:59' );
			}
		}

		// If can_filter is false, enforce the stored filters from initial_state.
		if ( ! ( $permissions['can_filter'] ?? false ) ) {
			if ( isset( $initial_state['filters'] ) && is_array( $initial_state['filters'] ) ) {
				$args['filters'] = $initial_state['filters'];
			}
		}

		return $args;
	}

	/**
	 * Verify if a Story mode request is allowed based on report content and permissions.
	 *
	 * @param int    $report_id     The ID of the report.
	 * @param string $endpoint_path The requested API endpoint path.
	 * @return bool True if allowed, false otherwise.
	 */
	private function is_story_request_allowed( int $report_id, string $endpoint_path ): bool {
		$resolved_tab = $this->resolve_endpoint_tab( $endpoint_path );
		if ( 'all' === $resolved_tab || 'story' === $resolved_tab ) {
			return true;
		}

		// Get the report to check its content.
		$report = new Report( $report_id );
		if ( empty( $report->id ) ) {
			return false;
		}

		// Derive datatable_id from endpoint path if possible.
		$datatable_id = '';
		if ( str_starts_with( $endpoint_path, 'data/ecommerce/datatable/' ) ) {
			$datatable_id = substr( $endpoint_path, 25 );
		} elseif ( str_starts_with( $endpoint_path, 'data/datatable/' ) ) {
			$datatable_id = substr( $endpoint_path, 15 );
		}

		// If it's not a per-datatable endpoint, fall back to $_GET['id'] for legacy support.
		if ( empty( $datatable_id ) || 'datatable' === $datatable_id ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$datatable_id = isset( $_GET['id'] ) ? sanitize_text_field( wp_unslash( $_GET['id'] ) ) : '';
		}

		foreach ( $report->content as $block ) {
			// Allow filter options if the block has filters applied.
			if ( 'get_action/get_filter_options' === $endpoint_path && ! empty( $block['filters'] ) ) {
				return true;
			}

			if ( $this->is_block_match( $block, $endpoint_path, $datatable_id ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if a report block matches the current request resource.
	 *
	 * @param array  $block         The block configuration.
	 * @param string $endpoint_path The requested API endpoint path.
	 * @param string $datatable_id  The requested datatable ID.
	 * @return bool True if it matches, false otherwise.
	 */
	private function is_block_match( array $block, string $endpoint_path, string $datatable_id ): bool {
		$block_id = $block['id'] ?? '';

		if ( ! isset( self::BLOCK_RESOURCE_MAP[ $block_id ] ) ) {
			return false;
		}

		$resources = self::BLOCK_RESOURCE_MAP[ $block_id ];

		if ( isset( $resources['endpoints'] ) && in_array( $endpoint_path, $resources['endpoints'], true ) ) {
			return true;
		}

		if ( ! empty( $datatable_id ) && isset( $resources['datatable_ids'] ) && in_array( $datatable_id, $resources['datatable_ids'], true ) ) {
			return true;
		}

		return false;
	}
}
