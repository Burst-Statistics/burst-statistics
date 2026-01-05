<?php
namespace Burst\Frontend;

use Burst\Admin\Statistics\Query_Data;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Frontend_Statistics
 *
 * This class handles statistics queries specifically for frontend use cases,
 * such as shortcodes and widgets. It provides a simplified interface to query
 * statistics without dependencies on admin functionality.
 *
 * @package Burst\Frontend
 * @since 2.1.0
 */
class Frontend_Statistics {
	use Helper;

	/**
	 * Constructor to initialize class properties
	 */
	public function __construct() {}

	/**
	 * Get date range based on period.
	 *
	 * @param string $period     The period ('today', '7days', '30days', etc.).
	 * @param string $start_date Custom start date (Y-m-d format).
	 * @param string $end_date   Custom end date (Y-m-d format).
	 * @return array{start: int, end: int} Array with start and end timestamps.
	 */
	public function get_date_range( string $period, string $start_date = '', string $end_date = '' ): array {
		// Handle custom date ranges first.
		if ( ! empty( $start_date ) && ! empty( $end_date ) ) {
			// Use convert_date_to_unix for proper timezone handling.
			$start = self::convert_date_to_unix( $start_date . ' 00:00:00' );
			$end   = self::convert_date_to_unix( $end_date . ' 23:59:59' );
			return [
				'start' => $start,
				'end'   => $end,
			];
		}

		// Get current time with proper timezone handling.
		$now = time();

		// Process predefined periods with timezone-aware calculations and normalization.
		switch ( $period ) {
			case 'today':
				$start = self::convert_date_to_unix( gmdate( 'Y-m-d' ) . ' 00:00:00' );
				// Normalize to nearest hour for consistent caching.
				$end = (int) ( floor( $now / HOUR_IN_SECONDS ) * HOUR_IN_SECONDS );
				break;
			case 'yesterday':
				$yesterday = gmdate( 'Y-m-d', strtotime( '-1 day' ) );
				$start     = self::convert_date_to_unix( $yesterday . ' 00:00:00' );
				$end       = self::convert_date_to_unix( $yesterday . ' 23:59:59' );
				break;
			case '7days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-7 days' ) );
				$start      = self::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '14days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-14 days' ) );
				$start      = self::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '30days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
				$start      = self::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '90days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-90 days' ) );
				$start      = self::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'this_week':
				$monday = gmdate( 'Y-m-d', strtotime( 'monday this week' ) );
				$start  = self::convert_date_to_unix( $monday . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case 'last_week':
				$monday_last = gmdate( 'Y-m-d', strtotime( 'monday last week' ) );
				$sunday_last = gmdate( 'Y-m-d', strtotime( 'sunday last week' ) );
				$start       = self::convert_date_to_unix( $monday_last . ' 00:00:00' );
				$end         = self::convert_date_to_unix( $sunday_last . ' 23:59:59' );
				break;
			case 'this_month':
				$first_day = gmdate( 'Y-m-01' );
				$start     = self::convert_date_to_unix( $first_day . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'last_month':
				$first_day_last = gmdate( 'Y-m-01', strtotime( 'first day of last month' ) );
				$last_day_last  = gmdate( 'Y-m-t', strtotime( 'last day of last month' ) );
				$start          = self::convert_date_to_unix( $first_day_last . ' 00:00:00' );
				$end            = self::convert_date_to_unix( $last_day_last . ' 23:59:59' );
				break;
			case 'this_year':
				$first_day = gmdate( 'Y-01-01' );
				$start     = self::convert_date_to_unix( $first_day . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'last_year':
				$first_day_last = gmdate( 'Y-01-01', strtotime( 'first day of last year' ) );
				$last_day_last  = gmdate( 'Y-12-31', strtotime( 'last day of last year' ) );
				$start          = self::convert_date_to_unix( $first_day_last . ' 00:00:00' );
				$end            = self::convert_date_to_unix( $last_day_last . ' 23:59:59' );
				break;
			case 'all_time':
			default:
				$start = 0;
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
		}

		return [
			'start' => $start,
			'end'   => $end,
		];
	}

	/**
	 * Generate a SQL query for frontend statistics without admin dependencies
	 *
	 * @param Query_Data $query_data The Query Data object.
	 * @return string SQL query.
	 */
	public function generate_statistics_query( Query_Data $query_data ): string {
		global $wpdb;
		// Ensure we have at least one valid metric.
		if ( empty( $query_data->select ) ) {
			// Default to pageviews if no valid metrics.
			$query_data->select = [ 'pageviews' ];
		}

		$select_sql   = $this->build_select_metrics( $query_data->select, $query_data );
		$table_name   = $wpdb->prefix . 'burst_statistics AS statistics';
		$where        = $this->build_where_clause( $query_data->filters, $query_data );
		$group_by_sql = ! empty( $query_data->group_by ) ? 'GROUP BY ' . implode( ',', $query_data->group_by ) : '';
		$order_by_sql = ! empty( $query_data->order_by ) ? 'ORDER BY ' . implode( ',', $query_data->order_by ) : '';

		// Build the complete SQL query using a prepared statement.
		$sql_parts = [
			"SELECT {$select_sql}",
			"FROM {$table_name}",
			'WHERE time > %d AND time < %d',
		];

		// Add the where clause if it exists.
		if ( ! empty( $where ) ) {
			$sql_parts[] = $where;
		}

		// Add group by and order by clauses.
		if ( ! empty( $group_by_sql ) ) {
			$sql_parts[] = $group_by_sql;
		}

		if ( ! empty( $order_by_sql ) ) {
			$sql_parts[] = $order_by_sql;
		}

		// Add limit with prepared statement if needed.
		if ( $query_data->limit > 0 ) {
			$sql_parts[] = 'LIMIT %d';
			$sql_string  = implode( ' ', $sql_parts );
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Prepared above.
			$sql = $wpdb->prepare( $sql_string, $query_data->date_start, $query_data->date_end, $query_data->limit );
		} else {
			$sql_string = implode( ' ', $sql_parts );
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Prepared above.
			$sql = $wpdb->prepare( $sql_string, $query_data->date_start, $query_data->date_end );
		}

		return $sql;
	}

	/**
	 * Get lookup table ID for a given item and name
	 *
	 * @param string $item The item type (device, browser, platform).
	 * @param string $name The name to look up.
	 * @return int The ID from the lookup table, or 0 if not found.
	 */
	private function get_lookup_table_id( string $item, string $name ): int {
		// Validate item type.
		$allowed_items = [ 'device', 'browser', 'platform' ];
		if ( ! in_array( $item, $allowed_items, true ) ) {
			return 0;
		}

		// Try to get from cache first.
		$cache_key = 'burst_' . $item . '_name_' . crc32( $name );
		$id        = wp_cache_get( $cache_key, 'burst' );

		if ( false === $id ) {
			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_' . $item . 's';

			// Execute query with error handling.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name built from predefined array.
			$id = $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$table_name} WHERE name = %s LIMIT 1", $name ) );

			// Check for database errors.
			if ( $wpdb->last_error ) {
				// Log the error for debugging.
				self::error_log( 'DB Error in get_lookup_table_id(): ' . $wpdb->last_error );
				// Return safe default.
				return 0;
			}

			$id = $id ? (int) $id : 0;

			// Cache the result.
			wp_cache_set( $cache_key, $id, 'burst' );
		}

		return (int) $id;
	}

	/**
	 * Get lookup table name by ID
	 *
	 * @param string $item The item type (device, browser, platform).
	 * @param int    $id   The ID to look up.
	 * @return string The name from the lookup table, or empty string if not found.
	 */
	private function get_lookup_table_name_by_id( string $item, int $id ): string {
		if ( $id === 0 ) {
			return '';
		}

		// Validate item type.
		$allowed_items = [ 'device', 'browser', 'platform' ];
		if ( ! in_array( $item, $allowed_items, true ) ) {
			return '';
		}

		// Try to get from cache first.
		$cache_key = 'burst_' . $item . '_' . $id;
		$name      = wp_cache_get( $cache_key, 'burst' );

		if ( false === $name ) {
			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_' . $item . 's';

			// Execute query with error handling.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name built from predefined array.
			$name = $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$table_name} WHERE ID = %s LIMIT 1", $id ) );

			// Check for database errors.
			if ( $wpdb->last_error ) {
				// Log the error for debugging.
				self::error_log( 'DB Error in get_lookup_table_name_by_id(): ' . $wpdb->last_error );
				// Return safe default.
				return '';
			}

			$name = $name ? (string) $name : '';

			// Cache the result.
			wp_cache_set( $cache_key, $name, 'burst' );
		}

		return (string) $name;
	}

	/**
	 * Get device name by ID (public method for shortcode usage)
	 *
	 * @param int $device_id The device ID.
	 * @return string The device name.
	 */
	public function get_device_name_by_id( int $device_id ): string {
		return $this->get_lookup_table_name_by_id( 'device', $device_id );
	}

	/**
	 * Build the SELECT clause for chosen metrics
	 *
	 * @param array      $metrics Metrics to include.
	 * @param Query_Data $query_data The parameters for querying.
	 * @return string SELECT clause.
	 */
	private function build_select_metrics( array $metrics, Query_Data $query_data ): string {
		$select_parts    = [];
		$exclude_bounces = $query_data->exclude_bounces;

		foreach ( $metrics as $metric ) {
			// Skip if not in allowed metrics list.
			if ( ! in_array( $metric, $query_data->get_allowed_metrics(), true ) ) {
				continue;
			}

			switch ( $metric ) {
				case 'pageviews':
					$select_parts[] = $exclude_bounces
						? 'COALESCE( SUM( CASE WHEN bounce = 0 THEN 1 ELSE 0 END ), 0) as pageviews'
						: 'COUNT(statistics.ID) as pageviews';
					break;
				case 'visitors':
					$select_parts[] = $exclude_bounces
						? 'COUNT(DISTINCT CASE WHEN bounce = 0 THEN statistics.uid END) as visitors'
						: 'COUNT(DISTINCT statistics.uid) as visitors';
					break;
				case 'sessions':
					$select_parts[] = $exclude_bounces
						? 'COUNT( DISTINCT CASE WHEN bounce = 0 THEN statistics.session_id END ) as sessions'
						: 'COUNT(DISTINCT statistics.session_id) as sessions';
					break;
				case 'bounce_rate':
					$select_parts[] = 'SUM(statistics.bounce) / COUNT(DISTINCT statistics.session_id) * 100 as bounce_rate';
					break;
				case 'avg_time_on_page':
					$select_parts[] = $exclude_bounces
						? 'COALESCE( AVG( CASE WHEN bounce = 0 THEN statistics.time_on_page END ), 0 ) as avg_time_on_page'
						: 'AVG(statistics.time_on_page) as avg_time_on_page';
					break;
				case 'first_time_visitors':
					$select_parts[] = $exclude_bounces
						? 'COALESCE( SUM( CASE WHEN bounce = 0 THEN statistics.first_time_visit ELSE 0 END ), 0 ) as first_time_visitors'
						: 'SUM(statistics.first_time_visit) as first_time_visitors';
					break;
				case 'page_url':
					$select_parts[] = 'statistics.page_url';
					break;
				case 'referrer':
					$select_parts[] = 'statistics.referrer';
					break;
				case 'device':
					$select_parts[] = 'statistics.device_id';
					break;
				case 'count':
				default:
					$select_parts[] = $exclude_bounces
						? 'COALESCE( SUM( CASE WHEN bounce = 0 THEN 1 ELSE 0 END ), 0) as count'
						: 'COUNT(statistics.ID) as count';
					break;
			}
		}

		return implode( ', ', $select_parts );
	}

	/**
	 * Build WHERE clause for frontend queries
	 *
	 * @param array $filters Filter conditions.
	 * @return string WHERE clause.
	 */
	private function build_where_clause( array $filters, Query_Data $query_data ): string {
		global $wpdb;
		$where_parts = [];

		foreach ( $filters as $key => $value ) {
			// Only process if key is in allowed list (already validated in sanitize_filters).
			if ( ! in_array( $key, $query_data->get_allowed_filter_keys(), true ) ) {
				continue;
			}

			switch ( $key ) {
				case 'page_id':
					$where_parts[] = $wpdb->prepare( 'statistics.page_id = %s', $value );
					break;
				case 'page_type':
					$where_parts[] = $wpdb->prepare( 'statistics.page_type = %s', $value );
					break;
				case 'page_url':
					$where_parts[] = $wpdb->prepare( 'statistics.page_url = %s', $value );
					break;
				case 'referrer':
					if ( $value === 'Direct' || $value === __( 'Direct', 'burst-statistics' ) ) {
						$where_parts[] = "(statistics.referrer = '' OR statistics.referrer IS NULL)";
					} else {
						$where_parts[] = $wpdb->prepare( 'statistics.referrer LIKE %s', '%' . $wpdb->esc_like( $value ) . '%' );
					}
					break;
				case 'device':
					// Convert device name to device_id if using lookup tables.
					$device_id     = $this->get_lookup_table_id( 'device', $value );
					$where_parts[] = $wpdb->prepare( 'statistics.device_id = %d', $device_id );
					break;
				case 'browser':
					$where_parts[] = $wpdb->prepare( 'statistics.browser = %s', $value );
					break;
				case 'platform':
					$where_parts[] = $wpdb->prepare( 'statistics.platform = %s', $value );
					break;
				default:
					// Default to empty where clause.
					break;
			}
		}

		// Handle referrer filtering to exclude own site.
		if ( isset( $filters['referrer'] ) || isset( $filters['top_referrers'] ) ) {
			$site_url      = str_replace( [ 'http://www.', 'https://www.', 'http://', 'https://' ], '', site_url() );
			$where_parts[] = $wpdb->prepare( 'statistics.referrer NOT LIKE %s', '%' . $wpdb->esc_like( $site_url ) . '%' );
		}

		return ! empty( $where_parts ) ? 'AND ' . implode( ' AND ', $where_parts ) : '';
	}

	/**
	 * Get most viewed posts
	 *
	 * @param int    $count Number of posts to retrieve.
	 * @param string $post_type Post type to query.
	 * @param int    $start_time Start timestamp (default: 0 for all time).
	 * @param int    $end_time End timestamp (default: current time).
	 * @return array<int, array<string, mixed>> Array of post objects with view counts.
	 */
	public function get_most_viewed_posts( int $count = 5, string $post_type = 'post', int $start_time = 0, int $end_time = 0 ): array {
		// Sanitize post type.
		$post_types = get_post_types();
		if ( ! in_array( $post_type, $post_types, true ) ) {
			$post_type = 'post';
		}

		if ( $end_time === 0 ) {
			$end_time = time();
		}

		global $wpdb;
		// Get posts sorted by pageviews.
		$posts  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT page_id, COUNT(*) as pageview_count
             FROM {$wpdb->prefix}burst_statistics
             WHERE page_id > 0
               AND time >= %d
               AND time <= %d
               AND page_type = %s
             GROUP BY page_id
             ORDER BY pageview_count DESC
             LIMIT %d",
				$start_time,
				$end_time,
				$post_type,
				$count
			),
			ARRAY_A
		);
		$result = [];

		foreach ( $posts as $post ) {
			$post_object = get_post( $post['page_id'] );
			$result[]    = [
				'post'  => $post_object,
				'views' => $post['pageview_count'],
			];
		}

		return $result;
	}
}
