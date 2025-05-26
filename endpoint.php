<?php
/**
 * Burst Statistics endpoint for collecting hits
 */
namespace Burst;

use Burst\Frontend\Tracking\Tracking;

// disable loading of most WP core files.
define( 'SHORTINIT', true );
// Find the base path.
// phpcs:ignore
define( 'BASE_PATH', burst_find_wordpress_base_path() . '/' );
// Load WordPress Core.
if ( ! file_exists( BASE_PATH . 'wp-load.php' ) ) {
	die( 'WordPress not installed here' );
}
require_once BASE_PATH . 'wp-load.php';
define( 'BURST_PATH', plugin_dir_path( __FILE__ ) );

require_once __DIR__ . '/src/autoload.php';

require_once __DIR__ . '/helpers/php-user-agent/UserAgentParser.php';
if ( file_exists( __DIR__ . '/src/Pro/Tracking/tracking.php' ) ) {
	require_once __DIR__ . '/src/Pro/Tracking/tracking.php';
}

( new Tracking() )->beacon_track_hit();
/**
 * Find the base path of WordPress
 */
function burst_find_wordpress_base_path(): string {
	// Try expected relative path first (common case).
	$path = dirname( __DIR__, 3 );
	if ( file_exists( $path . '/wp-load.php' ) ) {
		return rtrim( $path, '/' ) . '/';
	}

	// check for symlinked directory.
	$path = realpath( __DIR__ . '/../../..' );
	if ( $path && file_exists( $path . '/wp-load.php' ) ) {
		return rtrim( $path, '/' ) . '/';
	}

	// Check Bitnami-specific structure.
	$bitnami_path = '/opt/bitnami/wordpress/wp-load.php';
	if (
		! burst_has_open_basedir_restriction( $bitnami_path ) &&
		file_exists( $bitnami_path ) &&
		file_exists( '/bitnami/wordpress/wp-config.php' )
	) {
		return '/opt/bitnami/wordpress/';
	}

	return '/';
}

/**
 * Check if the path is restricted by open_basedir
 *
 * @param string $path The path to check.
 * @return bool True if the path is restricted, false otherwise.
 */
function burst_has_open_basedir_restriction( string $path ): bool {
	// Default error handler is required.
    //phpcs:ignore
	set_error_handler( null );
	// Clean last error info.
	error_clear_last();
	// Testing...
	// @phpstan-ignore-next-line.
	@file_exists( $path ); //phpcs:ignore
	// Restore previous error handler.
    // phpcs:ignore
	restore_error_handler();
	// Return `true` if error has occurred.
	$error = error_get_last();

	if ( is_array( $error ) ) {
		return str_contains( $error['message'], 'open_basedir restriction in effect' );
	}

	return false;
}
