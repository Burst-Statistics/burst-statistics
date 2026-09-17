<?php
/**
 * Plugin Name: Burst REST API Optimizer
 * Plugin URI: https://burst-statistics.com
 * Description: Must-use plugin installed by Burst Pro to keep the Burst REST API fast by skipping unrelated plugins on Burst REST requests.
 * Version: 1.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.0
 * Author: Burst Statistics
 * Author URI: https://burst-statistics.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

defined( 'ABSPATH' ) || die();

defined( 'BURST_REST_API_OPTIMIZER' ) || define( 'BURST_REST_API_OPTIMIZER', true );

if ( ! function_exists( '\Burst\burst_exclude_plugins_for_rest_api' ) && ! function_exists( 'burst_exclude_plugins_for_rest_api' ) ) {
	/**
	 * Largest request body (bytes) the optimizer inspects for the
	 * should_load_ecommerce flag. A larger body is never buffered here; the
	 * optimizer then keeps every plugin so the request still works, only
	 * without the fast path. The REST handler always receives the full body.
	 */
	define( 'BURST_REST_API_OPTIMIZER_BODY_LIMIT', 65536 );

	/**
	 * Whether the request declares a body larger than the inspection budget.
	 */
	function burst_rest_api_optimizer_declares_oversized_body(): bool {
		if ( ! isset( $_SERVER['CONTENT_LENGTH'] ) ) {
			return false;
		}
		$declared = sanitize_text_field( wp_unslash( $_SERVER['CONTENT_LENGTH'] ) );
		if ( preg_match( '/^[0-9]+$/D', $declared ) !== 1 ) {
			return false;
		}
		// Float comparison avoids integer overflow on absurd declared lengths.
		return (float) $declared > BURST_REST_API_OPTIMIZER_BODY_LIMIT;
	}

	/**
	 * Read at most $limit bytes of the raw request body.
	 *
	 * Reads one byte past the limit as a sentinel, so an undeclared oversized
	 * body is detected without buffering or decoding all of it. Returns null
	 * when the body cannot be read or exceeds the limit, which lets the caller
	 * tell an empty body ('') apart from an undeterminable one (null).
	 */
	function burst_rest_api_optimizer_read_request_body( int $limit ): ?string {
		/**
		 * Short-circuit the raw request-body read.
		 *
		 * Return a string to use it as the body, or false to simulate a failed
		 * read. Used by the test suite, since php://input cannot be populated
		 * from PHPUnit.
		 *
		 * @param string|false|null $raw   Null to read php://input.
		 * @param int               $limit Inspection budget in bytes.
		 */
		$raw = apply_filters( 'burst_rest_api_optimizer_pre_request_body', null, $limit );
		if ( null === $raw ) {
			$raw = file_get_contents( 'php://input', false, null, 0, $limit + 1 );
		}
		if ( ! is_string( $raw ) || strlen( $raw ) > $limit ) {
			return null;
		}
		return $raw;
	}

	/**
	 * Resolve the should_load_ecommerce flag once for this request.
	 *
	 * Query string and form data win; otherwise a bounded JSON body read
	 * decides. Returns null when the body is too large or unreadable, meaning
	 * the flag cannot be determined safely.
	 */
	function burst_rest_api_optimizer_should_load_ecommerce(): ?bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only a plugin-loading flag is inspected.
		if ( isset( $_REQUEST['should_load_ecommerce'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only a plugin-loading flag is inspected.
			return (bool) filter_var( wp_unslash( $_REQUEST['should_load_ecommerce'] ), FILTER_VALIDATE_BOOL );
		}

		$raw = burst_rest_api_optimizer_read_request_body( BURST_REST_API_OPTIMIZER_BODY_LIMIT );
		if ( null === $raw ) {
			return null;
		}
		if ( '' === $raw ) {
			return false;
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return false;
		}
		// Both a top-level flag and the { path, data: { ... } } wrapper are supported.
		$flag = $data['data']['should_load_ecommerce'] ?? $data['should_load_ecommerce'] ?? false;
		return (bool) filter_var( $flag, FILTER_VALIDATE_BOOL );
	}

	/**
	 * Keep active_plugins writes complete while the optimizer filters reads.
	 *
	 * Core's update_option() reads its $old_value through option_active_plugins, so a
	 * caller that derives the new list from that read (activate_plugin(),
	 * deactivate_plugins()) would persist the filtered subset and silently
	 * deactivate every plugin the optimizer skipped. Re-apply the caller's
	 * delta (added and removed plugins) to the unfiltered list instead.
	 *
	 * @param mixed $value     The list the caller wants to persist.
	 * @param mixed $old_value The old value as seen by update_option(), possibly filtered.
	 * @return mixed The list to persist.
	 */
	function burst_rest_api_optimizer_merge_active_plugins_write( mixed $value, mixed $old_value ): mixed {
		if ( ! is_array( $value ) || ! is_array( $old_value ) || $value === $old_value ) {
			return $value;
		}

		remove_filter( 'option_active_plugins', 'burst_exclude_plugins_for_rest_api' );
		$unfiltered = get_option( 'active_plugins', [] );
		add_filter( 'option_active_plugins', 'burst_exclude_plugins_for_rest_api' );

		if ( ! is_array( $unfiltered ) || $unfiltered === $old_value ) {
			// The optimizer did not filter this request; nothing to restore.
			return $value;
		}

		$removed = array_diff( $old_value, $value );
		$added   = array_diff( $value, $old_value );
		$merged  = array_values( array_unique( array_merge( array_diff( $unfiltered, $removed ), $added ) ) );
		sort( $merged );
		return $merged;
	}

	/**
	 * Exclude all other plugins from the active plugins list if this is a Burst rest request
	 *
	 * @param array<int, string> $plugins List of plugin paths relative to the plugins directory.
	 * @return array<int, string> Filtered list of plugin paths.
	 */
	function burst_exclude_plugins_for_rest_api( array $plugins ): array {
		// Get sanitized and unslashed REQUEST_URI.
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		// don't optimize for admin-ajax requests, so if a security plugin breaks the optimizer, it has a fallback.
		if ( strpos( $request_uri, 'admin-ajax.php' ) !== false ) {
			return $plugins;
		}

		// Resolve the actual REST route from the URL path only (pretty permalinks).
		// Anything in the query string is ignored, so ?x=burst/v1 or ?rest_route=/burst/v1
		// on an unrelated URL cannot trigger the optimizer. Plain (non-pretty) permalinks
		// are intentionally not supported here; the optimizer simply no-ops on those sites.
		// The path is matched as-is (not URL-decoded) so detection stays in sync with WP's
		// own REST routing, which also matches against the raw URI.
		$parsed = wp_parse_url( $request_uri );
		$path   = isset( $parsed['path'] ) ? $parsed['path'] : '';

		// Hardcoded WP REST prefix. We can't call rest_get_url_prefix() because rest-api.php
		// is loaded later than option_active_plugins, and invoking the core rest_url_prefix
		// filter ourselves wouldn't pick up callbacks registered by regular plugins anyway
		// (those haven't loaded yet). Sites with a custom REST prefix simply no-op here.
		$burst_rest_route = '';
		$needle           = '/wp-json/';
		$pos              = strpos( $path, $needle );
		if ( $pos !== false ) {
			$burst_rest_route = ltrim( substr( $path, $pos + strlen( $needle ) ), '/' );
		}

		// Anchored at the namespace boundary: only burst/v1 and burst/v1/* qualify,
		// not lookalikes such as burst/v1foo/...
		if ( $burst_rest_route !== 'burst/v1' && ! str_starts_with( $burst_rest_route, 'burst/v1/' ) ) {
			return $plugins;
		}

		/**
		 * Allow filtering of plugins that should remain active during REST API loading of BURST.
		 *
		 * @param array{
		 *     partial_match?: string[],
		 *     exact_match?: string[],
		 * } $plugins_to_keep Plugins grouped by matching strategy.
		 */
		$plugins_to_keep = apply_filters(
			'burst_rest_api_optimizer_keep_plugins',
			[
				'partial_match' => [
					// AIOS dynamically changes salts, which breaks nonces.
					'all-in-one-wp-security-and-firewall',
					// Excluding Permalink Manager can cause 404 pages.
					'permalink-manager-for-woocommerce',
					'ai-provider-for-',
				],
				'exact_match'   => [
					'ai/ai.php',
					'ai-provider-for-anthropic/plugin.php',
					'ai-provider-for-google/plugin.php',
					'ai-provider-for-openai/plugin.php',
				],
			]
		);

		$plugins_to_keep_partial_match = $plugins_to_keep['partial_match'] ?? [];
		$plugins_to_keep_exact_match   = $plugins_to_keep['exact_match'] ?? [];

		// Some Burst routes still need other plugins active.
		if (
			str_contains( $burst_rest_route, 'burst/v1/track' ) ||
			str_contains( $burst_rest_route, 'burst/v1/auto_installer' ) ||
			str_contains( $burst_rest_route, 'burst/v1/otherplugins' ) ||
			str_contains( $burst_rest_route, 'burst/v1/onboarding' ) ||
			str_contains( $burst_rest_route, 'otherpluginsdata' ) ||
			str_contains( $burst_rest_route, 'plugin_actions' ) ||
			str_contains( $burst_rest_route, 'fields/set' ) ||
			// fields/get builds the integrations field list, which detects other
			// plugins via their constants, so those plugins must stay loaded.
			str_contains( $burst_rest_route, 'fields/get' ) ||
			str_contains( $burst_rest_route, 'goals/get' )
		) {
			return $plugins;
		}

		// A body beyond the inspection budget cannot be checked for the
		// ecommerce flag, so keep every plugin rather than guess.
		if ( burst_rest_api_optimizer_declares_oversized_body() ) {
			return $plugins;
		}

		$integrations      = false;
		$burst_plugin_slug = get_option( 'burst_plugin_slug' );
		// Strict slug validation: only normal folder-name characters.
		// This blocks path traversal (../), absolute paths, slashes and stream
		// wrappers such as phar:// or http://. Combined with the fixed
		// WP_PLUGIN_DIR base below, the loaded file is guaranteed to live
		// inside the plugins directory.
		if (
			is_string( $burst_plugin_slug )
			&& $burst_plugin_slug !== ''
			&& preg_match( '/^[a-zA-Z0-9_-]+$/', $burst_plugin_slug )
		) {
			$integration_file = WP_PLUGIN_DIR . '/' . $burst_plugin_slug . '/includes/Integrations/integrations.php';
			if ( file_exists( $integration_file ) ) {
				$integrations = require $integration_file;
			}
		}

		$is_ecommerce_route =
			strpos( $burst_rest_route, 'burst/v1/data/ecommerce' ) === 0 ||
			strpos( $burst_rest_route, 'burst/v1/do_action/ecommerce' ) === 0 ||
			strpos( $burst_rest_route, 'burst/v1/get_action/ecommerce' ) === 0;

		// Resolved once, and only when a plugin actually needs the decision.
		$should_load_ecommerce = null;

		// Only leave burst and pro add ons active for this request.
		foreach ( $plugins as $key => $plugin ) {
			// Check if plugin is in the keep list.
			$should_keep = false;
			foreach ( $plugins_to_keep_partial_match as $keep_slug ) {
				if ( str_contains( $plugin, $keep_slug ) ) {
					$should_keep = true;
					break;
				}
			}

			if ( ! $should_keep ) {
				foreach ( $plugins_to_keep_exact_match as $keep_plugin ) {
					if ( $plugin === $keep_plugin ) {
						$should_keep = true;
						break;
					}
				}
			}

			if ( $should_keep ) {
				continue;
			}

			if ( strpos( $plugin, 'burst-' ) !== false ) {
				continue;
			}

			if ( ! $is_ecommerce_route && null === $should_load_ecommerce ) {
				$should_load_ecommerce = burst_rest_api_optimizer_should_load_ecommerce();
				if ( null === $should_load_ecommerce ) {
					// Oversized or unreadable body: keep every plugin. No plugin
					// has been removed yet at this point, so the list is complete.
					return $plugins;
				}
			}

			if ( ( $is_ecommerce_route || $should_load_ecommerce ) && ! empty( $integrations ) ) {
				$plugin_slug = dirname( $plugin );

				if (
					isset( $integrations[ $plugin_slug ]['load_ecommerce_integration'] ) &&
					$integrations[ $plugin_slug ]['load_ecommerce_integration']
				) {
					continue;
				}
			}
			unset( $plugins[ $key ] );
		}

		return $plugins;
	}

	add_filter( 'option_active_plugins', 'burst_exclude_plugins_for_rest_api' );
	add_filter( 'pre_update_option_active_plugins', 'burst_rest_api_optimizer_merge_active_plugins_write', PHP_INT_MAX, 2 );
}
