<?php
namespace Burst\Frontend;

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
	 * Store allowed metrics for reuse across methods
	 *
	 * @var array<string>
	 */
	private $allowed_metrics;

	/**
	 * Store allowed filter keys for reuse across methods
	 *
	 * @var array<string>
	 */
	private $allowed_filter_keys;

	/**
	 * Store allowed group_by values
	 *
	 * @var array<string>
	 */
	private $allowed_group_by;

	/**
	 * Store allowed order_by values
	 *
	 * @var array<string>
	 */
	private $allowed_order_by;

	/**
	 * Cache for use_lookup_tables check
	 *
	 * @var bool|null
	 */
	private $use_lookup_tables = null;

	/**
	 * Cache for exclude_bounces check
	 *
	 * @var bool|null
	 */
	private $exclude_bounces = null;

	/**
	 * Constructor to initialize class properties
	 */
	public function __construct() {
		// Define the default allowed metrics.
		$default_metrics = [
			'pageviews',
			'visitors',
			'sessions',
			'bounce_rate',
			'avg_time_on_page',
			'first_time_visitors',
			'page_url',
			'referrer',
			'device',
			'count',
		];

		// Allow modification of allowed metrics via filter.
		$this->allowed_metrics = apply_filters( 'burst_statistics_allowed_metrics', $default_metrics );

		// Define allowed filter keys.
		$default_filter_keys = [
			'page_url',
			'referrer',
			'device',
			'browser',
			'platform',
		];

		// Allow modification of allowed filter keys via filter.
		$this->allowed_filter_keys = apply_filters( 'burst_statistics_allowed_filter_keys', $default_filter_keys );

		// Define allowed group_by values.
		$default_group_by = [
			'page_url',
			'referrer',
			'device',
			'browser',
			'platform',
		];

		// Allow modification of allowed group_by values via filter.
		$this->allowed_group_by = apply_filters( 'burst_statistics_allowed_group_by', $default_group_by );

		// Define allowed order_by values.
		$default_order_by = [
			'pageviews DESC',
			'pageviews ASC',
			'visitors DESC',
			'visitors ASC',
			'sessions DESC',
			'sessions ASC',
			'bounce_rate DESC',
			'bounce_rate ASC',
			'avg_time_on_page DESC',
			'avg_time_on_page ASC',
			'first_time_visitors DESC',
			'first_time_visitors ASC',
			'count DESC',
			'count ASC',
		];

		// Allow modification of allowed order_by values via filter.
		$this->allowed_order_by = apply_filters( 'burst_statistics_allowed_order_by', $default_order_by );
	}

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
			$start = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $start_date . ' 00:00:00' );
			$end   = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $end_date . ' 23:59:59' );
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
				$start = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( gmdate( 'Y-m-d' ) . ' 00:00:00' );
				// Normalize to nearest hour for consistent caching.
				$end = (int) ( floor( $now / HOUR_IN_SECONDS ) * HOUR_IN_SECONDS );
				break;
			case 'yesterday':
				$yesterday = gmdate( 'Y-m-d', strtotime( '-1 day' ) );
				$start     = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $yesterday . ' 00:00:00' );
				$end       = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $yesterday . ' 23:59:59' );
				break;
			case '7days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-7 days' ) );
				$start      = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '14days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-14 days' ) );
				$start      = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '30days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
				$start      = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case '90days':
				$start_date = gmdate( 'Y-m-d', strtotime( '-90 days' ) );
				$start      = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $start_date . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'this_week':
				$monday = gmdate( 'Y-m-d', strtotime( 'monday this week' ) );
				$start  = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $monday . ' 00:00:00' );
				// Normalize to nearest 6 hours for consistent caching.
				$end = (int) ( floor( $now / ( 6 * HOUR_IN_SECONDS ) ) * ( 6 * HOUR_IN_SECONDS ) );
				break;
			case 'last_week':
				$monday_last = gmdate( 'Y-m-d', strtotime( 'monday last week' ) );
				$sunday_last = gmdate( 'Y-m-d', strtotime( 'sunday last week' ) );
				$start       = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $monday_last . ' 00:00:00' );
				$end         = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $sunday_last . ' 23:59:59' );
				break;
			case 'this_month':
				$first_day = gmdate( 'Y-m-01' );
				$start     = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $first_day . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'last_month':
				$first_day_last = gmdate( 'Y-m-01', strtotime( 'first day of last month' ) );
				$last_day_last  = gmdate( 'Y-m-t', strtotime( 'last day of last month' ) );
				$start          = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $first_day_last . ' 00:00:00' );
				$end            = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $last_day_last . ' 23:59:59' );
				break;
			case 'this_year':
				$first_day = gmdate( 'Y-01-01' );
				$start     = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $first_day . ' 00:00:00' );
				// Normalize to nearest day for consistent caching.
				$end = (int) ( floor( $now / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
				break;
			case 'last_year':
				$first_day_last = gmdate( 'Y-01-01', strtotime( 'first day of last year' ) );
				$last_day_last  = gmdate( 'Y-12-31', strtotime( 'last day of last year' ) );
				$start          = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $first_day_last . ' 00:00:00' );
				$end            = \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $last_day_last . ' 23:59:59' );
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
	 * @param int    $start     Start timestamp.
	 * @param int    $end       End timestamp.
	 * @param array  $select    Metrics to select.
	 * @param array  $filters   Query filters.
	 * @param string $group_by  Group by clause.
	 * @param string $order_by  Order by clause.
	 * @param int    $limit     Results limit.
	 * @return string SQL query.
	 */
	public function generate_statistics_query(
		int $start,
		int $end,
		array $select = [ '*' ],
		array $filters = [],
		string $group_by = '',
		string $order_by = '',
		int $limit = 0
	): string {
		global $wpdb;

		// Sanitize inputs.
		$filters = $this->sanitize_filters( $filters );
		$select  = array_map( 'esc_sql', $select );

		// Validate group_by and order_by against whitelists.
		$group_by = $this->validate_group_by( $group_by );
		$order_by = $this->validate_order_by( $order_by );
		$limit    = $limit;

		// Filter select to only include allowed metrics.
		// Ensure both arrays contain only strings for proper comparison.
		$allowed_metrics = array_map( 'strval', $this->allowed_metrics );
		$select_strings  = array_map( 'strval', $select );
		$select          = array_intersect( $select_strings, $allowed_metrics );

		// Ensure we have at least one valid metric.
		if ( empty( $select ) ) {
			// Default to pageviews if no valid metrics.
			$select = [ 'pageviews' ];
		}

		// Prepare SELECT clause with metrics.
		$select_sql = $this->build_select_metrics( $select );

		// Base table.
		$table_name = $wpdb->prefix . 'burst_statistics AS statistics';

		// Build WHERE clause from filters.
		$where = $this->build_where_clause( $filters );

		// Build optional clauses, handling lookup table adjustments.
		if ( ! empty( $group_by ) ) {
			// Adjust group_by for lookup tables.
			if ( $group_by === 'device' && $this->use_lookup_tables() ) {
				$group_by = 'device_id';
			}
			$group_by_sql = 'GROUP BY ' . esc_sql( $group_by );
		} else {
			$group_by_sql = '';
		}
		$order_by_sql = ! empty( $order_by ) ? 'ORDER BY ' . esc_sql( $order_by ) : '';

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
		if ( $limit > 0 ) {
			$sql_parts[] = 'LIMIT %d';
			$sql_string  = implode( ' ', $sql_parts );
			$sql         = $wpdb->prepare(
				$sql_string,
				$start,
				$end,
				$limit
			);
		} else {
			$sql_string = implode( ' ', $sql_parts );
			$sql        = $wpdb->prepare(
				$sql_string,
				$start,
				$end
			);
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
	 * Validate group_by against whitelist
	 *
	 * @param string $group_by Group by clause to validate.
	 * @return string Validated group_by or empty string.
	 */
	private function validate_group_by( string $group_by ): string {
		// Allow only values in the whitelist.
		return in_array( $group_by, $this->allowed_group_by, true ) ? $group_by : '';
	}

	/**
	 * Validate order_by against whitelist
	 *
	 * @param string $order_by Order by clause to validate.
	 * @return string Validated order_by or empty string.
	 */
	private function validate_order_by( string $order_by ): string {
		// Allow only values in the whitelist.
		return in_array( $order_by, $this->allowed_order_by, true ) ? $order_by : '';
	}

	/**
	 * Sanitize filters for safe SQL usage
	 *
	 * @param array $filters Filters to sanitize.
	 * @return array<string, string> Sanitized filters.
	 */
	private function sanitize_filters( array $filters ): array {
		// Filter out false or empty values.
		$filters = array_filter(
			$filters,
			function ( $item ) {
				return $item !== false && $item !== '';
			}
		);

		// Sanitize keys and values and limit to allowed keys.
		$sanitized = [];
		foreach ( $filters as $key => $value ) {
			// Only allow filters with whitelisted keys.
			if ( in_array( $key, $this->allowed_filter_keys, true ) ) {
				$sanitized_key = sanitize_key( $key );

				// Use appropriate sanitization based on filter type.
				switch ( $key ) {
					case 'page_url':
						// For URLs, use wp_parse_url to extract path component.
						$parsed_url      = wp_parse_url( $value, PHP_URL_PATH );
						$sanitized_value = ( $parsed_url !== false && $parsed_url !== null ) ? $parsed_url : sanitize_text_field( $value );
						break;
					case 'referrer':
						// For referrers, sanitize as URL.
						$sanitized_value = esc_url_raw( $value );
						break;
					case 'device':
					case 'browser':
					case 'platform':
						// For device/browser/platform, use sanitize_key for consistency.
						$sanitized_value = sanitize_key( $value );
						break;
					default:
						// Default to text field sanitization.
						$sanitized_value = sanitize_text_field( $value );
						break;
				}

				if ( ! empty( $sanitized_value ) ) {
					$sanitized[ $sanitized_key ] = $sanitized_value;
				}
			}
		}

		return $sanitized;
	}

	/**
	 * Build the SELECT clause for chosen metrics
	 *
	 * @param array $metrics Metrics to include.
	 * @return string SELECT clause.
	 */
	private function build_select_metrics( array $metrics ): string {
		$select_parts    = [];
		$exclude_bounces = $this->exclude_bounces();

		foreach ( $metrics as $metric ) {
			// Skip if not in allowed metrics list.
			if ( ! in_array( $metric, $this->allowed_metrics, true ) ) {
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
					if ( $this->use_lookup_tables() ) {
						$select_parts[] = 'statistics.device_id';
					} else {
						$select_parts[] = 'statistics.device';
					}
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
	private function build_where_clause( array $filters ): string {
		global $wpdb;
		$where_parts = [];

		foreach ( $filters as $key => $value ) {
			// Only process if key is in allowed list (already validated in sanitize_filters).
			if ( ! in_array( $key, $this->allowed_filter_keys, true ) ) {
				continue;
			}

			switch ( $key ) {
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
					if ( $this->use_lookup_tables() ) {
						// Convert device name to device_id if using lookup tables.
						$device_id     = $this->get_lookup_table_id( 'device', $value );
						$where_parts[] = $wpdb->prepare( 'statistics.device_id = %d', $device_id );
					} else {
						$where_parts[] = $wpdb->prepare( 'statistics.device = %s', $value );
					}
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
	 * Get metric labels for display purposes
	 *
	 * @return array<string, string> Array of metric names and their human-readable labels.
	 */
	public function get_metric_labels(): array {
		$labels = [
			'pageviews'           => __( 'Pageviews', 'burst-statistics' ),
			'visitors'            => __( 'Visitors', 'burst-statistics' ),
			'sessions'            => __( 'Sessions', 'burst-statistics' ),
			'bounce_rate'         => __( 'Bounce rate', 'burst-statistics' ),
			'avg_time_on_page'    => __( 'Average time on page', 'burst-statistics' ),
			'first_time_visitors' => __( 'New visitors', 'burst-statistics' ),
		];

		// Allow extensions to add their own metric labels.
		return apply_filters( 'burst_statistics_metric_labels', $labels );
	}

	/**
	 * Get post view count
	 *
	 * @param int $post_id The post ID.
	 * @param int $start_time Start timestamp (default: 0 for all time).
	 * @param int $end_time End timestamp (default: current time).
	 * @return int Number of pageviews.
	 */
	public function get_post_views( int $post_id, int $start_time = 0, int $end_time = 0 ): int {
		if ( $end_time === 0 ) {
			$end_time = time();
		}

		// Get relative page URL by post_id.
		$page_url = get_permalink( $post_id );

		// Strip home_url from page_url.
		$page_url = str_replace( home_url(), '', $page_url );

		$sql = $this->generate_statistics_query(
			$start_time,
			$end_time,
			[ 'pageviews' ],
			[ 'page_url' => $page_url ]
		);

		global $wpdb;

		// Execute query with error handling.
		$result = $wpdb->get_var( $sql );

		// Check for database errors.
		if ( $wpdb->last_error ) {
			// Log the error for debugging.
			self::error_log( 'DB Error in get_post_views(): ' . $wpdb->last_error );
			// Return safe default.
			return 0;
		}

		return $result ? (int) $result : 0;
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

		// Get posts sorted by pageviews.
		$args = [
			'post_type'   => $post_type,
			'numberposts' => $count,
			'meta_key'    => 'burst_total_pageviews_count',
			'orderby'     => 'meta_value_num',
			'order'       => 'DESC',
			'meta_query'  => [
				[
					'key'  => 'burst_total_pageviews_count',
					'type' => 'NUMERIC',
				],
			],
		];

		$posts = get_posts( $args );

		// Check if get_posts returned an error (WP_Error object).
		if ( is_wp_error( $posts ) ) {
			// Log the error for debugging.
			self::error_log( 'Error in get_most_viewed_posts(): ' . $posts->get_error_message() );
			// Return safe default.
			return [];
		}

		$result = [];

		foreach ( $posts as $post ) {
			// For time-specific queries, get actual view count for the period.
			if ( $start_time > 0 || $end_time < time() - DAY_IN_SECONDS ) {
				$view_count = $this->get_post_views( $post->ID, $start_time, $end_time );
			} else {
				// Use cached total for all-time or recent queries.
				$view_count = (int) get_post_meta( $post->ID, 'burst_total_pageviews_count', true );
			}

			$result[] = [
				'post'  => $post,
				'views' => $view_count,
			];
		}

		return $result;
	}

	/**
	 * Check if bounces should be excluded from statistics.
	 */
	public function exclude_bounces(): bool {
		if ( $this->exclude_bounces === null ) {
			$this->exclude_bounces = (bool) apply_filters( 'burst_exclude_bounces', $this->get_option_bool( 'exclude_bounces' ) );
		}
		return $this->exclude_bounces;
	}

	/**
	 * Check if lookup tables should be used (cached method)
	 *
	 * @return bool True if using lookup tables, false if using direct storage.
	 */
	private function use_lookup_tables(): bool {
		if ( $this->use_lookup_tables === null ) {
			$this->use_lookup_tables = ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' );
		}

		return $this->use_lookup_tables;
	}
}
