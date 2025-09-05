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
	 * Check if table exists
	 */
	public function table_exists( string $table ): bool {
		global $wpdb;
		return (bool) $wpdb->query( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->prefix . sanitize_title( $table ) ) );
	}

	/**
	 * Check if a table has a specific column
	 * pass the table name without WordPress (wp_) prefix, but with burst prefix.
	 */
	public function column_exists( string $table_name, string $column_name ): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . $table_name;
		$columns    = $wpdb->get_col( "DESC $table_name" );
		return in_array( $column_name, $columns, true );
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
	public function add_index( string $table_name, array $indexes ): void {
		global $wpdb;
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$indexes      = array_map( 'sanitize_key', $indexes );
		$table_name   = esc_sql( sanitize_key( $table_name ) );
		$index        = esc_sql( implode( ', ', $indexes ) );
		$index_name   = esc_sql( implode( '_', $indexes ) . '_index' );
		$sql          = $wpdb->prepare( "SHOW INDEX FROM $table_name WHERE Key_name = %s", $index_name );
		$result       = $wpdb->get_results( $sql );
		$index_exists = ! empty( $result );

		if ( ! $index_exists ) {
			$sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index)";
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
					$wpdb->query( $drop_sql );

					// Try with reduced length.
					$reduced_sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index(100))";
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
