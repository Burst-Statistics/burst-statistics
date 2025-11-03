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

	/**
	 * Check if we are currently in preview mode from one of the known page builders
	 */
	public function is_pagebuilder_preview(): bool {
		$preview = false;
		global $wp_customize;
		// these are all only exists checks, no data is processed.
        // phpcs:disable
		if ( isset( $wp_customize ) || isset( $_GET['fb-edit'] )
			|| isset( $_GET['et_pb_preview'] )
			|| isset( $_GET['et_fb'] )
			|| isset( $_GET['elementor-preview'] )
			|| isset( $_GET['vc_action'] )
			|| isset( $_GET['vcv-action'] )
			|| isset( $_GET['fl_builder'] )
			|| isset( $_GET['tve'] )
			|| isset( $_GET['ct_builder'] )
		) {
			$preview = true;
		}
        // phpcs:enable

		return apply_filters( 'burst_is_preview', $preview );
	}

	/**
	 * Check if we are in preview mode for Burst
	 */
	public function is_plugin_preview(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only checking if parameter exists, not processing data.
		return isset( $_GET['burst_preview'] );
	}

	/**
	 * Check if the remote file exists
	 * Used by geo ip in case a user has located the maxmind database outside WordPress.
	 */
	public static function remote_file_exists( string $url ): bool {
		// used to encode the url for the option name, not for security purposes.
        // phpcs:ignore
		// nosemgrep
		$hash        = md5( $url );
		$file_exists = get_option( "burst_remote_file_exists_$hash" );

		if ( $file_exists === false ) {
			$response = wp_remote_get(
				$url,
				[
					'method'      => 'HEAD',
					'timeout'     => 10,
					'redirection' => 5,
					'blocking'    => true,
				]
			);

			if ( is_wp_error( $response ) ) {
				$file_exists = 'false';
			} else {
				$status_code = wp_remote_retrieve_response_code( $response );
				$file_exists = ( $status_code >= 200 && $status_code < 300 ) ? 'true' : 'false';
			}

			update_option( "burst_remote_file_exists_$hash", $file_exists );
		}

		return $file_exists === 'true';
	}

	/**
	 * Check if we are running in a test environment
	 */
	public static function is_test(): bool {
		return getenv( 'BURST_CI_ACTIVE' ) !== false || ( defined( 'BURST_CI_ACTIVE' ) );
	}

    // phpcs:disable
    /**
     * Log a message only when in test mode
     *
     * @param $message
     * @return void
     */
    public static function error_log_test( $message ): void {
        if ( self::is_test() ) {
            self::error_log( $message );
        }
    }
    // phpcs:enable

    // phpcs:disable
	/**
	 * Log error to error_log
	 */
	public static function error_log( $message ): void {
		// @phpstan-ignore-next-line.
		if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
			return;
		}

		$logging_enabled = (bool) apply_filters( 'burst_enable_logging', true );
		if ( $logging_enabled ) {
			if ( defined( 'BURST_VERSION' ) ) {
				$version_nr = BURST_VERSION;
			} else {
				$version_nr = 'Endpoint request';
			}

			$burst_pro    = defined( 'BURST_PRO' );
			$before_text  = $burst_pro ? 'Burst Pro' : 'Burst Statistics';
			$before_text .= ' ' . $version_nr . ': ';
			if ( is_array( $message ) || is_object( $message ) ) {
				error_log( $before_text . print_r( $message, true ) );
			} else {
				error_log( $before_text . $message );
			}
		}
	}

    /**
     * Format number to a short version (e.g., 1.2M, 3.4B)
     *
     * @param int $n The number to format.
     * @return string The formatted number.
     */
    private function format_number_short( int $n ): string {
        if ( $n >= 1_000_000_000 ) {
            return round( $n / 1_000_000_000, 1 ) . 'B';
        }
        if ( $n >= 1_000_000 ) {
            return round( $n / 1_000_000, 1 ) . 'M';
        }
        if ( $n >= 1_000 ) {
            return round( $n / 1_000, 1 ) . 'k';
        }
        return (string) $n;
    }

	/**
	 * Get the checkout page ID, with caching
	 *
	 * @return int The checkout page ID.
	 */
	public function burst_checkout_page_id(): int {
		$cache_key = 'burst_checkout_page_id';
		$page_id   = get_transient( $cache_key );

		if ( false === $page_id ) {
			// Default to -1, allow plugins to filter this
			$page_id = apply_filters( 'burst_checkout_page_id', -1 );

			// Cache for 24 hours
			set_transient( $cache_key, $page_id, DAY_IN_SECONDS );
		}

		return (int) $page_id;
	}

	/**
	 * Get the products page ID, with caching
	 *
	 * @return int The checkout page ID.
	 */
	public function burst_products_page_id(): int {
		$cache_key = 'burst_products_page_id';
		$page_id   = get_transient( $cache_key );

		if ( false === $page_id ) {
			// Default to -1, allow plugins to filter this
			$page_id = apply_filters( 'burst_products_page_id', -1 );

			// Cache for 24 hours
			set_transient( $cache_key, $page_id, DAY_IN_SECONDS );
		}

		return (int) $page_id;
	}

	/**
	 * Get the burst uid from cookie or session.
	 *
	 * @return string The burst uid.
	 */
	public function get_burst_uid(): string {
		$burst_uid = isset( $_COOKIE['burst_uid'] ) ? \Burst\burst_loader()->frontend->tracking->sanitize_uid( $_COOKIE['burst_uid'] ) : false;
		if ( ! $burst_uid ) {
			// try fingerprint from session.
			$burst_uid = \Burst\burst_loader()->frontend->tracking->get_fingerprint_from_session();
		}

		return $burst_uid ?: '';
	}

	/**
	 * Calculate percentage change between two values
	 *
	 * @param float $previous The previous value.
	 * @param float $current  The current value.
	 * @return float|null The percentage change, or null if previous value is zero.
	 */
	public static function calculate_percentage_change( float $previous, float $current ): ?float {
		if ( $previous === 0.0 ) {
			return null;
		}
		return round( ( ( $current - $previous ) / $previous ) * 100, 2 );
	}
    // phpcs:enable
}
