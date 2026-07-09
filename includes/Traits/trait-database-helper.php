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
	 */
	protected function column_exists( string $table_name, string $column_name ): bool {
		global $wpdb;
		$table_name = $this->validate_table_name( $table_name );

		$table_name = $wpdb->prefix . $table_name;
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated against known whitelist above.
		$columns = $wpdb->get_col( "DESC $table_name" );
		return in_array( $column_name, $columns, true );
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
				'burst_known_uids',
				'burst_query_stats',
				'burst_searches',
				'burst_statistics_searches',
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

		$indexes    = array_map( 'sanitize_key', $indexes );
		$table_name = $wpdb->prefix . $this->validate_table_name( $table_name );
		$index      = esc_sql( implode( ', ', $indexes ) );
		$index_name = esc_sql( implode( '_', $indexes ) . '_index' );
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared --called with predefined table names, and sanitized above.
		$result       = $wpdb->get_results( $wpdb->prepare( "SHOW INDEX FROM $table_name WHERE Key_name = %s", $index_name ) );
		$index_exists = ! empty( $result );

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

		$table_name = $wpdb->prefix . $this->validate_table_name( $table_name );
		$index_name = esc_sql( $index_name );

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated, index name escaped.
		$exists = $wpdb->get_results( $wpdb->prepare( "SHOW INDEX FROM $table_name WHERE Key_name = %s", $index_name ) );
		if ( empty( $exists ) ) {
			return;
		}

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated, index name escaped.
		$wpdb->query( "ALTER TABLE $table_name DROP INDEX $index_name" );
		if ( $wpdb->last_error ) {
			self::error_log( "Error dropping index $index_name from $table_name: " . $wpdb->last_error );
		}
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
