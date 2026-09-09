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
		add_action( 'burst_weekly', [ $this, 'update_filter_column_histograms' ] );

		// Page dictionary maintenance: a slug change updates the canonical url
		// immediately via save_post; the weekly sweep heals what save_post
		// cannot see (permalink-structure changes, imports).
		add_action( 'save_post', [ $this, 'sync_page_dictionary_on_save' ], 10, 2 );
		add_action( 'burst_weekly', [ $this, 'sweep_canonical_page_urls' ] );
		add_action( 'burst_weekly', [ $this, 'prune_uid_dictionary' ] );

		( new Visitor_Bitmaps() )->init();
	}

	/**
	 * Keep the canonical url for a post current in the page dictionary. Runs
	 * on save_post: when a post's permalink changes (slug edit), the dictionary
	 * row for the new url is created/claimed and flagged canonical, and any
	 * previous canonical row for that post id is demoted — page-grain queries
	 * then display the new url while the old url's history keeps counting
	 * under the same page_id.
	 *
	 * @param int      $post_id Post ID.
	 * @param \WP_Post $post    Post object.
	 */
	public function sync_page_dictionary_on_save( int $post_id, \WP_Post $post ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		if ( ! $this->column_exists( 'burst_page_urls', 'is_canonical' ) ) {
			return;
		}
		// Non-viewable post types/statuses and query-string permalinks yield
		// '' here (see canonical_page_path()): a product variation, a form
		// post type or a trashed post must never claim the "/" row.
		$path = $this->canonical_page_path( $post_id );
		if ( '' === $path ) {
			return;
		}
		$this->set_canonical_page_url( $post_id, $path );
	}

	/**
	 * Weekly reconciliation of canonical urls against the real permalinks —
	 * the safety net for what save_post cannot see: permalink-structure
	 * changes (which move every post at once) and imports/migrations that
	 * bypass the editor. Time-budgeted with a rotating cursor, so huge
	 * dictionaries reconcile over consecutive weeks. Deleted posts are left
	 * alone: their last known url stays the display url. Every visited row
	 * also converges hits still stored under its negative dictionary id (a
	 * merge capped in a request finishes here, see
	 * merge_negative_page_id_hits()).
	 */
	public function sweep_canonical_page_urls(): void {
		if ( ! $this->has_admin_access() || ! $this->column_exists( 'burst_page_urls', 'is_canonical' ) ) {
			return;
		}

		global $wpdb;
		$cursor      = (int) get_option( 'burst_page_urls_sweep_cursor', 0 );
		$budget      = (float) apply_filters( 'burst_page_urls_sweep_time_budget', 10.0 );
		$sweep_start = microtime( true );

		do {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT ID, page_url, page_id FROM {$wpdb->prefix}burst_page_urls
					WHERE is_canonical = 1 AND page_id > 0 AND ID > %d ORDER BY ID LIMIT 100",
					$cursor
				),
				ARRAY_A
			);
			if ( empty( $rows ) ) {
				// Full pass done: restart from the top next week.
				delete_option( 'burst_page_urls_sweep_cursor' );
				return;
			}

			_prime_post_caches( array_map( 'intval', array_column( $rows, 'page_id' ) ), false, false );
			foreach ( $rows as $row ) {
				$cursor = (int) $row['ID'];
				$this->merge_negative_page_id_hits( (int) $row['ID'], (int) $row['page_id'] );
				// '' for deleted, unpublished/trashed or non-viewable posts:
				// their last known url stays the display url (a ?p=N permalink
				// would otherwise move them onto the "/" row).
				$path = $this->canonical_page_path( (int) $row['page_id'] );
				if ( '' !== $path && $path !== (string) $row['page_url'] ) {
					$this->set_canonical_page_url( (int) $row['page_id'], $path );
				}
			}
		} while ( microtime( true ) - $sweep_start < $budget );

		update_option( 'burst_page_urls_sweep_cursor', $cursor, false );
	}

	/**
	 * Prune dictionary rows of visitors not seen within the retention window.
	 *
	 * Restores the bounded-growth behavior of the removed known_uids table
	 * (which kept uids for 31 days) with a longer horizon: a visitor with no
	 * hit in the last burst_uid_retention_months months loses their uid→id
	 * mapping, and their next visit creates a fresh dictionary row — counted
	 * as a new visitor again, exactly like the old 31-day expiry did. Historic
	 * data is untouched: statistics rows keep their integer uid and closed-day
	 * bitmaps keep their bit positions, so past reports do not change, and
	 * AUTO_INCREMENT stays above every pruned id (recent rows keep MAX(ID)
	 * high), so pruned ids are never reused. Rows referenced by a cart are
	 * kept. Time-budgeted with a rotating cursor like the canonical sweep;
	 * MAX(ID) is captured at pass start, so rows inserted mid-pass are never
	 * probed. Runs only once the dictionary is in steady state (integer uid
	 * schema), never during the migration.
	 */
	public function prune_uid_dictionary(): void {
		if ( ! $this->has_admin_access() || ! $this->uid_id_active() ) {
			return;
		}
		$months = (int) apply_filters( 'burst_uid_retention_months', 12 );
		if ( $months <= 0 ) {
			return;
		}

		global $wpdb;
		$cutoff = time() - ( $months * MONTH_IN_SECONDS );
		$cursor = (int) get_option( 'burst_uids_prune_cursor', 0 );
		$budget = (float) apply_filters( 'burst_uid_prune_time_budget', 10.0 );
		$start  = microtime( true );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$max_id = (int) $wpdb->get_var( "SELECT MAX(ID) FROM {$wpdb->prefix}burst_uids" );
		if ( $max_id <= 0 ) {
			return;
		}

		// Shared code: the cart table only exists on Pro installs.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$cart_guard = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->prefix . 'burst_cart' ) )
			? "AND NOT EXISTS (SELECT 1 FROM {$wpdb->prefix}burst_cart c WHERE c.uid_id = d.ID)"
			: '';

		do {
			$chunk_end = min( $cursor + 5000, $max_id );
	        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, cart guard built above, values prepared.
			$result = $wpdb->query(
				$wpdb->prepare(
					"DELETE d FROM {$wpdb->prefix}burst_uids d
					WHERE d.ID > %d AND d.ID <= %d
					AND NOT EXISTS (
						SELECT 1 FROM {$wpdb->prefix}burst_statistics st
						WHERE st.uid_id = d.ID AND st.time > %d
					) {$cart_guard}",
					$cursor,
					$chunk_end,
					$cutoff
				)
			);
	        // phpcs:enable
			if ( false === $result ) {
				self::error_log( 'uid dictionary prune failed: ' . $wpdb->last_error );
				break;
			}
			$cursor = $chunk_end;
			if ( $cursor >= $max_id ) {
				// Full pass done: restart from the top next week.
				delete_option( 'burst_uids_prune_cursor' );
				return;
			}
		} while ( microtime( true ) - $start < $budget );

		update_option( 'burst_uids_prune_cursor', $cursor, false );
	}

	/**
	 * Refresh optimizer histograms on the skewed, non-indexed filter columns.
	 *
	 * Indexed columns already get accurate estimates via index dives; the
	 * remaining filterable columns (source/source_category on sessions,
	 * page_type on statistics — the virtual 'status' filter resolves to it,
	 * there is no status column) are estimated as uniformly distributed, which can flip
	 * join order into a catastrophic plan for specific filters. Histograms
	 * store the real distribution. They are not auto-refreshed by MySQL, hence
	 * the weekly cron. MySQL 8.0+ only: its histogram build samples pages,
	 * while MariaDB's PERSISTENT statistics require a full table scan (with
	 * table-flush stalls that can reach the tracking hot path) — not worth it
	 * there. Failures are silently ignored because managed hosts may restrict
	 * ANALYZE.
	 */
	public function update_filter_column_histograms(): void {
		global $wpdb;

		if ( ! (bool) apply_filters( 'burst_update_filter_column_histograms', true ) ) {
			return;
		}

		if ( stripos( $wpdb->db_server_info(), 'mariadb' ) !== false ) {
			return;
		}

		if ( version_compare( $wpdb->db_version(), '8.0.3', '<' ) ) {
			return;
		}

		$sessions_table    = $wpdb->prefix . 'burst_sessions';
		$statistics_table  = $wpdb->prefix . 'burst_statistics';
		$sessions_columns  = 'source, source_category, browser_version_id';
		$statistics_column = 'page_type';

		$suppress = $wpdb->suppress_errors();
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table/column names, ANALYZE cannot be prepared.
		$wpdb->query( "ANALYZE TABLE {$sessions_table} UPDATE HISTOGRAM ON {$sessions_columns} WITH 64 BUCKETS" );
		$wpdb->query( "ANALYZE TABLE {$statistics_table} UPDATE HISTOGRAM ON {$statistics_column} WITH 64 BUCKETS" );
        // phpcs:enable
		$wpdb->suppress_errors( $suppress );
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

		// The visitor identity lives in the permanent uid_id column (integer
		// dictionary ids, see burst_uids). Existing installs additionally carry
		// the legacy varchar uid column until the finalize step of the DB
		// upgrade pipeline is done with it (left untouched in 3.7.0, dropped in 3.7.1); that column is deliberately NOT part of
		// this schema — dbDelta never drops columns, so it leaves the legacy
		// column (and its string data) alone while adding uid_id for the
		// backfill. Never re-introduce a `uid` column here: reusing the legacy
		// name for integer data is what allowed an older build's dbDelta to
		// cast identities to varchar and back (the 3.7.0 rollback corruption).
		$tables = [
			'burst_statistics'       => "CREATE TABLE {$wpdb->prefix}burst_statistics (
        `ID` int NOT NULL AUTO_INCREMENT,
        `page_url` varchar(191) NOT NULL,
        `page_id` int(11) NOT NULL,
        `page_type` varchar(191) NOT NULL,
        `time` int NOT NULL,
        `uid_id` int unsigned NOT NULL DEFAULT 0,
        `time_on_page` int,
        `max_scroll` int(3) NOT NULL DEFAULT 0,
        `dwell_zones` text,
        `parameters` TEXT NOT NULL,
        `fragment` varchar(255) NOT NULL,
        `session_id` int,
        PRIMARY KEY  (ID)
    ) $charset_collate;",
			'burst_uids'             => "CREATE TABLE {$wpdb->prefix}burst_uids (
        `ID` int unsigned NOT NULL AUTO_INCREMENT,
        `uid` varchar(64) NOT NULL,
        PRIMARY KEY  (ID),
        UNIQUE KEY uid (uid)
    ) $charset_collate;",
			'burst_browsers'         => "CREATE TABLE {$wpdb->prefix}burst_browsers (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(191) NOT NULL UNIQUE,
        PRIMARY KEY  (ID)
    ) $charset_collate;",
			'burst_browser_versions' => "CREATE TABLE {$wpdb->prefix}burst_browser_versions (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(191) NOT NULL UNIQUE,
        PRIMARY KEY  (ID)
    ) $charset_collate;",
			'burst_platforms'        => "CREATE TABLE {$wpdb->prefix}burst_platforms (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(191) NOT NULL UNIQUE,
        PRIMARY KEY  (ID)
    ) $charset_collate;",
			'burst_devices'          => "CREATE TABLE {$wpdb->prefix}burst_devices (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(191) NOT NULL UNIQUE,
        PRIMARY KEY  (ID)
    ) $charset_collate;",
			'burst_referrers'        => "CREATE TABLE {$wpdb->prefix}burst_referrers (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL UNIQUE,
        PRIMARY KEY  (ID)
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
        `block_goal` tinyint NOT NULL DEFAULT 0,
        `page_id` int(11) NULL,
        PRIMARY KEY  (ID)
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
        PRIMARY KEY  (ID),
        UNIQUE KEY sql_hash (sql_hash)
    ) $charset_collate;",
		];

		foreach ( $tables as $table_name => $sql ) {
			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( "Error creating table {$table_name}: " . $wpdb->last_error );
			}
		}

		// Fresh installs never create the legacy uid column, so uid_id_active()
		// derives to true for them on its own — no state to record here.

		// Ensure max_scroll and dwell_zones columns exist for existing sites upgrading.
		$stats_table = $wpdb->prefix . 'burst_statistics';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$has_max_scroll = $wpdb->get_col( $wpdb->prepare( 'SHOW COLUMNS FROM `' . esc_sql( $stats_table ) . '` LIKE %s', 'max_scroll' ) );
		if ( empty( $has_max_scroll ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE `{$stats_table}` ADD `max_scroll` int(3) NOT NULL DEFAULT 0, ADD `dwell_zones` text" );
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
			[ 'time', 'session_id' ],
			[ 'page_id', 'page_type' ],
			[ 'page_type', 'time' ],
		];

		// The uid_id indexes exist only once the uid migration is complete:
		// creating them while the backfill is still writing uid_id would tax
		// every batch with index maintenance, so the finalize step creates them
		// right after the backfill (add_index() no-ops on re-runs). Migrating
		// installs keep their legacy varchar uid indexes for the legacy query
		// paths until finalize drops them with the column. Definitions and
		// per-index rationale live in Database_Helper::uid_id_index_columns(),
		// shared with the finalize step and the readiness probes.
		if ( $this->uid_id_active() ) {
			$indexes = array_merge( $indexes, $this->uid_id_index_columns() );
		}

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_statistics', $index );
		}

		// Legacy duplicates left behind by old versions: extra copies of
		// (time, uid) / (time, session_id). Every tracking INSERT maintains
		// them without any read benefit. drop_index() is a no-op when the
		// index does not exist.
		$legacy_indexes = [
			'first_time_visit_time_uid_index',
			'idx_time_uid',
			'idx_time_session_id',
		];

		foreach ( $legacy_indexes as $legacy_index ) {
			$this->drop_index( 'burst_statistics', $legacy_index );
		}

		// (time, page_url) is a redundant prefix of the (time, page_url,
		// uid_id) covering index — but only once that covering index exists,
		// which the uid_id_active() block above guarantees. On a migrating
		// install the covering index arrives at the finalize step (which
		// performs this same drop); dropping it here already would leave the
		// Pages queries without any time+page_url index for the whole
		// migration window.
		if ( $this->uid_id_active() ) {
			$this->drop_index( 'burst_statistics', 'time_page_url_index' );
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
