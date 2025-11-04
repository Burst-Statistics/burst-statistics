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
		// don't optimize for admin-ajax requests, so if a security plugin breaks the optimizer, it has a fallback.
		if ( isset( $_SERVER['REQUEST_URI'] ) && strpos( $_SERVER['REQUEST_URI'], 'admin-ajax.php' ) !== false ) {
			return $plugins;
		}

		// if not an rsp request return all plugins.
		// but for some requests, we need to load other plugins, to ensure we can detect them.
		if ( isset( $_SERVER['REQUEST_URI'] ) && (
				// burst/v1 not included means this is a not Burst request.
				strpos( $_SERVER['REQUEST_URI'], 'burst/v1' ) === false ||
				// below requests are burst requests, but requiring the other plugins to load.
				strpos( $_SERVER['REQUEST_URI'], 'burst/v1/auto_installer' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'burst/v1/otherplugins' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'burst/v1/onboarding' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'otherpluginsdata' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'plugin_actions' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'fields/set' ) !== false ||
				strpos( $_SERVER['REQUEST_URI'], 'goals/get' ) !== false
			)
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
			// aios can dynamically change salts, which breaks the rest api.
			// to resolve, we let aios enabled.
			if ( false !== strpos( $plugin, 'all-in-one-wp-security-and-firewall' ) ) {
				continue;
			}

			if ( strpos( $plugin, 'burst-' ) !== false ) {
				continue;
			}

			if ( isset( $_SERVER['REQUEST_URI'] ) && ( strpos( $_SERVER['REQUEST_URI'], 'burst/v1/data/ecommerce' ) !== false || strpos( $_SERVER['REQUEST_URI'], 'burst/v1/do_action/ecommerce' ) !== false ) ) {
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
