<?php

namespace Burst\Traits;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trait admin helper
 *
 * @since   3.0
 */
trait Database_Helper {

	use Admin_Helper;

	/**
	 * Resolve query timeout in milliseconds based on runtime context.
	 *
	 * Background cron defaults to 15 minutes, while foreground requests default
	 * to 30 seconds unless overridden.
	 *
	 * Mixed $filter_context: opaque payload forwarded as-is to the timeout apply_filters() hooks; its type is defined by third-party filter callbacks.
	 */
	protected function resolve_query_timeout_ms(
		string $foreground_filter,
		string $background_filter,
		mixed $filter_context = null,
		int $foreground_default_ms = 30000,
		int $background_default_ms = 900000,
		int $option_default_ms = 0,
		bool $option_override_requires_positive = true
	): int {
		if ( wp_doing_cron() ) {
			$timeout_ms = $this->apply_query_timeout_filter( $background_filter, $background_default_ms, $filter_context );

			return max( 0, $timeout_ms );
		}

		$default_timeout_ms = $foreground_default_ms;
		$option_timeout_ms  = (int) get_option( 'burst_query_timeout_ms', $option_default_ms );

		if ( $option_override_requires_positive ) {
			if ( $option_timeout_ms > 0 ) {
				$default_timeout_ms = $option_timeout_ms;
			}
		} else {
			$default_timeout_ms = $option_timeout_ms;
		}

		$timeout_ms = $this->apply_query_timeout_filter( $foreground_filter, $default_timeout_ms, $filter_context );

		return max( 0, $timeout_ms );
	}

	/**
	 * Apply one of the supported timeout filters.
	 *
	 * Mixed $filter_context: opaque payload forwarded as-is to apply_filters(); its type is defined by third-party filter callbacks.
	 */
	private function apply_query_timeout_filter( string $filter_name, int $timeout_ms, mixed $filter_context = null ): int {
		switch ( $filter_name ) {
			case 'burst_query_timeout_ms_background':
				return null === $filter_context
					? (int) apply_filters( 'burst_query_timeout_ms_background', $timeout_ms )
					: (int) apply_filters( 'burst_query_timeout_ms_background', $timeout_ms, $filter_context );

			case 'burst_query_timeout_ms':
				return null === $filter_context
					? (int) apply_filters( 'burst_query_timeout_ms', $timeout_ms )
					: (int) apply_filters( 'burst_query_timeout_ms', $timeout_ms, $filter_context );

			case 'burst_subscription_query_timeout_ms_background':
				return null === $filter_context
					? (int) apply_filters( 'burst_subscription_query_timeout_ms_background', $timeout_ms )
					: (int) apply_filters( 'burst_subscription_query_timeout_ms_background', $timeout_ms, $filter_context );

			case 'burst_subscription_query_timeout_ms':
				return null === $filter_context
					? (int) apply_filters( 'burst_subscription_query_timeout_ms', $timeout_ms )
					: (int) apply_filters( 'burst_subscription_query_timeout_ms', $timeout_ms, $filter_context );

			default:
				return $timeout_ms;
		}
	}

	/**
	 * Add MAX_EXECUTION_TIME optimizer hint to SELECT queries.
	 */
	protected function add_query_timeout_hint( string $sql, int $timeout_ms ): string {
		if ( $timeout_ms <= 0 ) {
			return $sql;
		}

		if ( stripos( $sql, 'MAX_EXECUTION_TIME(' ) !== false ) {
			return $sql;
		}

		if ( 1 !== preg_match( '/^\s*SELECT\s+/i', $sql ) ) {
			return $sql;
		}

		$hint = sprintf( 'SELECT /*+ MAX_EXECUTION_TIME(%d) */ ', $timeout_ms );

		return preg_replace( '/^\s*SELECT\s+/i', $hint, $sql, 1 ) ?? $sql;
	}

	/**
	 * Add the SQL_BIG_RESULT modifier to large GROUP BY SELECT queries.
	 *
	 * At high group counts the default in-memory temp-table plan overflows the
	 * host-capped tmp_table_size and falls back to an on-disk temp table;
	 * SQL_BIG_RESULT selects the filesort strategy up front. Disabled by
	 * default: the date range is a poor proxy for group count, and for grouped
	 * results that fit in memory the forced filesort is strictly slower —
	 * which describes most installs. The filter is an opt-in benchmark toggle
	 * until a group-count-aware trigger justifies enabling it.
	 *
	 * @param string $sql             Fully prepared SELECT statement.
	 * @param int    $date_range_days Date range of the query in days (0 = unknown).
	 */
	protected function add_big_result_modifier( string $sql, int $date_range_days ): string {
		if ( ! (bool) apply_filters( 'burst_sql_big_result_enabled', false, $sql, $date_range_days ) ) {
			return $sql;
		}

		if ( stripos( $sql, 'SQL_BIG_RESULT' ) !== false ) {
			return $sql;
		}

		if ( stripos( $sql, 'GROUP BY' ) === false ) {
			return $sql;
		}

		$min_days = (int) apply_filters( 'burst_sql_big_result_min_range_days', 31 );
		if ( $min_days > 0 && $date_range_days < $min_days ) {
			return $sql;
		}

		// The modifier must follow the optional /*+ ... */ optimizer hint block,
		// which itself must directly follow SELECT.
		return preg_replace( '/^(\s*SELECT\s+(?:\/\*\+.*?\*\/\s*)?)/is', '$1SQL_BIG_RESULT ', $sql, 1 ) ?? $sql;
	}

	/**
	 * Raise the session temp-table memory caps ahead of a large GROUP BY query.
	 *
	 * Shared hosts commonly cap tmp_table_size at 16-32MB, forcing large grouped
	 * results to disk. Raising it is session-scoped and needs no privileges, but
	 * some managed hosts deny SET SESSION — failures are silently ignored. Runs
	 * at most once per request; never lowers an already higher cap.
	 */
	protected function maybe_raise_session_temp_table_size(): void {
		static $done = false;
		if ( $done ) {
			return;
		}
		$done = true;

		global $wpdb;
		$target_bytes = (int) apply_filters( 'burst_session_tmp_table_size_bytes', 64 * MB_IN_BYTES );
		if ( $target_bytes <= 0 ) {
			return;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$current_bytes = (int) $wpdb->get_var( 'SELECT @@SESSION.tmp_table_size' );
		if ( $current_bytes <= 0 || $current_bytes >= $target_bytes ) {
			return;
		}

		$suppress = $wpdb->suppress_errors();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( 'SET SESSION tmp_table_size = %d, SESSION max_heap_table_size = %d', $target_bytes, $target_bytes ) );
		$wpdb->suppress_errors( $suppress );
	}

	/**
	 * Whether the uid dictionary migration has completed for this blog, so the
	 * pipeline steps, the table installer and the admin maintenance paths can
	 * treat uid_id (integer dictionary ids, see burst_uids) as the identity
	 * column. Derived from the ACTUAL SCHEMA, not from options or task flags:
	 *
	 * - the legacy varchar uid column is absent (fresh install, or the 3.7.1
	 *   drop has run), or
	 * - the uid_id indexes exist — the finalize step creates them right after
	 *   the backfill, and nothing else does on a migrating install (the
	 *   installer only adds them once this check is already true).
	 *
	 * The finalize step deliberately does NOT alter the legacy column (making
	 * it nullable would be a full table rebuild); the column stays NOT NULL
	 * until 3.7.1 drops it, and the tracker no longer writes it (MySQL's
	 * implicit '' under WordPress' non-strict sql_mode). A rollback to the
	 * previous release therefore finds the column exactly as it left it.
	 *
	 * Rollbacks stay convergent: rows written by the older build carry a uid
	 * string and uid_id 0; on re-upgrade the pipeline tasks gate on the legacy
	 * column being PRESENT (legacy_uid_column_exists()), not on this check, so
	 * they re-converge on that string data, and finalize's straggler sweep
	 * runs unconditionally.
	 *
	 * Cached per blog: per request, plus a one-minute object-cache entry; the
	 * finalize step flushes it via flush_uid_id_active_cache() right after the
	 * index build commits. NOT used on the tracking hot path: writers pick
	 * their column set via tracking_schema_current() (an autoloaded option
	 * read) instead of probing the schema on every hit.
	 */
	protected function uid_id_active(): bool {
		$blog_id = get_current_blog_id();
		if ( isset( self::$uid_id_active_cache[ $blog_id ] ) ) {
			return self::$uid_id_active_cache[ $blog_id ];
		}

		$cache_key = "burst_uid_id_active_{$blog_id}";
		$found     = false;
		$cached    = wp_cache_get( $cache_key, 'burst', false, $found );
		if ( $found ) {
			self::$uid_id_active_cache[ $blog_id ] = (bool) $cached;
			return self::$uid_id_active_cache[ $blog_id ];
		}

		$active = ! $this->legacy_uid_column_exists()
			|| $this->index_exists( 'burst_statistics', $this->index_name_for_columns( $this->uid_id_index_columns()[0] ) );
		wp_cache_set( $cache_key, $active ? 1 : 0, 'burst', MINUTE_IN_SECONDS );
		self::$uid_id_active_cache[ $blog_id ] = $active;
		return $active;
	}

	/**
	 * Whether burst_statistics still carries the legacy varchar uid column —
	 * i.e. this blog was installed before 3.7.0 and the 3.7.1 drop has not run.
	 * The pipeline tasks gate on this (there is string data to migrate), the
	 * completion check uid_id_active() combines it with the index probe.
	 * Memoized per request (a class property so flush_uid_id_active_cache()
	 * can reset it).
	 */
	protected function legacy_uid_column_exists(): bool {
		$blog_id = get_current_blog_id();
		if ( ! isset( self::$legacy_uid_column_cache[ $blog_id ] ) ) {
			self::$legacy_uid_column_cache[ $blog_id ] = $this->column_exists( 'burst_statistics', 'uid' );
		}
		return self::$legacy_uid_column_cache[ $blog_id ];
	}

	/**
	 * Per-request memo for legacy_uid_column_exists(), per blog.
	 *
	 * @var array<int, bool>
	 */
	protected static array $legacy_uid_column_cache = [];

	/**
	 * Per-request memo for uid_id_active(), per blog. A class property rather
	 * than a function static so flush_uid_id_active_cache() can reset it when
	 * the finalize step builds the uid_id indexes mid-request.
	 *
	 * @var array<int, bool>
	 */
	protected static array $uid_id_active_cache = [];

	/**
	 * Flush the uid_id_active() caches for the current blog. Called by the
	 * finalize step right after the uid_id index build commits, so integer
	 * mode flips with the schema instead of after the cache TTL.
	 */
	protected function flush_uid_id_active_cache(): void {
		$blog_id = get_current_blog_id();
		unset( self::$uid_id_active_cache[ $blog_id ], self::$legacy_uid_column_cache[ $blog_id ] );
		wp_cache_delete( "burst_uid_id_active_{$blog_id}", 'burst' );
	}

	/**
	 * Uids whose dictionary row was created during THIS request, per blog.
	 * Written by resolve_uid_id(), read by uid_created_this_request() — the
	 * tracker derives first_time_visit from it: the dictionary insert IS the
	 * "first time ever seen" event, so no separate known-uids bookkeeping or
	 * recalculation cron is needed.
	 *
	 * @var array<int, array<string, bool>>
	 */
	protected static array $uids_created_this_request = [];

	/**
	 * Resolve a value to its dictionary id, creating the dictionary row on
	 * first sight — the shared implementation behind resolve_uid_id() and
	 * resolve_page_url_id(). Returns 0 when the dictionary table is not
	 * available yet (backfills sweep those rows later).
	 *
	 * The SELECT-first order keeps the hot path read-only for known values;
	 * the IODKU makes concurrent first sights of the same new value converge
	 * on one id without a race — rows_affected distinguishes the winner (1 =
	 * inserted) from the loser (0 = existing row set to its own value), so
	 * exactly one request observes the value as created. On an insert that
	 * yields no id, one retry covers a transient failure (deadlock, lock-wait
	 * timeout during a traffic spike) that would otherwise store this hit
	 * under dictionary id 0.
	 *
	 * @param string $table   Dictionary table (burst prefix, no wp_ prefix).
	 * @param string $column  The unique value column of the dictionary.
	 * @param string $value   The value to resolve.
	 * @param bool   $created Set to true when this request inserted the row.
	 */
	private function resolve_dictionary_id( string $table, string $column, string $value, bool &$created = false ): int {
		global $wpdb;
		$created = false;
		$table   = $this->validate_table_name( $table );
		if ( '' === $table ) {
			return 0;
		}
		$column = sanitize_key( $column );

		$suppress = $wpdb->suppress_errors();
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table validated against allowlist, column sanitized.
		$id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}{$table} WHERE {$column} = %s", $value ) );
		if ( 0 === $id ) {
			$wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}{$table} ({$column}) VALUES (%s) ON DUPLICATE KEY UPDATE ID = LAST_INSERT_ID(ID)", $value ) );
			$created = 1 === $wpdb->rows_affected;
			$id      = (int) $wpdb->insert_id;
			if ( 0 === $id ) {
				$wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}{$table} ({$column}) VALUES (%s) ON DUPLICATE KEY UPDATE ID = LAST_INSERT_ID(ID)", $value ) );
				$created = 1 === $wpdb->rows_affected;
				$id      = (int) $wpdb->insert_id;
			}
		}
        // phpcs:enable
		$wpdb->suppress_errors( $suppress );

		return $id;
	}

	/**
	 * Resolve a uid string to its dictionary id in burst_uids, creating the
	 * dictionary row on first sight (see resolve_dictionary_id() for the
	 * concurrency and retry semantics). Returns 0 when the uid is empty or the
	 * dictionary table is not available yet.
	 */
	protected function resolve_uid_id( string $uid ): int {
		static $cache = [];
		if ( '' === $uid ) {
			return 0;
		}
		$blog_id = get_current_blog_id();
		if ( isset( $cache[ $blog_id ][ $uid ] ) ) {
			return $cache[ $blog_id ][ $uid ];
		}

		$created = false;
		$id      = $this->resolve_dictionary_id( 'burst_uids', 'uid', $uid, $created );
		if ( $created && $id > 0 ) {
			self::$uids_created_this_request[ $blog_id ][ $uid ] = true;
		}

		if ( $id > 0 ) {
			$cache[ $blog_id ][ $uid ] = $id;
		}
		return $id;
	}

	/**
	 * Whether resolve_uid_id() created the dictionary row for this uid during
	 * the current request — i.e. this request carries the visitor's first hit
	 * ever. Concurrent first hits converge on one winner (see resolve_uid_id).
	 */
	protected function uid_created_this_request( string $uid ): bool {
		return isset( self::$uids_created_this_request[ get_current_blog_id() ][ $uid ] );
	}

	/**
	 * Resolve a page_url to its dictionary id in burst_page_urls, creating the
	 * row on first sight — the page counterpart of resolve_uid_id(). Used by
	 * the tracker to replace page_id = 0 (URLs that resolve to no post:
	 * homepage-as-archive, blog page, category/search pages) with a stable
	 * NEGATIVE id (-dictionary ID), so page queries can group on the integer
	 * page_id column without a 0-bucket. Returns 0 when the url is empty or
	 * the dictionary is not available yet. Concurrency and deadlock-retry
	 * semantics live in resolve_dictionary_id().
	 */
	protected function resolve_page_url_id( string $page_url ): int {
		static $cache = [];
		if ( '' === $page_url ) {
			return 0;
		}
		$blog_id = get_current_blog_id();
		if ( isset( $cache[ $blog_id ][ $page_url ] ) ) {
			return $cache[ $blog_id ][ $page_url ];
		}

		$id = $this->resolve_dictionary_id( 'burst_page_urls', 'page_url', $page_url );

		if ( $id > 0 ) {
			$cache[ $blog_id ][ $page_url ] = $id;
		}
		return $id;
	}

	/**
	 * The page_id to store for a hit that arrived with page_id 0: the WP post
	 * id the dictionary already knows for this url (so the hit joins that
	 * post's bucket — the same url must never split across a positive and a
	 * negative id), or else the negative dictionary id. Mirrors the
	 * IF(d.page_id > 0, d.page_id, -d.ID) rule of the page_id backfill.
	 * Returns 0 when the url is empty or the dictionary is not available yet.
	 */
	protected function resolve_page_id( string $page_url ): int {
		static $cache = [];
		if ( '' === $page_url ) {
			return 0;
		}
		$blog_id = get_current_blog_id();
		if ( isset( $cache[ $blog_id ][ $page_url ] ) ) {
			return $cache[ $blog_id ][ $page_url ];
		}

		global $wpdb;
		$suppress = $wpdb->suppress_errors();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT ID, page_id FROM {$wpdb->prefix}burst_page_urls WHERE page_url = %s", $page_url ), ARRAY_A );
		$wpdb->suppress_errors( $suppress );

		if ( is_array( $row ) ) {
			$page_id = (int) $row['page_id'] > 0 ? (int) $row['page_id'] : - (int) $row['ID'];
		} else {
			$dictionary_id = $this->resolve_page_url_id( $page_url );
			$page_id       = $dictionary_id > 0 ? -$dictionary_id : 0;
		}

		if ( 0 !== $page_id ) {
			$cache[ $blog_id ][ $page_url ] = $page_id;
		}
		return $page_id;
	}

	/**
	 * Point the canonical dictionary row for a post id at the given url path:
	 * the row for that url is created or claimed and flagged canonical, any
	 * previous canonical row of the same post id is demoted. Shared by the
	 * save_post sync, the weekly sweep and the read-path self-heal in
	 * Statistics_Query::hydrate_page_url_rows(). Callers guarantee the path is
	 * a real permalink path (viewable post, no query-string permalink) — a
	 * "/" from a ?p=N permalink would re-assign the homepage row.
	 *
	 * Claiming a row that had no post id yet also re-keys the hits stored
	 * under its negative dictionary id to the post id: the tracker assigns
	 * -ID to hits that arrive with page_id 0 while the row has no post id
	 * (see resolve_page_id()), and hits carrying the post id from the page's
	 * body attribute land under +post_id at the same time. Both hydrate to
	 * the same url, so without the merge the page shows up twice in every
	 * page table. The merge is bounded per call; the weekly sweep finishes
	 * any remainder (see merge_negative_page_id_hits()).
	 *
	 * @param int    $page_id WP post id.
	 * @param string $path    Current permalink path.
	 */
	protected function set_canonical_page_url( int $page_id, string $path ): void {
		global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing = $wpdb->get_row(
			$wpdb->prepare( "SELECT ID, page_id FROM {$wpdb->prefix}burst_page_urls WHERE page_url = %s", $path ),
			ARRAY_A
		);
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$wpdb->prefix}burst_page_urls (page_url, page_id, is_canonical)
				VALUES (%s, %d, 1)
				ON DUPLICATE KEY UPDATE page_id = VALUES(page_id), is_canonical = 1, ID = LAST_INSERT_ID(ID)",
				$path,
				$page_id
			)
		);
		$row_id = (int) $wpdb->insert_id;
		if ( $row_id > 0 ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_page_urls SET is_canonical = 0 WHERE page_id = %d AND ID != %d AND is_canonical = 1",
					$page_id,
					$row_id
				)
			);
		}
        // phpcs:enable

		// A row that existed without a post id may hold hits under -ID.
		if ( $row_id > 0 && is_array( $existing ) && (int) $existing['page_id'] <= 0 ) {
			$this->merge_negative_page_id_hits( $row_id, $page_id );
		}
	}

	/**
	 * Re-key the hits stored under a dictionary row's negative id to the post
	 * id the row now carries, so one url no longer splits over two page_id
	 * buckets. Chunked (small transactions on a busy table) and capped per
	 * call, so a claim from a dashboard request (the hydration self-heal)
	 * stays bounded; the weekly canonical sweep calls this for every
	 * canonical row and converges any remainder. Indexed by
	 * (page_id, page_type); a no-op costs one indexed lookup.
	 *
	 * @param int $dictionary_id burst_page_urls.ID of the claimed row.
	 * @param int $page_id       WP post id the hits move to.
	 * @return bool True when no hits remain under the negative id.
	 */
	protected function merge_negative_page_id_hits( int $dictionary_id, int $page_id ): bool {
		global $wpdb;
		if ( $dictionary_id <= 0 || $page_id <= 0 ) {
			return true;
		}
		$chunk      = 5000;
		$max_chunks = (int) apply_filters( 'burst_merge_page_id_max_chunks', 40 );
		for ( $i = 0; $i < $max_chunks; $i++ ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$affected = $wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_statistics SET page_id = %d WHERE page_id = %d LIMIT %d",
					$page_id,
					-$dictionary_id,
					$chunk
				)
			);
			if ( false === $affected || (int) $affected < $chunk ) {
				return false !== $affected;
			}
		}
		return false;
	}

	/**
	 * Page types of archive pages: their queried object is a term, a
	 * user or a post type, never a post, so hits on them must carry a
	 * negative dictionary id — a positive one would be a term/user id
	 * colliding with the post id key space. The frontend identifier reports
	 * 0 for these (Frontend::get_current_page_identifier()); the 3.7.1 repair
	 * task rewrites the historic rows that stored the queried object id.
	 *
	 * @return string[]
	 */
	protected function archive_page_types(): array {
		return [ 'category', 'tag', 'tax', 'author', 'archive' ];
	}

	/**
	 * The permalink path to store as a post's canonical url, or '' when the
	 * post must not get one: non-viewable post types (product variations,
	 * form/field-group post types) and non-viewable statuses (draft, pending,
	 * future, trash, private) get a query-only permalink (?p=N) whose path is
	 * "/", and writing that would re-assign the homepage dictionary row to
	 * that post. Plain-permalink sites (?p=N for everything) are excluded the
	 * same way. Deleted posts return '' as well, so their last known url
	 * stays the display url.
	 *
	 * @param int $post_id WP post id.
	 */
	protected function canonical_page_path( int $post_id ): string {
		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post ) {
			return '';
		}
		if ( ! is_post_type_viewable( $post->post_type ) || ! is_post_status_viewable( $post->post_status ) ) {
			return '';
		}
		$permalink = get_permalink( $post );
		if ( ! is_string( $permalink ) || '' !== (string) wp_parse_url( $permalink, PHP_URL_QUERY ) ) {
			return '';
		}
		return (string) wp_parse_url( $permalink, PHP_URL_PATH );
	}

	/**
	 * Whether the page dictionary is complete enough to group page queries on
	 * statistics.page_id: the historic page_id = 0 rows are backfilled with
	 * negative dictionary ids and the dictionary carries the canonical-url
	 * flag. Until then page queries keep grouping on the page_url string.
	 * Cached per blog: each blog migrates independently.
	 */
	protected function page_dictionary_ready(): bool {
		// Structural probe on top of the central completeness check: a deploy
		// without a version bump never re-runs the table init, and grouping on
		// page_id without its covering index is slower than the old page_url
		// grouping. The index is created by the same install hook as the
		// dictionary columns, so one probe covers both.
		return $this->db_upgrades_complete() && $this->page_grain_index_exists();
	}

	/**
	 * The plugin version whose table init created the current tracking write
	 * set: statistics.uid_id / max_scroll / dwell_zones and sessions.uid_id /
	 * start_time. Bump this when a release adds columns the tracker writes
	 * unconditionally, so the hot path keeps the legacy write set until that
	 * release's table init has run. A method rather than a trait constant:
	 * the beacon (endpoint.php, SHORTINIT) runs on PHP 8.0.
	 */
	private function tracking_schema_version(): string {
		return '3.7.0';
	}

	/**
	 * Whether the table init for the current tracking write set has run on
	 * this blog — the hot-path gate for WHICH columns the tracker writes.
	 * Reads only the autoloaded burst-current-version option (set by
	 * Upgrade::check_upgrade() right after run_table_init_hook()), so it costs
	 * no query on the beacon, unlike the information_schema probe behind
	 * uid_id_active(). Until the init has run (the window between the plugin
	 * files landing and the first admin/cron request) the tracker writes the
	 * pre-3.7.0 column set, so no insert names a column that does not exist
	 * yet.
	 *
	 * Note that this flips at the table init, NOT at the finalize ALTER: from
	 * the init on, the tracker writes uid_id only (see Tracking::track_hit()
	 * for why the legacy string is not dual-written). The backfill converges
	 * on the historic rows in the background.
	 *
	 * No stored version at all means a fresh install that has never run an
	 * upgrade: its tables were created by this build (activation), so the
	 * current write set applies — the legacy uid column never existed there.
	 */
	protected function tracking_schema_current(): bool {
		static $current = [];
		$blog_id        = get_current_blog_id();
		if ( ! isset( $current[ $blog_id ] ) ) {
			$stored              = (string) get_option( 'burst-current-version', '' );
			$current[ $blog_id ] = '' === $stored || version_compare( $stored, $this->tracking_schema_version(), '>=' );
		}
		return $current[ $blog_id ];
	}

	/**
	 * Whether the uid dictionary holds every historic visitor, so "dictionary
	 * row created in this request" means "first visit ever". While the seed
	 * task is still inserting historic uids, a returning visitor's row can be
	 * created by their hit before the seed reaches it, so the tracker must not
	 * flag first_time_visit yet (the finalize step backstops that window with
	 * one bounded sweep). Only reads the non-autoloaded task option while an
	 * upgrade is pending (see has_pending_db_upgrade()), so a finished install
	 * pays nothing on the hot path.
	 */
	protected function uid_dictionary_seeded(): bool {
		if ( ! $this->tracking_schema_current() ) {
			return false;
		}
		if ( ! $this->has_pending_db_upgrade() ) {
			return true;
		}
		return ! get_option( 'burst_db_upgrade_seed_uid_dictionary' );
	}

	/**
	 * Autoloaded flag: at least one DB-upgrade task has been armed and the
	 * dispatcher has not yet reported all tasks (free and pro) complete. Set by
	 * arm_db_upgrade(), cleared by DB_Upgrade::upgrade() once free and pro
	 * progress both reach 100%. Lets the read paths skip the per-slug option
	 * loop in db_upgrades_complete() (one non-autoloaded SELECT per registered
	 * slug, on every request, forever) on a finished install.
	 */
	protected function has_pending_db_upgrade(): bool {
		return (bool) get_option( 'burst_has_db_upgrade', false );
	}

	/**
	 * Arm a DB-upgrade task for the dispatcher: the task option itself (not
	 * autoloaded — read only by the dispatcher and, while pending, by the
	 * read paths) plus the autoloaded pending flag. The single entry point for
	 * arming tasks, so the flag cannot be forgotten: version upgrades, Pro
	 * activation, archive restores and the dispatcher's own follow-up tasks
	 * all go through here.
	 *
	 * @param string $slug Task slug, without the burst_db_upgrade_ prefix.
	 */
	protected function arm_db_upgrade( string $slug ): void {
		update_option( "burst_db_upgrade_{$slug}", true, false );
		update_option( 'burst_has_db_upgrade', true );
	}

	/**
	 * Central migration-state check for the read paths: the stored plugin
	 * version is current (so the upgrade routine — including the table init —
	 * has run for this build) and the DB-upgrade dispatcher has no pending
	 * registered tasks (armed on upgrade, deleted on completion — the
	 * dispatcher's own source of truth, unlike the iteration cron event which
	 * can linger when done or be missing while tasks are pending). Only slugs
	 * in the registry count, so stray burst_db_upgrade_* state flags never
	 * disable the fast paths. The per-slug option loop only runs while the
	 * autoloaded pending flag is set (see has_pending_db_upgrade()); a
	 * finished install answers from autoloaded options alone. Cached for a
	 * minute per blog.
	 *
	 * NOT for write-format decisions: tracking_schema_current() gates which
	 * columns the tracker writes and flips at the table init, while the
	 * pipeline tasks (backfills, finalize, page backfill) are still pending —
	 * gating writes on "everything done" would keep the legacy write set for
	 * the whole migration.
	 */
	protected function db_upgrades_complete(): bool {
		$blog_id   = get_current_blog_id();
		$cache_key = "burst_db_upgrades_complete_{$blog_id}";
		$found     = false;
		$cached    = wp_cache_get( $cache_key, 'burst', false, $found );
		if ( $found ) {
			return (bool) $cached;
		}

		$current  = defined( 'BURST_VERSION' ) ? BURST_VERSION : '';
		$version  = (string) get_option( 'burst-current-version' );
		$complete = '' !== $current && version_compare( $version, $current, '>=' );

		if ( $complete && $this->has_pending_db_upgrade() ) {
			// Only registered task slugs count as "a pending upgrade". Other
			// burst_db_upgrade_* options are state flags (e.g. ecommerce
			// activation) or orphaned leftovers from removed features; a
			// blanket LIKE scan would let one of those disable every fast path
			// forever. The dispatcher's own registry is the source of truth.
			foreach ( ( new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->get_all_upgrade_slugs() as $slug ) {
				if ( get_option( "burst_db_upgrade_{$slug}" ) ) {
					$complete = false;
					break;
				}
			}
		}

		// Short TTL: without a persistent object cache this is per-request;
		// with one, a completed migration reaches all requests within a minute.
		wp_cache_set( $cache_key, $complete ? 1 : 0, 'burst', MINUTE_IN_SECONDS );
		return $complete;
	}

	/**
	 * The uid_id index column sets on burst_statistics — the single source of
	 * truth shared by the installer (install_statistics_table()), the finalize
	 * step of the uid migration (which builds them in one combined ALTER) and
	 * the readiness probes. Index names derive from these columns via
	 * index_name_for_columns(), so a change here changes the definition and
	 * the name everywhere at once.
	 *
	 * - (time, uid_id) / (uid_id, time): range and per-visitor lookups.
	 * - (time, page_url, uid_id): covering index for the DataTable aggregation
	 *   (GROUP BY page_url + COUNT(DISTINCT uid_id) over a time range) —
	 *   index-only scan instead of reading the wide clustered rows with their
	 *   TEXT columns. @todo drop once every page query groups/filters on
	 *   page_id — the page-grain covering index then fully replaces it.
	 * - (time, page_id, uid_id): the page-grain covering index, see
	 *   page_grain_index_columns().
	 *
	 * @return array<int, array<int, string>>
	 */
	protected function uid_id_index_columns(): array {
		return [
			[ 'time', 'uid_id' ],
			[ 'uid_id', 'time' ],
			[ 'time', 'page_url', 'uid_id' ],
			$this->page_grain_index_columns(),
		];
	}

	/**
	 * Column set of the page-grain covering index: page aggregations group on
	 * the 4-byte page_id instead of the varchar url (see Page_Url_Metric) —
	 * index rows shrink ~10-30x. One of uid_id_index_columns().
	 *
	 * @return array<int, string>
	 */
	protected function page_grain_index_columns(): array {
		return [ 'time', 'page_id', 'uid_id' ];
	}

	/**
	 * The index name add_index() produces for a column set: columns joined by
	 * underscores plus '_index'. The naming counterpart of
	 * uid_id_index_columns(), used wherever an index is probed or built by
	 * name so names can never drift from their definitions.
	 *
	 * @param array<int, string> $columns Column names.
	 */
	protected function index_name_for_columns( array $columns ): string {
		return implode( '_', array_map( 'sanitize_key', $columns ) ) . '_index';
	}

	/**
	 * Whether the (time, page_id, uid_id) covering index exists on statistics.
	 * Grouping on page_id without it is SLOWER than the old page_url grouping
	 * (which has its own covering index), so the query switch refuses to
	 * activate until the index is there — e.g. on a site where the table init
	 * has not re-run because the plugin version did not change. Memoized per
	 * request: SHOW INDEX is uncached, and every datatable/data request that
	 * builds a page query would otherwise repeat it.
	 */
	private function page_grain_index_exists(): bool {
		static $exists = [];
		$blog_id       = get_current_blog_id();
		if ( ! isset( $exists[ $blog_id ] ) ) {
			$exists[ $blog_id ] = $this->index_exists( 'burst_statistics', $this->index_name_for_columns( $this->page_grain_index_columns() ) );
		}
		return $exists[ $blog_id ];
	}

	/**
	 * Whether the database supports window functions and CTEs
	 * (MySQL 8.0.2+ / MariaDB 10.2+). MariaDB versions that report a 5.5.5-
	 * prefixed version string on older PHP parse as unsupported, which safely
	 * falls back to the untrimmed query path.
	 */
	protected function supports_window_functions(): bool {
		static $supported = null;
		if ( null !== $supported ) {
			return $supported;
		}
		global $wpdb;
		$is_mariadb = stripos( $wpdb->db_server_info(), 'mariadb' ) !== false;
		$supported  = $is_mariadb
			? version_compare( $wpdb->db_version(), '10.2', '>=' )
			: version_compare( $wpdb->db_version(), '8.0.2', '>=' );
		return $supported;
	}

	/**
	 * Whether the database supports the JSON functions used by the scroll
	 * analytics aggregate (JSON_VALID / JSON_EXTRACT / JSON_UNQUOTE): MySQL
	 * 5.7.8+ or MariaDB 10.2.3+.
	 */
	protected function supports_json_functions(): bool {
		static $supported = null;
		if ( null !== $supported ) {
			return $supported;
		}
		global $wpdb;
		$is_mariadb = stripos( $wpdb->db_server_info(), 'mariadb' ) !== false;
		$supported  = $is_mariadb
			? version_compare( $wpdb->db_version(), '10.2.3', '>=' )
			: version_compare( $wpdb->db_version(), '5.7.8', '>=' );
		return $supported;
	}

	/**
	 * Check if table name is valid
	 */
	protected function validate_table_name( string $table_name ): string {
		$table_name = sanitize_key( $table_name );
		if ( ! in_array( $table_name, $this->get_table_list(), true ) ) {
			self::error_log( "Table $table_name does not exist in predefined list." );
			return '';
		}
		return $table_name;
	}

	/**
	 * Check if table exists
	 * $table should include the burst prefix, but not the WordPress prefix. E.g. burst_sessions.
	 */
	protected function table_exists( string $table ): bool {
		global $wpdb;
		$table = $this->validate_table_name( $table );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated against known whitelist above.
		return (bool) $wpdb->query( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->prefix . $table ) );
	}

	/**
	 * Check if a table has a specific column
	 * pass the table name without WordPress (wp_) prefix, but with burst prefix.
	 * Probes information_schema instead of DESC: a missing table then simply
	 * returns no rows instead of generating a database error — schema probes
	 * run from cron hooks that can fire before the table install (re)creates
	 * the tables (e.g. right after a reactivation), and nothing is suppressed,
	 * so real database errors keep reaching the debug log.
	 */
	protected function column_exists( string $table_name, string $column_name ): bool {
		global $wpdb;
		$table_name = $this->validate_table_name( $table_name );
		if ( '' === $table_name ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$column = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s',
				$wpdb->prefix . $table_name,
				$column_name
			)
		);
		return null !== $column;
	}

	/**
	 * Check if a table has a named index.
	 * Pass the table name without WordPress (wp_) prefix, but with burst prefix.
	 * Indexes added through add_index() are named `{columns}_index` (columns joined by underscores).
	 */
	protected function index_exists( string $table_name, string $index_name ): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . $this->validate_table_name( $table_name );
		$index_name = esc_sql( $index_name );

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated, index name escaped.
		$result = $wpdb->get_results( $wpdb->prepare( "SHOW INDEX FROM $table_name WHERE Key_name = %s", $index_name ) );
		return ! empty( $result );
	}

	/**
	 * Get array of Burst Tables.
	 */
	private function get_table_list(): array {
		return apply_filters(
			'burst_all_tables',
			[
				'burst_statistics',
				'burst_sessions',
				'burst_locations',
				'burst_goals',
				'burst_goal_statistics',
				'burst_browsers',
				'burst_browser_versions',
				'burst_platforms',
				'burst_devices',
				'burst_referrers',
				'burst_uids',
				'burst_page_urls',
				'burst_visitor_bitmaps',
				'burst_query_stats',
				'burst_searches',
				'burst_statistics_searches',
				'burst_search_terms',
			],
		);
	}

	/**
	 * Adds an index to a database table if it doesn't already exist.
	 *
	 * Attempts to create a database index with proper error handling. If an index already exists
	 * with the same name, it will skip the operation. If the index creation fails due to key length,
	 * it will retry with a reduced key length.
	 *
	 * @param string $table_name The table to add the index to (without prefix).
	 * @param array  $indexes Array of column names to include in the index.
	 */
	protected function add_index( string $table_name, array $indexes ): void {
		global $wpdb;
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$indexes      = array_map( 'sanitize_key', $indexes );
		$index        = esc_sql( implode( ', ', $indexes ) );
		$index_name   = esc_sql( $this->index_name_for_columns( $indexes ) );
		$index_exists = $this->index_exists( $table_name, $index_name );
		$table_name   = $wpdb->prefix . $this->validate_table_name( $table_name );

		if ( ! $index_exists ) {
			$sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index)";
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared --called with predefined table names, and sanitized above.
			$wpdb->query( $sql );

			if ( $wpdb->last_error ) {
				// Skip reporting duplicate key errors as they're not actual errors.
				if ( str_contains( $wpdb->last_error, 'Duplicate key name' ) ) {
					return;
				}

				self::error_log( "Error creating index $index_name in $table_name: " . $wpdb->last_error );
				// If the error is about key length, try with reduced length.
				if ( str_contains( $wpdb->last_error, 'Specified key was too long' ) ) {
					// Remove the original index.
					$drop_sql = "ALTER TABLE $table_name DROP INDEX $index_name";
                    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared --called with predefined table names, and sanitized above.
					$wpdb->query( $drop_sql );

					// Try with reduced length.
                    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared --called with predefined table names, and sanitized above.
					$reduced_sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index(100))";
                    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared --called with predefined table names, and sanitized above.
					$wpdb->query( $reduced_sql );
					// Ignore phpstan error for the last_error check.
					// @phpstan-ignore-next-line.
					if ( $wpdb->last_error ) {
						// Skip duplicate key errors on retry as well.
						// @phpstan-ignore-next-line.
						if ( str_contains( $wpdb->last_error, 'Duplicate key name' ) ) {
							return;
						}
						self::error_log( 'Error creating reduced length sessions index: ' . $wpdb->last_error );
					}
				}
			}
		}
	}

	/**
	 * Drops a named index from a table when it exists.
	 *
	 * Indexes added through add_index() are named `{columns}_index` (columns
	 * joined by underscores, sanitized with sanitize_key). Pass that exact name.
	 *
	 * @param string $table_name The table to drop the index from (without prefix).
	 * @param string $index_name The index name to drop.
	 */
	protected function drop_index( string $table_name, string $index_name ): void {
		global $wpdb;
		if ( ! $this->user_can_manage() ) {
			return;
		}

		if ( ! $this->index_exists( $table_name, $index_name ) ) {
			return;
		}
		$table_name = $wpdb->prefix . $this->validate_table_name( $table_name );
		$index_name = esc_sql( $index_name );

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated, index name escaped.
		$wpdb->query( "ALTER TABLE $table_name DROP INDEX $index_name" );
		if ( $wpdb->last_error ) {
			self::error_log( "Error dropping index $index_name from $table_name: " . $wpdb->last_error );
		}
	}

	/**
	 * Acquire the table install/upgrade lock, following the WP_Upgrader::create_lock()
	 * pattern: the unique key on option_name makes the INSERT atomic, so exactly one
	 * of several concurrent requests wins. A get/set transient check is not atomic —
	 * parallel requests would both pass it and run dbDelta/ALTER concurrently,
	 * filling debug.log with duplicate column/key errors.
	 *
	 * @return bool True when the lock was acquired (or taken over from a crashed run).
	 */
	protected function acquire_upgrade_lock(): bool {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- add_option() is not atomic (ON DUPLICATE KEY UPDATE), INSERT IGNORE is.
		$acquired = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO `{$wpdb->options}` ( `option_name`, `option_value`, `autoload` ) VALUES (%s, %s, 'off')",
				'burst_upgrade_process_lock',
				(string) time()
			)
		);

		if ( $acquired ) {
			return true;
		}

		if ( $this->upgrade_lock_active() ) {
			return false;
		}

		// Stale lock from a crashed run: take it over.
		update_option( 'burst_upgrade_process_lock', (string) time(), false );
		return true;
	}

	/**
	 * Whether a request currently holds a non-stale install/upgrade lock. A lock
	 * older than a minute is considered left behind by a crashed run.
	 */
	protected function upgrade_lock_active(): bool {
		$locked_at = (int) get_option( 'burst_upgrade_process_lock' );
		return $locked_at > time() - MINUTE_IN_SECONDS;
	}

	/**
	 * Release the table install/upgrade lock.
	 */
	protected function release_upgrade_lock(): void {
		delete_option( 'burst_upgrade_process_lock' );
	}

	/**
	 * Normalize an external URL for consistent storage and lookup.
	 *
	 * - Strips fragments (#…) before sanitization.
	 * - Lowercases the host (RFC 3986 §3.2.2 — host is case-insensitive).
	 * - Appends a trailing slash when there is no query string and the last
	 *   path segment has no file extension, so scraper and tracker always
	 *   store/look up the same string.
	 *
	 * @param string $url The raw URL to normalize.
	 * @return string The normalized URL, or an empty string when invalid.
	 */
	protected static function normalize_external_url( string $url ): string {
		$url = trim( $url );
		if ( empty( $url ) ) {
			return '';
		}

		// Strip fragment but leave query strings intact.
		// /#[^?]*$/ stops at '?' so encoded '#' in query values is unaffected.
		$url = (string) preg_replace( '/#[^?]*$/', '', $url );

		$url = esc_url_raw( $url );
		if ( empty( $url ) ) {
			return '';
		}

		$parsed = wp_parse_url( $url );
		if ( empty( $parsed['host'] ) ) {
			return '';
		}

		// Lowercase the host to prevent duplicate rows for mixed-case hostnames.
		$url = str_replace( $parsed['host'], strtolower( $parsed['host'] ), $url );

		// Add trailing slash when there is no query string and the last path
		// segment has no file extension. Use basename + strrchr instead of
		// pathinfo() to avoid false positives on version numbers like /v2.1/.
		if ( empty( $parsed['query'] ) ) {
			$path      = $parsed['path'] ?? '/';
			$last_seg  = basename( $path );
			$extension = strpos( $last_seg, '.' ) !== false
				? ltrim( (string) strrchr( $last_seg, '.' ), '.' )
				: '';

			if ( '' === $extension ) {
				$url = trailingslashit( $url );
			}
		}

		return $url;
	}
}
