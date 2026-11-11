<?php
/**
 * Shared helper to find the WordPress base path.
 *
 * Used by both endpoint.php and buffer-endpoint.php.
 *
 * @package Burst
 */

if ( ! function_exists( 'burst_find_wordpress_base_path' ) ) {
	/**
	 * Find the base path of WordPress.
	 *
	 * @return string Absolute directory path with trailing slash.
	 */
	function burst_find_wordpress_base_path(): string {
		if ( defined( 'ABSPATH' ) ) {
			return rtrim( ABSPATH, '/' ) . '/';
		}

		$plugin_dir = dirname( __DIR__ );

		// Try expected relative path first (common case: wp-content/plugins/<plugin-name> -> 3 levels up to WP root).
		$path = dirname( $plugin_dir, 3 );
		if ( file_exists( $path . '/wp-load.php' ) ) {
			return rtrim( $path, '/' ) . '/';
		}

		// Check subdirectories for wp-load.php.
		$subdirs = glob( $path . '/*', GLOB_ONLYDIR );
		if ( is_array( $subdirs ) ) {
			foreach ( $subdirs as $subdir ) {
				if ( file_exists( $subdir . '/wp-load.php' ) ) {
					return rtrim( $subdir, '/' ) . '/';
				}
			}
		}

		// Check for symlinked directory.
		$real_path = realpath( $plugin_dir . '/../../..' );
		if ( $real_path && file_exists( $real_path . '/wp-load.php' ) ) {
			return rtrim( $real_path, '/' ) . '/';
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
}

if ( ! function_exists( 'burst_has_open_basedir_restriction' ) ) {
	/**
	 * Check if the path is restricted by open_basedir.
	 *
	 * @param string $path The path to check.
	 * @return bool True if the path is restricted, false otherwise.
	 */
	function burst_has_open_basedir_restriction( string $path ): bool {
		// Default error handler is required.
		// phpcs:ignore
		set_error_handler( null );
		// Clean last error info.
		error_clear_last();
		// Testing...
		// @phpstan-ignore-next-line.
		@file_exists( $path ); // phpcs:ignore
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
}
