<?php
namespace Burst\Frontend;

use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Sessions {
	use Database_Helper;
	use Helper;

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_sessions_table' ], 10 );
	}

	/**
	 * Install session table
	 * */
	public function install_sessions_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		// Create table without indexes first.
		$table_name = $wpdb->prefix . 'burst_sessions';
		$sql        = "CREATE TABLE $table_name (
            `ID` int NOT NULL AUTO_INCREMENT,
            `first_visited_url` TEXT NOT NULL,
            `last_visited_url` TEXT NOT NULL,
            `host` varchar(255) NOT NULL DEFAULT '',
            `referrer` varchar(255) DEFAULT NULL,
            `goal_id` int,
            `city_code` int DEFAULT 0,
            `browser_id` int NOT NULL DEFAULT 0,
            `browser_version_id` int NOT NULL DEFAULT 0,
            `platform_id` int NOT NULL DEFAULT 0,
            `device_id` int NOT NULL DEFAULT 0,
            `first_time_visit` tinyint NOT NULL DEFAULT 0,
            `bounce` tinyint DEFAULT 1,
            PRIMARY KEY (ID)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating sessions table: ' . $wpdb->last_error );
			return;
		}

		$indexes = [
			[ 'goal_id' ],
			[ 'city_code' ],
			[ 'browser_id' ],
			[ 'platform_id' ],
			[ 'device_id' ],
			[ 'first_time_visit' ],
			[ 'bounce' ],
		];

		// Try to create indexes with full length.
		foreach ( $indexes as $index ) {
			$this->add_index( $table_name, $index );
		}
	}
}
