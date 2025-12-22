<?php
/**
 * Rest API Optimizer.
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

		// Define plugins that should always remain active during REST API optimization.
		$plugins_to_keep = [
			// AIOS dynamically changes salts, this breaks nonces.
			'all-in-one-wp-security-and-firewall',
			// if Permalink manager is excluded, this can cause 404 pages.
			'permalink-manager-for-woocommerce',
		];
		/**
		 * Allow filtering of plugins that should remain active during REST API loading of BURST.
		 *
		 * @param array $plugins_to_keep Array of plugin directory names to keep active.
		 */
		$plugins_to_keep = apply_filters( 'burst_rest_api_optimizer_keep_plugins', $plugins_to_keep );

		// if not an rsp request return all plugins.
		// but for some requests, we need to load other plugins, to ensure we can detect them.
		if (
			// burst/v1 not included means this is a not Burst request.
			! str_contains( $request_uri, 'burst/v1' ) ||
			// below requests are burst requests, but requiring the other plugins to load.
			str_contains( $request_uri, 'burst/v1/track' ) ||
			str_contains( $request_uri, 'burst/v1/auto_installer' ) ||
			str_contains( $request_uri, 'burst/v1/do_action/send_email_report' ) ||
			str_contains( $request_uri, 'burst/v1/otherplugins' ) ||
			str_contains( $request_uri, 'burst/v1/onboarding' ) ||
			str_contains( $request_uri, 'otherpluginsdata' ) ||
			str_contains( $request_uri, 'plugin_actions' ) ||
			str_contains( $request_uri, 'fields/set' ) ||
			str_contains( $request_uri, 'goals/get' )
		) {
			return $plugins;
		}

		$integrations      = false;
		$burst_plugin_path = get_option( 'burst_plugin_path' );
		if ( ! empty( $burst_plugin_path ) ) {
			$integration_file = $burst_plugin_path . 'includes/Integrations/integrations.php';
			if ( file_exists( $integration_file ) ) {
				$integrations = require $integration_file;
			}
		}

		// Only leave burst and pro add ons active for this request.
		foreach ( $plugins as $key => $plugin ) {
			// Check if plugin is in the keep list.
			$should_keep = false;
			foreach ( $plugins_to_keep as $keep_slug ) {
				if ( str_contains( $plugin, $keep_slug ) ) {
					$should_keep = true;
					break;
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
					strpos( $request_uri, 'burst/v1/data/ecommerce' ) !== false ||
					strpos( $request_uri, 'burst/v1/do_action/ecommerce' ) !== false
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
