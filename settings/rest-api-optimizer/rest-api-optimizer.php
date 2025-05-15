<?php
defined( 'ABSPATH' ) or die();

// check if our optimizer is installed, or if the mu plugins folder is not writable
if ( ! defined( 'burst_rest_api_optimizer' ) && ! get_option( 'burst_rest_api_optimizer_not_writable' ) ) {
	$php = file_get_contents( trailingslashit( plugin_dir_path( __FILE__ ) ) . 'optimization-code.php' );
	if ( is_writable( WP_CONTENT_DIR ) && ! is_dir( WPMU_PLUGIN_DIR ) ) {
		mkdir( WPMU_PLUGIN_DIR );
	}
	if ( is_writable( WPMU_PLUGIN_DIR ) ) {
		file_put_contents( trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php', $php );
	} else {
		// stop trying for a while
		update_option( 'burst_rest_api_optimizer_not_writable', true, false );
	}
}
