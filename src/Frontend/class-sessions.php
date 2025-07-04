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
            `goal_id` int,
            `city_code` int DEFAULT 0,
			`accuracy_radius_km` int DEFAULT 0,
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
		];

		// Try to create indexes with full length.
		foreach ( $indexes as $index ) {
			$this->add_index( $table_name, $index );
		}
	}
}
