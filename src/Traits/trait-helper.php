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


	/**
	 * Check if this is Pro
	 */
	public function is_pro(): bool {
		return defined( 'BURST_PRO' );
	}

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
	 * Get the upload dir
	 */
	public function upload_dir( string $path = '' ): string {
		$uploads    = wp_upload_dir();
		$upload_dir = trailingslashit( apply_filters( 'burst_upload_dir', $uploads['basedir'] ) ) . 'burst/' . $path;
		if ( ! is_dir( $upload_dir ) ) {
			wp_mkdir_p( $upload_dir );
		}

		return trailingslashit( $upload_dir );
	}

	/**
	 * Check if open_basedir restriction is enabled
	 */
	public function has_open_basedir_restriction( string $path ): bool {
		// Default error handler is required.
        // phpcs:ignore
		set_error_handler( null );
		// Clean last error info.

		error_clear_last();
		// Testing...
        // phpcs:disable
		// @phpstan-ignore-next-line.
		@file_exists( $path );
        // phpcs:enable
		// Restore previous error handler.
		restore_error_handler();
		// Return `true` if error has occurred.
		$error = error_get_last();

		if ( is_array( $error ) ) {
			return str_contains( $error['message'], 'open_basedir restriction in effect' );
		}
		return false;
	}

	/**
	 * Get the upload url
	 */
	public function upload_url( string $path = '' ): string {
		$uploads    = wp_upload_dir();
		$upload_url = $uploads['baseurl'];
		$upload_url = trailingslashit( apply_filters( 'burst_upload_url', $upload_url ) );
		return trailingslashit( $upload_url . 'burst/' . $path );
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
	 * Check if the remote file exists.
	 * Used by geo IP in case a user has located the MaxMind database outside WordPress.
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
    // phpcs:enable
}
