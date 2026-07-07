<?php
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

class Statistics extends Statistics_Data {

	/**
	 * Register hooks and bootstrap metric/join registries for the free tier.
	 */
	public function init(): void {
		Metric_Bootstrap::init();

		add_action( 'burst_install_tables', [ $this, 'install_statistics_table' ], 10 );
		add_action( 'burst_clear_test_visit', [ $this, 'clear_test_visit' ] );
	}

	/**
	 * Clear the test hit from the database, which is added during onboarding.
	 */
	public function clear_test_visit(): void {
		global $wpdb;
		$session_ids = $wpdb->get_col( "SELECT session_id FROM {$wpdb->prefix}burst_statistics WHERE parameters LIKE '%burst_test_hit%' OR parameters LIKE '%burst_nextpage%'" );

		$wpdb->query(
			"DELETE FROM {$wpdb->prefix}burst_statistics WHERE parameters LIKE '%burst_test_hit%' OR parameters LIKE '%burst_nextpage%'"
		);

		if ( ! empty( $session_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $session_ids ), '%d' ) );
			$wpdb->query(
				$wpdb->prepare(
				// replacable %s located in $placeholders variable.
                // phpcs:ignore
					"DELETE FROM {$wpdb->prefix}burst_sessions WHERE ID IN ($placeholders)",
					...$session_ids
				)
			);
		}

		if ( $this->table_exists( 'burst_parameters' ) ) {
			$wpdb->query(
				"DELETE FROM {$wpdb->prefix}burst_parameters WHERE parameter LIKE '%burst_test_hit%' OR parameter LIKE '%burst_nextpage%'"
			);
		}
	}

	/**
	 * Install statistic table
	 * */
	public function install_statistics_table(): void {
		self::error_log( 'Upgrading database tables for Burst Statistics' );

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$tables          = [
			'burst_statistics'       => "CREATE TABLE {$wpdb->prefix}burst_statistics (
        `ID` int NOT NULL AUTO_INCREMENT,
        `page_url` varchar(191) NOT NULL,
        `page_id` int(11) NOT NULL,
        `page_type` varchar(191) NOT NULL,
        `time` int NOT NULL,
        `uid` varchar(64) NOT NULL,
        `time_on_page` int,
        `parameters` TEXT NOT NULL,
        `fragment` varchar(255) NOT NULL,
        `session_id` int,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_browsers'         => "CREATE TABLE {$wpdb->prefix}burst_browsers (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_browser_versions' => "CREATE TABLE {$wpdb->prefix}burst_browser_versions (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_platforms'        => "CREATE TABLE {$wpdb->prefix}burst_platforms (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_devices'          => "CREATE TABLE {$wpdb->prefix}burst_devices (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_referrers'        => "CREATE TABLE {$wpdb->prefix}burst_referrers (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL UNIQUE,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_goals'            => "CREATE TABLE {$wpdb->prefix}burst_goals (
        `ID` int NOT NULL AUTO_INCREMENT,
        `title` varchar(255) NOT NULL,
        `type` varchar(30) NOT NULL,
        `status` varchar(30) NOT NULL,
        `url` varchar(255) NOT NULL,
        `conversion_metric` varchar(255) NOT NULL,
        `date_created` int NOT NULL,
        `server_side` int NOT NULL,
        `date_start` int NOT NULL,
        `date_end` int NOT NULL,
        `selector` varchar(255) NOT NULL,
        `hook` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_known_uids'       => "CREATE TABLE {$wpdb->prefix}burst_known_uids (
            `uid` varchar(64) NOT NULL,
        `first_seen` INT UNSIGNED NOT NULL,
        `last_seen` INT UNSIGNED NOT NULL,
        PRIMARY KEY (uid)
    ) $charset_collate;",
			'burst_query_stats'      => "CREATE TABLE {$wpdb->prefix}burst_query_stats (
        `ID` int NOT NULL AUTO_INCREMENT,
        `sql_hash` varchar(16) NOT NULL,
        `sql_query` text NOT NULL,
        `avg_execution_time` float NOT NULL,
        `max_execution_time` float NOT NULL,
        `min_execution_time` float NOT NULL,
        `last_updated` int NOT NULL,
        `execution_count` int NOT NULL,
        `date_range_days` int NOT NULL DEFAULT 0,
        PRIMARY KEY (ID),
        UNIQUE KEY sql_hash (sql_hash)
    ) $charset_collate;",
		];

		foreach ( $tables as $table_name => $sql ) {
			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( "Error creating table {$table_name}: " . $wpdb->last_error );
			}
		}

		$indexes = [
			[ 'avg_execution_time' ],
			[ 'last_updated' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_query_stats', $index );
		}

		$indexes = [
			[ 'time' ],
			[ 'page_url' ],
			[ 'session_id' ],
			[ 'time', 'page_url' ],
			[ 'time', 'uid' ],
			[ 'time', 'session_id' ],
			[ 'uid', 'time' ],
			[ 'page_id', 'page_type' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_statistics', $index );
		}

		$indexes = [
			[ 'last_seen' ],
			[ 'uid', 'first_seen' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_known_uids', $index );
		}

		$indexes = [
			[ 'status' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_goals', $index );
		}
	}

	/**
	 * Recommend persistent object cache when slow analytics queries are detected.
	 */
	public static function should_recommend_object_cache(): bool {
		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			return false;
		}

		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_query_stats';

		$exists = $wpdb->get_var(
			$wpdb->prepare(
				'SHOW TABLES LIKE %s',
				$table_name
			)
		);

		if ( ! $exists ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is built from trusted prefix.
		$slowest_query = (float) $wpdb->get_var( "SELECT MAX(max_execution_time) FROM {$table_name}" );
		$threshold     = (float) apply_filters( 'burst_object_cache_recommendation_threshold_seconds', 10.0 );

		return $slowest_query >= max( 0.1, $threshold );
	}
}
