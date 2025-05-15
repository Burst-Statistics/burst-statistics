<?php
/**
 * Autoload PHP classes for the plugin.
 *
 * @package Burst
 */

spl_autoload_register(
	function ( $burst_class ): void {
		$prefix = 'Burst\\';
		if ( ! str_starts_with( $burst_class, $prefix ) ) {
			return;
		}

		$relative_class = substr( $burst_class, strlen( $prefix ) );
		$path           = str_replace( '\\', '/', $relative_class );
		$class_name     = basename( $path );
		$dir            = dirname( $path );

		if ( $dir === '.' ) {
			$dir = '';
		} else {
			$dir .= '/';
		}
		$plugin_path = dirname( __DIR__, 1 ) . '/';
		// Build the class file path.
		$file = $plugin_path . "src/{$dir}class-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';

		if ( file_exists( $file ) ) {
			require_once $file;
			return;
		}

		$trait_file = $plugin_path . "src/{$dir}trait-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
		if ( file_exists( $trait_file ) ) {
			require_once $trait_file;
			return;
		}

        // phpcs:ignore
		error_log( "Burst: Class $burst_class not found in $file or $trait_file" );
	}
);
