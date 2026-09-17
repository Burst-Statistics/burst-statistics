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

		// Create table without indexes first. start_time (session start) and
		// uid_id (dictionary id of the visitor, see burst_uids) are denormalized
		// so session-grain queries need no statistics join; historic rows are
		// backfilled by the sessions_first_time DB upgrade, armed from
		// Upgrade::check_upgrade() like every other upgrade. has_pageview (3.7.1)
		// marks sessions with at least one non-404 hit: the hit-grain queries
		// exclude 404 hits, so a session consisting of 404 hits only (a bot
		// scan) must not count at session grain either — the flag is what lets
		// the session-grain FROM apply that rule without touching the hits.
		// Historic rows are backfilled by the sessions_has_pageview DB upgrade.
		$table_name = $wpdb->prefix . 'burst_sessions';

		$sql = "CREATE TABLE $table_name (
            `ID` int NOT NULL AUTO_INCREMENT,
            `start_time` int NOT NULL DEFAULT 0,
            `uid_id` int unsigned NOT NULL DEFAULT 0,
            `has_pageview` tinyint NOT NULL DEFAULT 0,
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
            `source` varchar(255) DEFAULT NULL,
            `source_category` varchar(255) DEFAULT NULL,
            `source_mapped` tinyint NOT NULL DEFAULT 0,
            PRIMARY KEY (ID)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating sessions table: ' . $wpdb->last_error );
			return;
		}

		// Pre-release development installs briefly carried a visitor_uid varchar
		// column (superseded by uid_id) and the first_time-named index of the
		// renamed column; clean both up. No-ops everywhere else.
		$this->drop_index( 'burst_sessions', 'first_time_visitor_uid_index' );
		$this->drop_index( 'burst_sessions', 'first_time_uid_id_index' );
		if ( $this->column_exists( 'burst_sessions', 'visitor_uid' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table/column names.
			$wpdb->query( "ALTER TABLE {$table_name} DROP COLUMN `visitor_uid`" );
		}

		// 3.7.1 widened the session-grain covering index with has_pageview; the
		// narrower 3.7.0 index is fully redundant next to it, so drop it once
		// the wider one exists — keeping both would double the index
		// maintenance on every session insert. The drop runs after the add
		// below on a first init, so a range query is never left without a
		// usable index in between.
		$legacy_index = $this->index_name_for_columns( [ 'start_time', 'uid_id' ] );

		$indexes = [
			// Covering for session-grain range queries: filter on start_time,
			// apply the has_pageview rule and count distinct uid_id without
			// touching the row.
			[ 'start_time', 'uid_id', 'has_pageview' ],
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
			$this->add_index( 'burst_sessions', $index );
		}

		if ( $this->index_exists( 'burst_sessions', $this->index_name_for_columns( $indexes[0] ) ) ) {
			$this->drop_index( 'burst_sessions', $legacy_index );
		}
	}
}
