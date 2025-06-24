<?php
/**
 * Autoload PHP classes for the plugin.
 *
 * @package Burst
 */

spl_autoload_register(
	function ( $burst_class ): void {
		$prefix              = 'Burst\\';
		$is_burst            = false;
		$is_updraft          = false;
		$team_updraft_prefix = 'TeamUpdraft\\';
		if ( strpos( $burst_class, $prefix ) === 0 ) {
			$strlen    = strlen( $prefix );
			$namespace = '';
		} elseif ( strpos( $burst_class, $team_updraft_prefix ) === 0 ) {
			$strlen    = strlen( $team_updraft_prefix );
			$namespace = 'TeamUpdraft/src/';
		} else {
			return;
		}

		$relative_class = $namespace . substr( $burst_class, $strlen );
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
