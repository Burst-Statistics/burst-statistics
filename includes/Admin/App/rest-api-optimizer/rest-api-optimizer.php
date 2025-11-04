<?php
defined( 'ABSPATH' ) || die();
// deprecated constant.
if ( defined( 'burst_rest_api_optimizer' ) ) {
	// phpcs:ignore
	//	error_log( "The constant 'burst_rest_api_optimizer' is deprecated. Please use 'BURST_REST_API_OPTIMIZER' instead." );.
	define( 'BURST_REST_API_OPTIMIZER', true );
}

if ( ! function_exists( 'burst_reinstall_rest_api_optimizer' ) ) {
	/**
	 * Reinstall the rest api optimizer.
	 */
	function burst_reinstall_rest_api_optimizer(): void {
		$burst_mu_plugin_file = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';

		if ( file_exists( $burst_mu_plugin_file ) ) {
			wp_delete_file( $burst_mu_plugin_file );
		}

		burst_install_rest_api_optimizer();
	}
}

if ( ! function_exists( 'burst_install_rest_api_optimizer' ) ) {
	/**
	 * Install the rest api optimizer as a must use plugin.
	 */
	function burst_install_rest_api_optimizer(): void {
		$burst_mu_plugin_file = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Not a remotely hosted file.
		$burst_php_code = file_get_contents( __DIR__ . '/optimization-code.php' );
		global $wp_filesystem;
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( ! WP_Filesystem() ) {
			return;
		}

		// Attempt to create mu-plugins dir if missing.
		if ( ! $wp_filesystem->is_dir( WPMU_PLUGIN_DIR ) ) {
			if ( ! $wp_filesystem->is_writable( dirname( WPMU_PLUGIN_DIR ) ) || ! wp_mkdir_p( WPMU_PLUGIN_DIR ) ) {
				update_option( 'burst_rest_api_optimizer_not_writable', true, false );
				return;
			}
		}

		// Write file if dir now exists and is writable.
		if ( $wp_filesystem->is_dir( WPMU_PLUGIN_DIR ) && $wp_filesystem->is_writable( WPMU_PLUGIN_DIR ) ) {
			if ( $wp_filesystem->put_contents( $burst_mu_plugin_file, $burst_php_code, FS_CHMOD_FILE ) === false ) {
				update_option( 'burst_rest_api_optimizer_not_writable', true, false );
			} else {
				update_option( 'burst_plugin_path', BURST_PATH, true );
			}
		} else {
			update_option( 'burst_rest_api_optimizer_not_writable', true, false );
		}
	}
}

// check if our optimizer is installed, or if the mu plugins folder is not writable.
if ( ! defined( 'BURST_REST_API_OPTIMIZER' ) && ! get_option( 'burst_rest_api_optimizer_not_writable' ) ) {
	burst_install_rest_api_optimizer();
}
