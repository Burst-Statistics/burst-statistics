<?php
/**
 * Autoload PHP classes for the plugin.
 *
 * @package Burst
 */

spl_autoload_register(
	function ( $burst_class ): void {
		$prefix              = 'Burst\\';
		$team_updraft_prefix = 'TeamUpdraft\\';
		if ( strpos( $burst_class, $prefix ) === 0 ) {
			$strlen    = strlen( $prefix );
			$namespace = '';
		} elseif ( strpos( $burst_class, $team_updraft_prefix ) === 0 ) {
			$strlen    = strlen( $team_updraft_prefix );
			$namespace = 'TeamUpdraft/';
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
		$file = $plugin_path . "includes/{$dir}class-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
		if ( file_exists( $file ) ) {
			require_once $file;
			return;
		}

		$trait_file = $plugin_path . "includes/{$dir}trait-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
		if ( file_exists( $trait_file ) ) {
			require_once $trait_file;
			return;
		}

		// Try with lowercase/kebab-cased subdirectories (e.g. Integrations/plugins/elementor/).
		$parts = explode( '/', trim( $dir, '/' ) );
		if ( count( $parts ) > 1 ) {
			$first         = array_shift( $parts );
			$kebab_subdirs = implode(
				'/',
				array_map(
					static function ( $part ) {
						return str_replace( '_', '-', strtolower( $part ) );
					},
					$parts
				)
			);
			$alt_dir       = $first . '/' . $kebab_subdirs . '/';
			$alt_file      = $plugin_path . "includes/{$alt_dir}class-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
			if ( file_exists( $alt_file ) ) {
				require_once $alt_file;
				return;
			}
			$alt_trait = $plugin_path . "includes/{$alt_dir}trait-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
			if ( file_exists( $alt_trait ) ) {
				require_once $alt_trait;
				return;
			}
		}

		// temporary fallback during upgrade.
		$file = $plugin_path . "src/{$dir}class-" . str_replace( '_', '-', strtolower( $class_name ) ) . '.php';
		if ( file_exists( $file ) ) {
			require_once $file;
			return;
		}

        // phpcs:ignore
		error_log( "Burst: Class $burst_class not found in $file or $trait_file" );
	}
);
