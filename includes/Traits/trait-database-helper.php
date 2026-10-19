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
	 * Cap the execution time of a SELECT (or WITH ... SELECT) statement.
	 *
	 * MySQL gets the MAX_EXECUTION_TIME optimizer hint, which it only honours
	 * on the top-level query block: for a WITH statement that is the main
	 * SELECT after the CTE list — a hint on a SELECT inside WITH is silently
	 * ignored. MariaDB before 12.0 does not implement the hint at all (it
	 * parses it as a plain comment, so the query runs unbounded); it gets a
	 * per-statement max_statement_time (seconds, MariaDB 10.1+) prefix
	 * instead, which Query_Executor::is_timeout_error() recognizes.
	 */
	protected function add_query_timeout_hint( string $sql, int $timeout_ms ): string {
		if ( $timeout_ms <= 0 ) {
			return $sql;
		}

		if ( stripos( $sql, 'MAX_EXECUTION_TIME(' ) !== false || stripos( $sql, 'max_statement_time' ) !== false ) {
			return $sql;
		}

		if ( 1 !== preg_match( '/^\s*(SELECT|WITH)\s+/i', $sql, $matches, PREG_OFFSET_CAPTURE ) ) {
			return $sql;
		}

		if ( $this->is_mariadb() ) {
			return sprintf( 'SET STATEMENT max_statement_time=%.3F FOR ', $timeout_ms / 1000 ) . ltrim( $sql );
		}

		$offset = 'SELECT' === strtoupper( $matches[1][0] ) ? $matches[1][1] : $this->find_top_level_select_offset( $sql );
		if ( null === $offset ) {
			return $sql;
		}

		return substr( $sql, 0, $offset ) . sprintf( 'SELECT /*+ MAX_EXECUTION_TIME(%d) */', $timeout_ms ) . substr( $sql, $offset + 6 );
	}

	/**
	 * Byte offset of the first SELECT keyword outside parentheses and quoted
	 * strings: the statement's own SELECT, or the main SELECT after a WITH
	 * clause's CTE list. Null when there is none.
	 *
	 * @param string $sql SQL statement.
	 */
	private function find_top_level_select_offset( string $sql ): ?int {
		$depth  = 0;
		$quote  = '';
		$length = strlen( $sql );
		for ( $i = 0; $i < $length; $i++ ) {
			$char = $sql[ $i ];
			if ( '' !== $quote ) {
				if ( '\\' === $char ) {
					++$i;
				} elseif ( $char === $quote ) {
					$quote = '';
				}
				continue;
			}
			if ( "'" === $char || '"' === $char || '`' === $char ) {
				$quote = $char;
			} elseif ( '(' === $char ) {
				++$depth;
			} elseif ( ')' === $char ) {
				--$depth;
			} elseif ( 0 === $depth
				&& 0 === substr_compare( $sql, 'SELECT', $i, 6, true )
				&& ( 0 === $i || 1 !== preg_match( '/\w/', $sql[ $i - 1 ] ) )
				&& ( $i + 6 >= $length || 1 !== preg_match( '/\w/', $sql[ $i + 6 ] ) )
			) {
				return $i;
			}
		}
		return null;
	}

	/**
	 * Whether the connected database server is MariaDB.
	 */
	protected function is_mariadb(): bool {
		static $is_mariadb = null;
		if ( null === $is_mariadb ) {
			global $wpdb;
			$is_mariadb = stripos( (string) $wpdb->db_server_info(), 'mariadb' ) !== false;
		}
		return $is_mariadb;
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
		// which itself must directly follow SELECT — and, on MariaDB, the
		// optional SET STATEMENT ... FOR timeout prefix.
		return preg_replace( '/^(\s*(?:SET\s+STATEMENT\s+\S+\s+FOR\s+)?SELECT\s+(?:\/\*\+.*?\*\/\s*)?)/is', '$1SQL_BIG_RESULT ', $sql, 1 ) ?? $sql;
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
	 * - the legacy varchar uid column is absent (fresh install, or the 3.7.3
	 *   drop has run), or
	 * - the uid_id indexes exist — the finalize step creates them right after
	 *   the backfill, and nothing else does on a migrating install (the
	 *   installer only adds them once this check is already true).
	 *
	 * The finalize step deliberately does NOT alter the legacy column (making
	 * it nullable would be a full table rebuild); the column stays NOT NULL
	 * until 3.7.3 drops it, and the tracker no longer writes it (MySQL's
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
	 * i.e. this blog was installed before 3.7.0 and the 3.7.3 drop has not run.
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
	 * Cache key for a uid's dictionary id in burst_uids.
	 *
	 * Uses sha256 to avoid collisions and keep cache keys within safe limits.
	 *
	 * @param string $uid The visitor uid string.
	 * @return string Cache key for wp_cache.
	 */
	protected static function uid_id_cache_key( string $uid ): string {
		$blog_id    = get_current_blog_id();
		$generation = self::db_cache_generation();
		return "burst_uid_id_lookup_{$blog_id}_{$generation}_" . hash( 'sha256', $uid );
	}

	/**
	 * Generation token that prefixes the persistent table_exists() and
	 * resolve_uid_id() cache keys of the current blog. The object cache API
	 * cannot delete keys by prefix, so a flush of all entries swaps the token
	 * instead: every old key becomes unreachable and expires on its TTL. An
	 * evicted token is simply replaced, which only costs a cache miss.
	 * random_int() rather than wp_rand(): pluggable.php is not loaded on the
	 * SHORTINIT beacon.
	 *
	 * @return string The current generation token.
	 */
	protected static function db_cache_generation(): string {
		$key        = 'burst_db_cache_generation_' . get_current_blog_id();
		$generation = wp_cache_get( $key, 'burst' );
		if ( false === $generation ) {
			$generation = (string) random_int( 1, PHP_INT_MAX );
			// add() rather than set(): a concurrent request that created the token first wins, so both use the same keys.
			if ( ! wp_cache_add( $key, $generation, 'burst' ) ) {
				$generation = wp_cache_get( $key, 'burst' );
			}
		}
		return (string) $generation;
	}

	/**
	 * Invalidate all persistent table_exists() and resolve_uid_id() entries of
	 * the current blog. Side effect: replaces the cache generation token.
	 */
	protected static function bump_db_cache_generation(): void {
		wp_cache_set( 'burst_db_cache_generation_' . get_current_blog_id(), (string) random_int( 1, PHP_INT_MAX ), 'burst' );
	}

	/**
	 * Drop the cached dictionary id of a uid, or of all uids. Call it after
	 * burst_uids rows are deleted or the table is emptied: TRUNCATE resets the
	 * auto-increment, so a stale cached id would later belong to another visitor.
	 *
	 * @param string|null $uid The visitor uid string, or null to flush all.
	 */
	public static function flush_uid_id_cache( ?string $uid = null ): void {
		$blog_id = get_current_blog_id();
		if ( null !== $uid ) {
			unset(
				self::$uid_dictionary_cache[ $blog_id ][ $uid ],
				self::$uids_created_this_request[ $blog_id ][ $uid ]
			);
			wp_cache_delete( self::uid_id_cache_key( $uid ), 'burst' );
		} else {
			unset(
				self::$uid_dictionary_cache[ $blog_id ],
				self::$uids_created_this_request[ $blog_id ]
			);
			self::bump_db_cache_generation();
		}
	}

	/**
	 * Per-request memo for resolve_uid_id(), per blog: the ID in burst_uids.
	 *
	 * @var array<int, array<string, int>>
	 */
	protected static array $uid_dictionary_cache = [];

	/**
	 * Resolve a uid string to its dictionary id in burst_uids, creating the
	 * dictionary row on first sight (see resolve_dictionary_id() for the
	 * concurrency and retry semantics). Returns 0 when the uid is empty or the
	 * dictionary table is not available yet.
	 *
	 * Resolved IDs are memoized per request and cached in the object cache so
	 * subsequent hits from the same visitor resolve without touching MySQL.
	 *
	 * @param string $uid The visitor uid string.
	 * @return int The dictionary ID in burst_uids, or 0 when not resolved.
	 */
	protected function resolve_uid_id( string $uid ): int {
		if ( '' === $uid ) {
			return 0;
		}
		$blog_id = get_current_blog_id();
		if ( isset( self::$uid_dictionary_cache[ $blog_id ][ $uid ] ) ) {
			return self::$uid_dictionary_cache[ $blog_id ][ $uid ];
		}

		$cache_key = self::uid_id_cache_key( $uid );
		$found     = false;
		$cached    = wp_cache_get( $cache_key, 'burst', false, $found );
		if ( $found && false !== $cached ) {
			$id = (int) $cached;
			if ( $id > 0 ) {
				self::$uid_dictionary_cache[ $blog_id ][ $uid ] = $id;
				return $id;
			}
		}

		$created = false;
		$id      = $this->resolve_dictionary_id( 'burst_uids', 'uid', $uid, $created );
		if ( $created && $id > 0 ) {
			self::$uids_created_this_request[ $blog_id ][ $uid ] = true;
		}

		if ( $id > 0 ) {
			self::$uid_dictionary_cache[ $blog_id ][ $uid ] = $id;
			// Literal TTL (seconds): time constants aren't guaranteed on the SHORTINIT beacon path.
			wp_cache_set( $cache_key, $id, 'burst', 300 );
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
	 * Object-cache key of the resolved page_id for a url path. Hashed: cache
	 * keys have a length limit and paths do not. Not the crc32 of
	 * Tracking::lookup_cache_key(): the url space is large enough for a 32-bit
	 * collision to store a hit under another page's id. sha256 rather than
	 * md5 only because the SAST scan flags md5 wherever it appears; on a path
	 * string the difference in cost is nil.
	 */
	protected function page_id_cache_key( string $page_url ): string {
		return 'burst_page_id_lookup_' . hash( 'sha256', $page_url );
	}

	/**
	 * Drop the cached page_id of a url path. Called when a row's post id
	 * changes outside the tracker (set_canonical_page_url()), so the tracker
	 * stores hits under the new id at once instead of after the cache TTL.
	 */
	protected function flush_page_id_cache( string $page_url ): void {
		unset( self::$page_dictionary_cache[ get_current_blog_id() ][ $page_url ] );
		wp_cache_delete( $this->page_id_cache_key( $page_url ), 'burst' );
	}

	/**
	 * Per-request memo for resolve_page_id(), per blog: the page_id the
	 * dictionary carries for a url path. A class property rather than a
	 * function static so flush_page_id_cache() can drop an entry.
	 *
	 * @var array<int, array<string, int>>
	 */
	protected static array $page_dictionary_cache = [];

	/**
	 * The page_id to store for a create hit — the page counterpart of
	 * Tracking::get_lookup_table_id(): one dictionary row per url, resolved
	 * through a per-request memo and a per-value object cache, created on first
	 * sight.
	 *
	 * A hit that arrived with page_id 0 (a url that resolves to no post:
	 * homepage-as-archive, blog page, category/search pages) gets the WP post
	 * id the dictionary already knows for this url (so the hit joins that
	 * post's bucket — the same url must never split across a positive and a
	 * negative id), or else the negative dictionary id. Mirrors the
	 * IF(d.page_id > 0, d.page_id, -d.ID) rule of the page_id backfill.
	 *
	 * A hit that carries a WP post id keeps it, and makes sure the dictionary
	 * knows the url under that id: page queries display the url from the
	 * dictionary only, so a post first seen after the seed ran (a new product)
	 * must have a row there — the read path cannot derive it from the
	 * permalink, as the REST optimizer leaves plugin post types unregistered
	 * (see Statistics_Query::hydrate_page_url_rows()). The row is not flagged
	 * canonical: a hit url can be a variant (an old slug, comment pagination);
	 * the weekly sweep promotes and refines the canonical row with the real
	 * permalink. A row that already carries a post id keeps it — one url never
	 * flips between posts from the tracker; a slug reassignment goes through
	 * save_post.
	 *
	 * Cost on the beacon (one hit per process, so the memo alone never warms):
	 * a warm object cache resolves a known url without touching the DB; a cold
	 * one pays a single unique-key SELECT. The write runs only on first sight
	 * of a url or when a hit brings a post id the row lacks. Errors are
	 * suppressed: before the 3.7.0 table init the dictionary does not exist
	 * yet and the hit must still be stored.
	 *
	 * @param string $page_url Url path of the hit.
	 * @param int    $page_id  WP post id the hit carries, 0 when it has none.
	 * @return int The page_id to store: positive = WP post id, negative =
	 *             -burst_page_urls.ID, 0 when the url is empty or the
	 *             dictionary is not available yet.
	 */
	protected function resolve_page_id( string $page_url, int $page_id = 0 ): int {
		if ( '' === $page_url ) {
			return 0;
		}
		$blog_id = get_current_blog_id();

		// The dictionary's view of this url: the post id its row carries, or
		// -ID when it has none. Memo first, then the object cache.
		$known = self::$page_dictionary_cache[ $blog_id ][ $page_url ] ?? null;
		if ( null === $known ) {
			$cached = wp_cache_get( $this->page_id_cache_key( $page_url ), 'burst' );
			if ( false !== $cached ) {
				$known = (int) $cached;
				self::$page_dictionary_cache[ $blog_id ][ $page_url ] = $known;
			}
		}

		// Query only for an unknown url, or to give a row without a post id
		// the one this hit carries; a row that has a post id needs nothing.
		if ( null === $known || ( $page_id > 0 && $known < 0 ) ) {
			$known = $this->resolve_page_dictionary_row( $page_url, $page_id );
			if ( 0 !== $known ) {
				self::$page_dictionary_cache[ $blog_id ][ $page_url ] = $known;
				// Literal TTL (seconds): time constants aren't guaranteed on the
				// SHORTINIT beacon path, matching Tracking::get_lookup_table_id().
				wp_cache_set( $this->page_id_cache_key( $page_url ), $known, 'burst', 300 );
			}
		}

		return $page_id > 0 ? $page_id : $known;
	}

	/**
	 * Look up — and on first sight create — the dictionary row of a url path,
	 * returning the page_id the dictionary carries for it: the WP post id when
	 * the row has one, else -ID. A positive $page_id is written to a row that
	 * has none yet, never over an existing post id. SELECT first so the hot
	 * path stays read-only for known urls; the IODKU converges concurrent
	 * first sights on one row (see resolve_dictionary_id() for the pattern).
	 * Returns 0 when the dictionary is not available yet.
	 *
	 * @param string $page_url Url path.
	 * @param int    $page_id  WP post id to record for the url, 0 for none.
	 */
	private function resolve_page_dictionary_row( string $page_url, int $page_id ): int {
		global $wpdb;
		$suppress = $wpdb->suppress_errors();
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row           = $wpdb->get_row( $wpdb->prepare( "SELECT ID, page_id FROM {$wpdb->prefix}burst_page_urls WHERE page_url = %s", $page_url ), ARRAY_A );
		$row_id        = is_array( $row ) ? (int) $row['ID'] : 0;
		$known_page_id = is_array( $row ) ? (int) $row['page_id'] : 0;

		if ( 0 === $row_id || ( $page_id > 0 && $known_page_id <= 0 ) ) {
			$wpdb->query(
				$wpdb->prepare(
					"INSERT INTO {$wpdb->prefix}burst_page_urls (page_url, page_id)
					VALUES (%s, %d)
					ON DUPLICATE KEY UPDATE page_id = IF(page_id > 0, page_id, VALUES(page_id)), ID = LAST_INSERT_ID(ID)",
					$page_url,
					$page_id
				)
			);
			$row_id        = (int) $wpdb->insert_id;
			$known_page_id = $page_id;
			// Anything but a fresh insert met an existing row (created or
			// claimed by a concurrent request, or the row found above): its
			// post id may differ from the one written, so read it back.
			if ( $row_id > 0 && 1 !== $wpdb->rows_affected ) {
				$known_page_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT page_id FROM {$wpdb->prefix}burst_page_urls WHERE ID = %d", $row_id ) );
			}
		}
        // phpcs:enable
		$wpdb->suppress_errors( $suppress );

		if ( 0 === $row_id ) {
			return 0;
		}
		return $known_page_id > 0 ? $known_page_id : -$row_id;
	}

	/**
	 * Resolve tracked post IDs for a batch of page URLs.
	 *
	 * Reads the burst_page_urls dictionary first. While the page_urls backfill
	 * migration is still pending (burst_db_upgrade_backfill_page_urls option is set),
	 * falls back to burst_statistics through Query_Executor for any unresolved URLs.
	 *
	 * @param string[] $page_urls Page URLs from candidate rows.
	 * @return array<string, int> Map of page_url to post ID (0 when unknown).
	 */
	public function get_page_ids_for_urls( array $page_urls ): array {
		$page_urls = array_values( array_unique( array_filter( array_map( 'strval', $page_urls ), static fn( string $url ): bool => '' !== $url ) ) );
		if ( empty( $page_urls ) ) {
			return [];
		}

		global $wpdb;
		$page_id_map = [];

		// 1. Check burst_page_urls dictionary first.
		$placeholders = implode( ', ', array_fill( 0, count( $page_urls ), '%s' ) );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholders dynamically built and values bound.
		$dict_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT page_url, MAX(page_id) AS page_id FROM {$wpdb->prefix}burst_page_urls WHERE page_url IN ( {$placeholders} ) AND page_id > 0 GROUP BY page_url",
				$page_urls
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		foreach ( (array) $dict_rows as $dr ) {
			$page_id_map[ (string) $dr['page_url'] ] = (int) $dr['page_id'];
		}

		// 2. Only run fallback to burst_statistics while burst_db_upgrade_backfill_page_urls is still set.
		$missing_paths = array_values( array_diff( $page_urls, array_keys( $page_id_map ) ) );
		if ( ! empty( $missing_paths ) && (bool) get_option( 'burst_db_upgrade_backfill_page_urls', false ) ) {
			$m_placeholders = implode( ', ', array_fill( 0, count( $missing_paths ), '%s' ) );
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholders dynamically built and values bound.
			$stat_sql = $wpdb->prepare(
				"SELECT page_url, MAX(page_id) AS page_id FROM {$wpdb->prefix}burst_statistics WHERE page_url IN ( {$m_placeholders} ) AND page_id > 0 GROUP BY page_url",
				$missing_paths
			);
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

			$timeout_ms = $this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' );
			$stat_sql   = $this->add_query_timeout_hint( $stat_sql, $timeout_ms );

			if ( class_exists( '\Burst\Admin\Database\Query_Executor' ) ) {
				$stat_rows = \Burst\Admin\Database\Query_Executor::create()
					->fingerprint( 'get_page_ids_for_urls_fallback' )
					->cache_ttl( 300 )
					->cache_group( 'burst_stats_query_results' )
					->run( $stat_sql, 'get', ARRAY_A );
			} else {
				// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
				$stat_rows = $wpdb->get_results( $stat_sql, ARRAY_A );
				// phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
			}

			foreach ( (array) $stat_rows as $sr ) {
				$page_id_map[ (string) $sr['page_url'] ] = (int) $sr['page_id'];
			}
		}

		return $page_id_map;
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
	 * @param int      $page_id          WP post id.
	 * @param string   $path             Current permalink path.
	 * @param int|null $merge_max_chunks Cap on the hit merge for this caller (see merge_negative_page_id_hits()); null = the default.
	 */
	protected function set_canonical_page_url( int $page_id, string $path, ?int $merge_max_chunks = null ): void {
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

		// The tracker caches the page_id per url; the claim changes it.
		$this->flush_page_id_cache( $path );

		// A row that existed without a post id may hold hits under -ID.
		if ( $row_id > 0 && is_array( $existing ) && (int) $existing['page_id'] <= 0 ) {
			$this->merge_negative_page_id_hits( $row_id, $page_id, $merge_max_chunks );
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
	 * @param int      $dictionary_id burst_page_urls.ID of the claimed row.
	 * @param int      $page_id       WP post id the hits move to.
	 * @param int|null $max_chunks    Cap on the 5000-row chunks for this call; null = 40 (200k rows), the sweep's budget. save_post passes a lower cap: an editor save must stay quick, the weekly sweep finishes the rest.
	 * @return bool True when no hits remain under the negative id.
	 */
	protected function merge_negative_page_id_hits( int $dictionary_id, int $page_id, ?int $max_chunks = null ): bool {
		global $wpdb;
		if ( $dictionary_id <= 0 || $page_id <= 0 ) {
			return true;
		}
		$chunk      = 5000;
		$max_chunks = (int) apply_filters( 'burst_merge_page_id_max_chunks', $max_chunks ?? 40 );
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
	 * Delete the given hits, then the sessions those hits left without any hit.
	 *
	 * Deleting by ID guarantees the session cleanup covers exactly the sessions of
	 * the deleted hits, without scanning the whole sessions table.
	 *
	 * @param object[] $hits Rows with an `ID` and a `session_id` property.
	 */
	protected function delete_hits( array $hits ): void {
		$hit_ids     = [];
		$session_ids = [];
		foreach ( $hits as $hit ) {
			if ( (int) $hit->ID > 0 ) {
				$hit_ids[] = (int) $hit->ID;
			}
			if ( (int) $hit->session_id > 0 ) {
				$session_ids[ (int) $hit->session_id ] = true;
			}
		}
		$session_ids = array_keys( $session_ids );
		if ( empty( $hit_ids ) ) {
			return;
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $hit_ids ), '%d' ) );
		$sql          = "DELETE FROM {$wpdb->prefix}burst_statistics WHERE ID IN ($placeholders)";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- placeholders are %d only.
		$wpdb->query( $wpdb->prepare( $sql, ...$hit_ids ) );

		if ( empty( $session_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $session_ids ), '%d' ) );
		$sql          = "DELETE sess FROM {$wpdb->prefix}burst_sessions sess
						LEFT JOIN {$wpdb->prefix}burst_statistics st ON st.session_id = sess.ID
						WHERE sess.ID IN ($placeholders)
						AND st.ID IS NULL";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- placeholders are %d only.
		$wpdb->query( $wpdb->prepare( $sql, ...$session_ids ) );
	}

	/**
	 * Split integer ids into chunks for a literal IN () list. A chunk of 1000
	 * ids stays under ~8 KB of SQL: hosts cap the query length, and WP
	 * Engine's long query governor never runs a query over ~16,000
	 * characters, so wpdb returns no rows and the caller silently loses data
	 * (a 5000-id chunk is ~30,000 characters).
	 *
	 * @param int[] $ids Integer ids.
	 * @return array<int, int[]> Chunks of at most 1000 ids each.
	 */
	protected function chunk_ids_for_in_list( array $ids ): array {
		return array_chunk( array_map( 'intval', $ids ), 1000 );
	}

	/**
	 * Resolve display paths for post ids from the burst_page_urls dictionary.
	 *
	 * Uses the post's canonical row, falling back to the most recently seen
	 * url (a post the weekly sweep has not promoted yet, or a deleted post
	 * that never got a canonical assigned). Chunked IN() lookups against the
	 * small dictionary, never get_permalink(): on burst/v1 REST requests the
	 * optimizer leaves plugin post types unregistered, so permalinks would be
	 * wrong for e.g. WooCommerce products.
	 *
	 * @param int[] $post_ids Positive post ids.
	 * @return array<int, string> Post id => path, only for ids with a dictionary row.
	 */
	protected function get_page_paths_by_post_id( array $post_ids ): array {
		global $wpdb;

		$post_ids = array_values( array_unique( array_filter( array_map( 'intval', $post_ids ), static fn( int $id ): bool => $id > 0 ) ) );
		$paths    = [];
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name, integer id lists.
		foreach ( $this->chunk_ids_for_in_list( $post_ids ) as $chunk ) {
			$id_list = implode( ',', $chunk );
			foreach ( $wpdb->get_results( "SELECT page_id, page_url FROM {$wpdb->prefix}burst_page_urls WHERE is_canonical = 1 AND page_id IN ({$id_list})", ARRAY_A ) as $dict_row ) {
				$paths[ (int) $dict_row['page_id'] ] = (string) $dict_row['page_url'];
			}
		}
		$missing = array_diff( $post_ids, array_keys( $paths ) );
		foreach ( $this->chunk_ids_for_in_list( $missing ) as $chunk ) {
			$id_list = implode( ',', $chunk );
			$latest  = $wpdb->get_results(
				"SELECT d.page_id, d.page_url FROM {$wpdb->prefix}burst_page_urls d
				JOIN ( SELECT page_id, MAX(ID) AS mid FROM {$wpdb->prefix}burst_page_urls WHERE page_id IN ({$id_list}) GROUP BY page_id ) m ON d.ID = m.mid",
				ARRAY_A
			);
			foreach ( $latest as $dict_row ) {
				$paths[ (int) $dict_row['page_id'] ] = (string) $dict_row['page_url'];
			}
		}
		// phpcs:enable

		return $paths;
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
	 * Only callable where the post's type is registered — save_post and the
	 * weekly sweep. On a Burst REST request the mu-plugin optimizer skips
	 * every other plugin, so a plugin's post type (a WooCommerce product) is
	 * unknown there and get_permalink() would fall through to the posts
	 * permalink structure and yield a wrong url; such a type returns '' so
	 * nothing is guessed. Page queries never call this: they display the
	 * dictionary row the tracker registered (see resolve_page_id()).
	 *
	 * @param int $post_id WP post id.
	 */
	protected function canonical_page_path( int $post_id ): string {
		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post ) {
			return '';
		}
		if ( null === get_post_type_object( $post->post_type ) ) {
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
	 * Give every post id in the dictionary that has no canonical row yet one:
	 * its most recently inserted url. Rows without a canonical row come from
	 * the tracker (resolve_page_id()) and the seed/backfill; save_post and
	 * the weekly permalink sweep refine these with the real permalink
	 * afterwards. Shared by the seed and backfill completion steps and the
	 * start of every sweep pass.
	 */
	protected function promote_latest_page_urls_to_canonical(): void {
		global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id lists.
		$row_ids = $wpdb->get_col(
			"SELECT MAX(d.ID) FROM {$wpdb->prefix}burst_page_urls d
			WHERE d.page_id > 0 AND d.page_id NOT IN (
				SELECT page_id FROM ( SELECT page_id FROM {$wpdb->prefix}burst_page_urls WHERE is_canonical = 1 ) has_canonical
			)
			GROUP BY d.page_id"
		);
		foreach ( $this->chunk_ids_for_in_list( $row_ids ) as $chunk ) {
			$id_list = implode( ',', $chunk );
			$wpdb->query( "UPDATE {$wpdb->prefix}burst_page_urls SET is_canonical = 1 WHERE ID IN ({$id_list})" );
		}
        // phpcs:enable
	}

	/**
	 * The statistics.page_id values that hold the hits of the page behind a
	 * url, so a single-page filter matches the row the Pages table shows for
	 * that url. Page-grain queries group on page_id and label each row with
	 * its canonical url (see Page_Url_Metric), so hits stored under the
	 * post's other urls (an old slug, comment pagination) belong to the same
	 * row while their page_url string differs. The set is the WP post id the
	 * url maps to (when it has one) plus the url's own negative dictionary id
	 * (-ID, see resolve_page_url_id()), which covers hits a canonical claim
	 * has not merged onto the post id yet. Read-only: an unknown url is never
	 * inserted. Empty when the dictionary is not ready or the url is unknown;
	 * the caller then filters on the page_url string, which is what the page
	 * tables group on in that case as well.
	 *
	 * @param string $page_url Relative url path, as displayed in the page tables.
	 * @return int[] The page_ids to filter on, empty to fall back to the url string.
	 */
	protected function page_grain_ids_for_url( string $page_url ): array {
		static $cache = [];
		if ( '' === $page_url || ! $this->page_dictionary_ready() ) {
			return [];
		}
		$blog_id = get_current_blog_id();
		if ( isset( $cache[ $blog_id ][ $page_url ] ) ) {
			return $cache[ $blog_id ][ $page_url ];
		}

		global $wpdb;
		// The canonical row first: sites whose UNIQUE(page_url) migration
		// failed can still hold duplicate rows for one url.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT ID, page_id FROM {$wpdb->prefix}burst_page_urls WHERE page_url = %s ORDER BY is_canonical DESC, page_id > 0 DESC, ID ASC LIMIT 1",
				$page_url
			),
			ARRAY_A
		);

		$page_ids = [];
		if ( is_array( $row ) ) {
			if ( (int) $row['page_id'] > 0 ) {
				$page_ids[] = (int) $row['page_id'];
			}
			$page_ids[] = - (int) $row['ID'];
		}
		$cache[ $blog_id ][ $page_url ] = $page_ids;
		return $page_ids;
	}

	/**
	 * Prepared WHERE condition that selects the hits of one page for the
	 * per-page reports, matching the row the Pages table shows for that url
	 * (see page_grain_ids_for_url()).
	 *
	 * @param string $alias    Table alias of burst_statistics in the query.
	 * @param string $page_url Relative url path, as displayed in the page tables.
	 * @return string SQL condition without a leading AND, already prepared.
	 */
	protected function single_page_condition_sql( string $alias, string $page_url ): string {
		global $wpdb;
		$alias    = sanitize_key( $alias );
		$page_ids = $this->page_grain_ids_for_url( $page_url );
		if ( ! empty( $page_ids ) ) {
			// Integers only, cast in page_grain_ids_for_url().
			return "{$alias}.page_id IN (" . implode( ',', array_map( 'intval', $page_ids ) ) . ')';
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- alias sanitized above.
		return $wpdb->prepare( "{$alias}.page_url = %s", $page_url );
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
		return $this->tracking_schema_at_least( $this->tracking_schema_version() );
	}

	/**
	 * Whether the table init of at least $version has run on this blog — the
	 * per-column variant of tracking_schema_current() for columns a later
	 * release added on top of the 3.7.0 write set (sessions.has_pageview in
	 * 3.7.1). Keeping these on their own gate means a pending 3.7.1 init only
	 * withholds the 3.7.1 columns; bumping tracking_schema_version() instead
	 * would drop the tracker back to the pre-3.7.0 write set — which names a
	 * uid column that fresh 3.7.0 installs never had. Same cost model: one
	 * autoloaded option read, memoized per blog and version.
	 *
	 * @param string $version The plugin version whose table init must have run.
	 */
	protected function tracking_schema_at_least( string $version ): bool {
		static $at_least = [];
		$blog_id         = get_current_blog_id();
		if ( ! isset( $at_least[ $blog_id ][ $version ] ) ) {
			$stored                           = (string) get_option( 'burst-current-version', '' );
			$at_least[ $blog_id ][ $version ] = '' === $stored || version_compare( $stored, $version, '>=' );
		}
		return $at_least[ $blog_id ][ $version ];
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
	public function has_pending_db_upgrade(): bool {
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
			// forever. The dispatcher's own registry is the source of truth;
			// cleanup tasks the read paths do not depend on are left out.
			foreach ( ( new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->get_blocking_upgrade_slugs() as $slug ) {
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
	 * Drop the db_upgrades_complete() probe for the current blog, so a step
	 * that just installed tables or queued an upgrade (the import finalize)
	 * is seen immediately instead of after the one-minute TTL.
	 */
	protected function flush_db_upgrades_complete_cache(): void {
		wp_cache_delete( 'burst_db_upgrades_complete_' . get_current_blog_id(), 'burst' );
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
		$supported = $this->is_mariadb()
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
		$supported = $this->is_mariadb()
			? version_compare( $wpdb->db_version(), '10.2.3', '>=' )
			: version_compare( $wpdb->db_version(), '5.7.8', '>=' );
		return $supported;
	}

	/**
	 * Whether InnoDB can drop a column as a metadata-only change
	 * (ALGORITHM=INSTANT): MariaDB 10.4+ or MySQL 8.0.29+. MySQL is held to
	 * 8.0.32+, because the instant ADD/DROP COLUMN of 8.0.29–8.0.31 had
	 * corruption bugs (8.0.29 was withdrawn for it). Older servers can still
	 * drop the column, but only by rebuilding the table.
	 */
	protected function supports_instant_drop_column(): bool {
		static $supported = null;
		if ( null !== $supported ) {
			return $supported;
		}
		global $wpdb;
		$is_mariadb = stripos( $wpdb->db_server_info(), 'mariadb' ) !== false;
		$supported  = $is_mariadb
			? version_compare( $wpdb->db_version(), '10.4', '>=' )
			: version_compare( $wpdb->db_version(), '8.0.32', '>=' );
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
	 * Per-request memo for table_exists(), per blog and table name.
	 *
	 * @var array<int, array<string, bool>>
	 */
	protected static array $table_exists_cache = [];

	/**
	 * Cache key for the table_exists() result of a table.
	 *
	 * @param string $table Table name without wp_ prefix.
	 * @return string Cache key for wp_cache.
	 */
	protected static function table_exists_cache_key( string $table ): string {
		$blog_id    = get_current_blog_id();
		$generation = self::db_cache_generation();
		return "burst_table_exists_{$table}_{$blog_id}_{$generation}";
	}

	/**
	 * Flush the table_exists() caches. Call it after dropping Burst tables.
	 *
	 * @param string|null $table Table name without wp_ prefix, or null to flush all.
	 */
	public static function flush_table_exists_cache( ?string $table = null ): void {
		$blog_id = get_current_blog_id();
		if ( null !== $table ) {
			unset( self::$table_exists_cache[ $blog_id ][ $table ] );
			wp_cache_delete( self::table_exists_cache_key( $table ), 'burst' );
		} else {
			unset( self::$table_exists_cache[ $blog_id ] );
			self::bump_db_cache_generation();
		}
	}

	/**
	 * Check if table exists
	 * $table should include the burst prefix, but not the WordPress prefix. E.g. burst_sessions.
	 *
	 * Memoized per request and cached in the object cache to eliminate redundant
	 * SHOW TABLES LIKE queries on high-traffic paths.
	 *
	 * @param string $table Table name without wp_ prefix.
	 * @return bool True if table exists, false otherwise.
	 */
	protected function table_exists( string $table ): bool {
		global $wpdb;
		$table = $this->validate_table_name( $table );
		if ( '' === $table ) {
			return false;
		}

		$blog_id = get_current_blog_id();
		if ( isset( self::$table_exists_cache[ $blog_id ][ $table ] ) ) {
			return self::$table_exists_cache[ $blog_id ][ $table ];
		}

		$cache_key = self::table_exists_cache_key( $table );
		if ( wp_cache_get( $cache_key, 'burst' ) ) {
			self::$table_exists_cache[ $blog_id ][ $table ] = true;
			return true;
		}

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated against known whitelist above.
		$exists = (bool) $wpdb->query( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->prefix . $table ) );

		// Only a positive answer is cached: a missing table is a transient state (install, upgrade) and a cached
		// "missing" would keep hiding the table after it has been created.
		if ( $exists ) {
			self::$table_exists_cache[ $blog_id ][ $table ] = true;
			// Literal TTL (seconds): time constants aren't guaranteed on the SHORTINIT beacon path. Kept short
			// because a table dropped outside Burst (a database restore, manual cleanup) cannot flush this entry.
			wp_cache_set( $cache_key, true, 'burst', 300 );
		}

		return $exists;
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
	 * Return the collation and charset of a column, or null if not found.
	 *
	 * Probes information_schema so a missing table or column simply returns null
	 * without generating a database error.
	 *
	 * @param string $table_name  Table name without WordPress prefix.
	 * @param string $column_name Column name.
	 * @return array{collation:string,charset:string}|null
	 */
	protected function get_column_charset_collate( string $table_name, string $column_name ): ?array {
		global $wpdb;
		$table_name = $this->validate_table_name( $table_name );
		if ( '' === $table_name ) {
			return null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT COLLATION_NAME, CHARACTER_SET_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s',
				$wpdb->prefix . $table_name,
				$column_name
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) || empty( $row['COLLATION_NAME'] ) || empty( $row['CHARACTER_SET_NAME'] ) ) {
			return null;
		}

		$collation = (string) $row['COLLATION_NAME'];
		$charset   = (string) $row['CHARACTER_SET_NAME'];

		if ( ! preg_match( '/^[a-zA-Z0-9_]+$/', $collation ) || ! preg_match( '/^[a-zA-Z0-9_]+$/', $charset ) ) {
			return null;
		}

		return [
			'collation' => $collation,
			'charset'   => $charset,
		];
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
	 * The last database error with everything from its first to its last quote
	 * replaced, for debug logs. MySQL quotes the data it failed on ("Duplicate
	 * entry '…' for key", "near '…'" with the query's values), which can be
	 * visitor data; quotes nest inside "near", so quoted parts can't be
	 * replaced one by one. The rest still says what went wrong.
	 */
	protected function redacted_db_error(): string {
		global $wpdb;
		return (string) preg_replace( "/'.*'/s", "'…'", (string) $wpdb->last_error );
	}

	/**
	 * Take a named MySQL advisory lock. Non-blocking by default: a caller that
	 * cannot afford to wait (the tracking path) passes no timeout and handles
	 * the false, one that can afford a short wait passes seconds. The lock is
	 * released by the server the moment the holding connection dies, so a
	 * killed PHP process never strands it. Errors are suppressed and treated
	 * as "not acquired" — GET_LOCK returns NULL on error, never 1.
	 *
	 * @param string $lock_name Lock identifier; MariaDB caps these at 64 chars.
	 * @param int    $timeout   Seconds to wait for the lock, 0 to fail immediately.
	 */
	protected function acquire_db_lock( string $lock_name, int $timeout = 0 ): bool {
		global $wpdb;
		if ( ! isset( $wpdb ) ) {
			return true;
		}

		$suppress = $wpdb->suppress_errors( true );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, %d)', substr( $lock_name, 0, 64 ), $timeout ) );
		$wpdb->suppress_errors( $suppress );

		return '1' === (string) $result;
	}

	/**
	 * Release a lock taken by acquire_db_lock(). No-op when this connection
	 * does not hold it.
	 */
	protected function release_db_lock( string $lock_name ): void {
		global $wpdb;
		if ( ! isset( $wpdb ) ) {
			return;
		}

		$suppress = $wpdb->suppress_errors( true );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', substr( $lock_name, 0, 64 ) ) );
		$wpdb->suppress_errors( $suppress );
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
				'burst_event_names',
				'burst_events',
				'burst_page_weights',
				'burst_page_weight_history',
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
	 * Drop columns from a table without blocking the writes to it — the
	 * statistics and sessions tables take a tracking insert on every hit, so a
	 * locking ALTER would hold every beacon request for the whole run.
	 *
	 * 1. Every index containing one of the columns is dropped first, by what
	 *    information_schema reports rather than by name: DROP COLUMN silently
	 *    shrinks such an index to its remaining columns under the same name.
	 *    Dropping a secondary index is metadata-only.
	 * 2. The columns are dropped with ALGORITHM=INSTANT where the server
	 *    supports it (metadata-only, seconds on any table size).
	 * 3. Otherwise — older server, or INSTANT refused (e.g. MySQL's limit of
	 *    64 instant row versions) — with ALGORITHM=INPLACE, LOCK=NONE: an
	 *    online rebuild during which reads and writes continue. The server
	 *    refuses rather than falling back to a locking table copy.
	 *
	 * Every ALTER needs a short exclusive metadata lock at its start and end.
	 * While it waits for that lock, new writes queue up behind it, so the wait
	 * is capped with lock_wait_timeout: the ALTER fails and is retried later
	 * instead of stalling tracking behind a long-running dashboard query.
	 *
	 * Runs from cron / WP-CLI only (a rebuild can take long on large tables).
	 *
	 * @param string   $table_name   Table without the WordPress prefix, validated against the table list.
	 * @param string[] $column_names Columns to drop; must all exist.
	 * @return bool True when the columns are dropped.
	 */
	protected function drop_columns_online( string $table_name, array $column_names ): bool {
		global $wpdb;
		$table_name = $this->validate_table_name( $table_name );
		if ( '' === $table_name || empty( $column_names ) ) {
			return false;
		}
		$full_table   = $wpdb->prefix . $table_name;
		$column_names = array_map( 'sanitize_key', $column_names );

		$placeholders = implode( ', ', array_fill( 0, count( $column_names ), '%s' ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- placeholder list built from the column array, every value prepared.
		$indexes = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME IN ($placeholders)", $full_table, ...$column_names ) );
		if ( in_array( 'PRIMARY', $indexes, true ) ) {
			// Dropping a primary key column always rebuilds the table and
			// changes the row identity; never done implicitly.
			self::error_log( "drop_columns_online: refusing to drop a primary key column from {$full_table}." );
			return false;
		}

		if ( function_exists( 'set_time_limit' ) ) {
			// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- some hosts disable it; a failure only shortens the budget.
			@set_time_limit( 0 );
		}
		ignore_user_abort( true );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- validated table name, index and column names from information_schema / sanitize_key.
		$lock_wait_timeout = (int) $wpdb->get_var( 'SELECT @@SESSION.lock_wait_timeout' );
		$wpdb->query( 'SET SESSION lock_wait_timeout = 10' );

		$dropped = true;
		if ( ! empty( $indexes ) ) {
			$drop_indexes = array_map( static fn( $index ) => 'DROP INDEX `' . esc_sql( (string) $index ) . '`', $indexes );
			$dropped      = false !== $wpdb->query( "ALTER TABLE `{$full_table}` " . implode( ', ', $drop_indexes ) . ', ALGORITHM=INPLACE, LOCK=NONE' );
		}

		if ( $dropped ) {
			$drop_columns = 'ALTER TABLE `' . $full_table . '` ' . implode( ', ', array_map( static fn( $column ) => "DROP COLUMN `{$column}`", $column_names ) );
			$dropped      = false;
			if ( $this->supports_instant_drop_column() ) {
				// A refusal is expected on some tables (row version limit);
				// keep it out of the error log, the online rebuild follows.
				$suppress = $wpdb->suppress_errors();
				$dropped  = false !== $wpdb->query( $drop_columns . ', ALGORITHM=INSTANT' );
				$wpdb->suppress_errors( $suppress );
			}
			if ( ! $dropped ) {
				$dropped = false !== $wpdb->query( $drop_columns . ', ALGORITHM=INPLACE, LOCK=NONE' );
			}
		}

		if ( ! $dropped ) {
			self::error_log( "drop_columns_online: dropping {$full_table}." . implode( ', ', $column_names ) . ' failed: ' . $wpdb->last_error );
		}
		if ( $lock_wait_timeout > 0 ) {
			$wpdb->query( $wpdb->prepare( 'SET SESSION lock_wait_timeout = %d', $lock_wait_timeout ) );
		}
		// phpcs:enable
		return $dropped;
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
