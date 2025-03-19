<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );

if ( ! class_exists( 'burst_sessions' ) ) {
	class burst_sessions {
		function __construct() {
		}
	} // class closure

} // class exists closure

/**
 * Install session table
 * */

add_action( 'burst_install_tables', 'burst_install_sessions_table', 10 );
function burst_install_sessions_table() {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // Create table without indexes first
    $table_name = $wpdb->prefix . 'burst_sessions';
    $sql = "CREATE TABLE $table_name (
        `ID` int NOT NULL AUTO_INCREMENT,
        `first_visited_url` TEXT NOT NULL,
        `last_visited_url` TEXT NOT NULL,
        `goal_id` int,
        `country_code` char(2),
        PRIMARY KEY (ID)
    ) $charset_collate;";

    $result = dbDelta($sql);
    if (!empty($wpdb->last_error)) {
        burst_error_log("Error creating sessions table: " . $wpdb->last_error);
        return; // Exit without updating version if table creation failed
    }

    // Try to create indexes with full length first
    $indexes = array(
        ['goal_id'],
        ['country_code'],
    );

    // Try to create indexes with full length
    foreach ($indexes as $index ) {
        burst_add_index($table_name, $index);
    }
}
