<?php
/**
 * Plugin Name: Burst REST API Optimizer
 * Plugin URI: https://burst-statistics.com
 * Description: Must-use plugin installed by Burst Pro to keep the Burst REST API fast by skipping unrelated plugins on Burst REST requests.
 * Version: 1.0.0
 * Requires at least: 6.6
 * Requires PHP: 8.0
 * Author: Burst Statistics
 * Author URI: https://burst-statistics.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

defined( 'ABSPATH' ) || die();

define( 'BURST_REST_API_OPTIMIZER', true );

if ( ! function_exists( '\Burst\burst_exclude_plugins_for_rest_api' ) && ! function_exists( 'burst_exclude_plugins_for_rest_api' ) ) {
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
			str_contains( $burst_rest_route, 'goals/get' )
		) {
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

			$should_load_ecommerce = false;

			// Try reading from $_REQUEST (works if form-data).
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- This is not a security issue, just checking for a flag.
			if ( isset( $_REQUEST['should_load_ecommerce'] ) ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- This is not a security issue, just checking for a flag.
				$should_load_ecommerce = filter_var( wp_unslash( $_REQUEST['should_load_ecommerce'] ), FILTER_VALIDATE_BOOL );
			}

			if ( ! $should_load_ecommerce ) {
				$raw = file_get_contents( 'php://input' );
				if ( $raw ) {
					$data = json_decode( $raw, true );
					if ( isset( $data['should_load_ecommerce'] ) ) {
						$should_load_ecommerce = filter_var( $data['should_load_ecommerce'], FILTER_VALIDATE_BOOL );
					}

					// Also support: when wrapped inside { path, data:{} }.
					if ( isset( $data['data']['should_load_ecommerce'] ) ) {
						$should_load_ecommerce = filter_var( $data['data']['should_load_ecommerce'], FILTER_VALIDATE_BOOL );
					}
				}
			}

			if (
				(
					strpos( $burst_rest_route, 'burst/v1/data/ecommerce' ) === 0 ||
					strpos( $burst_rest_route, 'burst/v1/do_action/ecommerce' ) === 0 ||
					strpos( $burst_rest_route, 'burst/v1/get_action/ecommerce' ) === 0
				) ||
				$should_load_ecommerce
			) {
				if ( ! empty( $integrations ) ) {
					$plugin_slug = dirname( $plugin );

					if (
						isset( $integrations[ $plugin_slug ]['load_ecommerce_integration'] ) &&
						$integrations[ $plugin_slug ]['load_ecommerce_integration']
					) {
						continue;
					}
				}
			}
			unset( $plugins[ $key ] );
		}

		return $plugins;
	}

	add_filter( 'option_active_plugins', 'burst_exclude_plugins_for_rest_api' );
}
