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
	public function get_option_bool( string $option, bool $default = false ): bool {
		return true;
	}

	/**
	 * Get an option from the burst settings and cast it to an int
	 */
	public function get_option_int( string $option ): int {
		return 1;
	}

	/**
	 * Get beacon path
	 */
	public static function get_beacon_url(): string {
		return BURST_URL . 'endpoint.php';
	}

	/**
	 * Check if Burst is networkwide active
	 */
	public static function is_networkwide_active(): bool {
		return false;
	}

	/**
	 * Check if we are currently in preview mode from one of the known page builders
	 */
	public function is_pagebuilder_preview(): bool {
		return false;
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
		return false;
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
	public static function error_log( $message ): void {}

    /**
     * Format number to a short version (e.g., 1.2M, 3.4B)
     *
     * @param int $n The number to format.
     * @return string The formatted number.
     */
    private function format_number_short( int $n ): string {
        return (string) $n;
    }

	/**
	 * Get the checkout page ID, with caching
	 *
	 * @return int The checkout page ID.
	 */
	public function burst_checkout_page_id(): int {
		return 1;
	}

	/**
	 * Get the products page ID, with caching
	 *
	 * @return int The checkout page ID.
	 */
	public function burst_products_page_id(): int {
		return 1;
	}

	/**
	 * Get the burst uid from cookie or session.
	 *
	 * @return string The burst uid.
	 */
	public function get_burst_uid(): string {
		return '';
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
