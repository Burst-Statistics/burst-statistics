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
				'burst_goals',
				'burst_goal_statistics',
				'burst_browsers',
				'burst_browser_versions',
				'burst_platforms',
				'burst_devices',
				'burst_referrers',
				'burst_known_uids',
				'burst_query_stats',
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
}
