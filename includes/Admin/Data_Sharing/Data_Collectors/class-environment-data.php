<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Traits\Helper;

/**
 * Class Environment_Data
 */
class Environment_Data extends Data_Collector {
	use Helper;

	/**
	 * Build a map of active plugin slugs to versions.
	 *
	 * @return array<string, string>
	 */
	private function get_active_plugins_with_versions(): array {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins          = get_plugins();
		$active_plugins       = (array) get_option( 'active_plugins', [] );
		$active_sitewide      = array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) );
		$active_plugin_slugs  = array_unique( array_merge( $active_plugins, $active_sitewide ) );
		$plugins_with_version = [];

		foreach ( $active_plugin_slugs as $plugin_slug ) {
			$plugin_slug = (string) $plugin_slug;
			$version     = '';

			if ( isset( $all_plugins[ $plugin_slug ]['Version'] ) ) {
				$version = (string) $all_plugins[ $plugin_slug ]['Version'];
			}

			$plugins_with_version[ $plugin_slug ] = $version;
		}

		return $plugins_with_version;
	}

	/**
	 * Collect data from the settings
	 */
	public function collect_data(): array {
		return [
			'wordpress' => [
				'version'   => wp_get_wp_version(),
				'multisite' => is_multisite(),
			],
			'php'       => [
				'version' => phpversion(),
			],
			'plugins'   => [
				'active_plugins' => $this->get_active_plugins_with_versions(),
			],
		];
	}
}
