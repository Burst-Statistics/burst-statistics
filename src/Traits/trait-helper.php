<?php
namespace Burst\Traits;

use function burst_get_option;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trait admin helper
 *
 * @since   3.0
 */
trait Helper {
    // phpcs:disable
	/**
	 * Get an option from the burst settings
	 */
	public function get_option( string $option, $default = false ) {
		return burst_get_option( $option, $default );
	}
    // phpcs:enable

	/**
	 * Get an option from the burst settings and cast it to a boolean
	 */
	public function get_option_bool( string $option ): bool {
		return (bool) $this->get_option( $option );
	}

	/**
	 * Get an option from the burst settings and cast it to an int
	 */
	public function get_option_int( string $option ): int {
		return (int) $this->get_option( $option );
	}

	/**
	 * Get beacon path
	 */
	public static function get_beacon_url(): string {
		if ( is_multisite() && (bool) get_site_option( 'burst_track_network_wide' ) && self::is_networkwide_active() ) {
			if ( is_main_site() ) {
				return BURST_URL . 'endpoint.php';
			} else {
				// replace the subsite url with the main site url in BURST_URL.
				// get main site_url.
				$main_site_url = get_site_url( get_main_site_id() );
				return str_replace( site_url(), $main_site_url, BURST_URL ) . 'endpoint.php';
			}
		}
		return BURST_URL . 'endpoint.php';
	}

	/**
	 * Check if Burst is networkwide active
	 */
	public static function is_networkwide_active(): bool {
		if ( ! is_multisite() ) {
			return false;
		}
		if ( ! function_exists( 'is_plugin_active_for_network' ) ) {
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		if ( is_plugin_active_for_network( BURST_PLUGIN ) ) {
			return true;
		}

		return false;
	}
}
