<?php
/**
 * Burst Uninstall
 *
 * @package Burst
 * @since 2.0.1
 */

// If uninstall is not called from WordPress, exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit();
}

global $wpdb;

// get all burst transients.
$burst_results = $wpdb->get_results(
	"SELECT `option_name` AS `name`, `option_value` AS `value`
                                FROM  $wpdb->options
                                WHERE `option_name` LIKE '%transient_burst%'
                                ORDER BY `option_name`",
	'ARRAY_A'
);
// loop through all burst transients and delete.
foreach ( $burst_results as $burst_key => $burst_value ) {
	$burst_transient_name = substr( $burst_value['name'], 11 );
	delete_transient( $burst_transient_name );
}

$burst_mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
if ( file_exists( $burst_mu_plugin ) ) {
	wp_delete_file( $burst_mu_plugin );
}
