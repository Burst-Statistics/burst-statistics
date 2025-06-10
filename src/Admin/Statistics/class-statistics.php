<?php
namespace Burst\Admin\Statistics;

use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

class Statistics {
	use Helper;
	use Admin_Helper;
	use Database_Helper;

	private array $look_up_table_names = [];
	private $use_lookup_tables         = null;
	private $exclude_bounces           = null;
	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'burst_install_tables', [ $this, 'install_statistics_table' ], 10 );
		add_action( 'burst_daily', [ $this, 'update_page_visit_counts' ] );
		add_action( 'burst_upgrade_post_meta', [ $this, 'update_page_visit_counts' ] );
	}

	/**
	 * Update page visit counts
	 */
	public function update_page_visit_counts(): void {
		$offset = (int) get_option( 'burst_post_meta_offset', 0 );
		$chunk  = 100;

		$today = self::convert_unix_to_date( strtotime( 'today' ) );
		// deduct days offset in days.
		$yesterday = self::convert_unix_to_date( strtotime( $today . ' - 1 days' ) );

		// get start of $yesterday in unix.
		$date_start = self::convert_date_to_unix( $yesterday . ' 00:00:00' );
		// get end of $yesterday in unix.
		$date_end = self::convert_date_to_unix( $yesterday . ' 23:59:59' );

		$sql = $this->get_sql_table( $date_start, $date_end, [ 'page_url', 'pageviews' ], [], 'page_url', 'pageviews DESC' );
		// add offset.
		$sql .= " LIMIT $chunk OFFSET $offset";

		global $wpdb;
		$rows = $wpdb->get_results( $sql, ARRAY_A );

		if ( count( $rows ) === 0 ) {
			delete_option( 'burst_post_meta_offset' );
			wp_clear_scheduled_hook( 'burst_upgrade_post_meta' );
		} else {
			update_option( 'burst_post_meta_offset', $offset, false );
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_upgrade_post_meta' );
			if ( ! function_exists( 'url_to_post_id' ) ) {
				require_once ABSPATH . 'wp-includes/rewrite.php';
			}
			foreach ( $rows  as $row ) {
				$post_id = url_to_postid( $row['page_url'] );
				if ( $post_id === 0 ) {
					continue;
				}
				$pageviews = $this->get_post_views( $post_id, 0, time() );
				update_post_meta( $post_id, 'burst_total_pageviews_count', $pageviews );
			}
		}
	}

	/**
	 * Compare provided a metric with our defined list, return default count if not existing
	 */
	public function sanitize_metric( string $metric ): string {
		$defaults = $this->get_metrics();

		if ( isset( $defaults[ $metric ] ) ) {
			return $metric;
		}

		return 'visitors';
	}

	/**
	 * Sanitize a filter set by removing invalid entries and escaping SQL input.
	 *
	 * @return array<string, string>
	 */
	public function sanitize_filters( array $filters ): array {
		// Filter out false or empty values.
		$filters = array_filter(
			$filters,
			static function ( $item ) {
				return $item !== false && $item !== '';
			}
		);

		// Sanitize keys and values.
		$out = [];
		foreach ( $filters as $key => $value ) {
			$out[ esc_sql( $key ) ] = esc_sql( $value );
		}

		return $out;
	}

	/**
	 * Compare provided metrics with the defined list, and remove any that do not exist.
	 *
	 * @param array<int, string> $metrics List of requested metric keys.
	 * @return array<int, string> Filtered list of valid metric keys.
	 */
	public function sanitize_metrics( array $metrics ): array {
		$defaults = $this->get_metrics();
		foreach ( $metrics as $metric => $value ) {
			if ( ! isset( $defaults[ $value ] ) ) {
				unset( $metrics[ $metric ] );
			}
		}

		return $metrics;
	}

	/**
	 * Get array of metrics.
	 *
	 * @return array<string, string> Associative array of metric keys and their human-readable labels.
	 */
	public function get_metrics(): array {
		return apply_filters(
			'burst_metrics',
			[
				'page_url'            => __( 'Page URL', 'burst-statistics' ),
				'referrer'            => __( 'Referrer', 'burst-statistics' ),
				'pageviews'           => __( 'Pageviews', 'burst-statistics' ),
				'sessions'            => __( 'Sessions', 'burst-statistics' ),
				'visitors'            => __( 'Visitors', 'burst-statistics' ),
				'avg_time_on_page'    => __( 'Time on page', 'burst-statistics' ),
				'first_time_visitors' => __( 'New visitors', 'burst-statistics' ),
				'conversions'         => __( 'Conversions', 'burst-statistics' ),
				'bounces'             => __( 'Bounces', 'burst-statistics' ),
				'bounce_rate'         => __( 'Bounce rate', 'burst-statistics' ),
			]
		);
	}

	/**
	 * Sanitize an interval string
	 */
	public function sanitize_interval( string $metric ): string {
		$array = [
			'hour',
			'day',
			'week',
			'month',
		];
		if ( in_array( $metric, $array, true ) ) {
			return $metric;
		}

		return 'day';
	}

	/**
	 * Get the live visitors count
	 */
	public function get_live_visitors_data(): int {
		global $wpdb;

		// get real time visitors.
		$db_name        = $wpdb->prefix . 'burst_statistics';
		$time_start     = strtotime( '10 minutes ago' );
		$now            = time();
		$on_page_offset = apply_filters( 'burst_on_page_offset', 60 );
		$sql            = "SELECT count(DISTINCT(uid))
                    FROM $db_name
                        WHERE time > $time_start
                        AND ( (time + time_on_page / 1000  + $on_page_offset) > $now)";
		$live_value     = $wpdb->get_var( $sql );

		return max( (int) $live_value, 0 );
	}

	/**
	 * Get data for the Today block in the dashboard.
	 *
	 * @param array $args {
	 *     Optional. Date range for today's stats.
	 * @type int $date_start Start of today (timestamp).
	 *     @type int $date_end   End of today (timestamp).
	 * }
	 * @return array{
	 *     live: array{value: string, tooltip: string},
	 *     today: array{value: string, tooltip: string},
	 *     mostViewed: array{title: string, value: string, tooltip: string},
	 *     referrer: array{title: string, value: string, tooltip: string},
	 *     pageviews: array{title: string, value: string, tooltip: string},
	 *     timeOnPage: array{title: string, value: string, tooltip: string}
	 * }
	 */
	public function get_today_data( array $args = [] ): array {
		global $wpdb;

		// Setup default arguments and merge with input.
		$args = wp_parse_args(
			$args,
			[
				'date_start' => 0,
				'date_end'   => 0,
			]
		);

		// Cast start and end dates to integer.
		$start = (int) $args['date_start'];
		$end   = (int) $args['date_end'];

		// Prepare default data structure with predefined tooltips.
		$data = [
			'live'       => [
				'value'   => '0',
				'tooltip' => __( 'The amount of people using your website right now. The data updates every 5 seconds.', 'burst-statistics' ),
			],
			'today'      => [
				'value'   => '0',
				'tooltip' => __( 'This is the total amount of unique visitors for today.', 'burst-statistics' ),
			],
			'mostViewed' => [
				'title'   => '-',
				'value'   => '0',
				'tooltip' => __( 'This is your most viewed page for today.', 'burst-statistics' ),
			],
			'referrer'   => [
				'title'   => '-',
				'value'   => '0',
				'tooltip' => __( 'This website referred the most visitors.', 'burst-statistics' ),
			],
			'pageviews'  => [
				'title'   => __( 'Total pageviews', 'burst-statistics' ),
				'value'   => '0',
				'tooltip' => '',
			],
			'timeOnPage' => [
				'title'   => __( 'Average time on page', 'burst-statistics' ),
				'value'   => '0',
				'tooltip' => '',
			],
		];

		// Query today's data.
		$sql     = $this->get_sql_table( $start, $end, [ 'visitors', 'pageviews', 'avg_time_on_page' ] );
		$results = $wpdb->get_row( $sql, 'ARRAY_A' );
		if ( $results ) {
			$data['today']['value']      = max( 0, (int) $results['visitors'] );
			$data['pageviews']['value']  = max( 0, (int) $results['pageviews'] );
			$data['timeOnPage']['value'] = max( 0, (int) $results['avg_time_on_page'] );
		}

		// Query for most viewed page and top referrer.
		foreach (
			[
				'mostViewed' => [ 'page_url', 'pageviews' ],
				'referrer'   => [ 'referrer', 'pageviews' ],
			] as $key => $fields
		) {
			$sql   = $this->get_sql_table( $start, $end, $fields, [], $fields[0], 'pageviews DESC', 1 );
			$query = $wpdb->get_row( $sql, 'ARRAY_A' );
			if ( $query ) {
				$data[ $key ]['title'] = $query[ $fields[0] ];
				$data[ $key ]['value'] = $query['pageviews'];
			}
		}

		return $data;
	}


	/**
	 * Get date modifiers for insights charts, based on the date range.
	 *
	 * @param int $date_start Unix timestamp marking the start of the period.
	 * @param int $date_end   Unix timestamp marking the end of the period.
	 * @return array{
	 *     interval: string,
	 *     interval_in_seconds: mixed,
	 *     nr_of_intervals: int,
	 *     sql_date_format: string,
	 *     php_date_format: string,
	 *     php_pretty_date_format: string
	 * }
	 */
	public function get_insights_date_modifiers( int $date_start, int $date_end ): array {
		$nr_of_days = $this->get_nr_of_periods( 'day', $date_start, $date_end );

		$week_string         = _x( 'Week', 'Week 1, as in Week number 1', 'burst-statistics' );
		$escaped_week_string = '';
		for ( $i = 0, $i_max = strlen( $week_string ); $i < $i_max; $i++ ) {
			$escaped_week_string .= '\\' . $week_string[ $i ];
		}

		// Define intervals and corresponding settings.
		$intervals = [
			'hour'  => [ '%Y-%m-%d %H', 'Y-m-d H', 'd M H:00', HOUR_IN_SECONDS ],
			'day'   => [ '%Y-%m-%d', 'Y-m-d', 'D d M', DAY_IN_SECONDS ],
			'week'  => [ '%Y-%u', 'Y-W', $escaped_week_string . ' W', WEEK_IN_SECONDS ],
			'month' => [ '%Y-%m', 'Y-m', 'M', MONTH_IN_SECONDS ],
		];

		// Determine the interval.
		if ( $nr_of_days > 364 ) {
			$interval = 'month';
		} elseif ( $nr_of_days > 48 ) {
			$interval = 'week';
		} elseif ( $nr_of_days > 2 ) {
			$interval = 'day';
		} else {
			$interval = 'hour';
		}

		// Extract settings based on the determined interval.
		list( $sql_date_format, $php_date_format, $php_pretty_date_format, $interval_in_seconds ) = $intervals[ $interval ];

		$nr_of_intervals = $this->get_nr_of_periods( $interval, $date_start, $date_end );

		// check if $date_start does not equal the current year, so the year only shows if not the current year is in the dataset.
		$is_current_year = gmdate( 'Y', $date_start ) === gmdate( 'Y' );
		// if date_start and date_end are not in the same year, add Y or y to the php_pretty_date_format.
		$php_pretty_date_format .= $is_current_year ? '' : ' y';

		return [
			'interval'               => $interval,
			'interval_in_seconds'    => $interval_in_seconds,
			'nr_of_intervals'        => $nr_of_intervals,
			'sql_date_format'        => $sql_date_format,
			'php_date_format'        => $php_date_format,
			'php_pretty_date_format' => $php_pretty_date_format,
		];
	}

	/**
	 * Get insights data for charting purposes.
	 *
	 * @param array $args {
	 *     Optional. Parameters to define time range and metrics.
	 * @type int $date_start Start of the data range (timestamp).
	 * @type int $date_end End of the data range (timestamp).
	 * @type string[] $metrics List of metrics to retrieve (e.g., 'pageviews', 'visitors').
	 * @type array $filters Filters to apply to the query.
	 * }
	 * @return array{
	 *     labels: string[],
	 *     datasets: array<int, array{
	 *         data: list<int|float>,
	 *         backgroundColor: string,
	 *         borderColor: string,
	 *         label: string,
	 *         fill: string
	 *     }>
	 * }
	 * @throws \Exception //exception.
	 */
	public function get_insights_data( array $args = [] ): array {
		global $wpdb;
		$defaults      = [
			'date_start' => 0,
			'date_end'   => 0,
			'metrics'    => [ 'pageviews', 'visitors' ],
		];
		$args          = wp_parse_args( $args, $defaults );
		$metrics       = $this->sanitize_metrics( $args['metrics'] );
		$metric_labels = $this->get_metrics();
		$filters       = $this->sanitize_filters( (array) $args['filters'] );

		// generate labels for dataset.
		$labels = [];
		// if not interval is a string and string is not ''.
		$date_start     = (int) $args['date_start'];
		$date_end       = (int) $args['date_end'];
		$date_modifiers = $this->get_insights_date_modifiers( $date_start, $date_end );
		$datasets       = [];

		// foreach metric.
		foreach ( $metrics as $metrics_key => $metric ) {
			$datasets[ $metrics_key ] = [
				'data'            => [],
				'backgroundColor' => $this->get_metric_color( $metric, 'background' ),
				'borderColor'     => $this->get_metric_color( $metric, 'border' ),
				'label'           => $metric_labels[ $metric ],
				'fill'            => 'false',
			];
		}

		// we have a UTC corrected for timezone offset, to query in the statistics table.
		// to show the correct labels, we convert this back with the timezone offset.
		$timezone_offset = self::get_wp_timezone_offset();
		$date            = $date_start + $timezone_offset;
		for ( $i = 0; $i < $date_modifiers['nr_of_intervals']; $i++ ) {
			$formatted_date            = date_i18n( $date_modifiers['php_date_format'], $date );
			$labels[ $formatted_date ] = date_i18n( $date_modifiers['php_pretty_date_format'], $date );

			// loop through metrics and assign x to 0, 1 , 2, 3, etc.
			foreach ( $metrics as $metric_key => $metric ) {
				$datasets[ $metric_key ]['data'][ $formatted_date ] = 0;
			}

			// increment at the end so the first will still be zero.
			$date += $date_modifiers['interval_in_seconds'];
		}

		$select = $this->sanitize_metrics( $metrics );

		$sql  = $this->get_sql_table( $date_start, $date_end, $select, $filters, 'period', 'period', 0, [], $date_modifiers );
		$hits = $wpdb->get_results( $sql, ARRAY_A );

		// match data from db to labels.
		foreach ( $hits as $hit ) {
			// Get the period from the hit.
			$period = $hit['period'];
			// Loop through each metric.
			foreach ( $metrics as $metric_key => $metric_name ) {
				// Check if the period and the metric exist in the dataset.
				if ( isset( $datasets[ $metric_key ]['data'][ $period ] ) && isset( $hit[ $metric_name ] ) ) {
					// Update the value for the corresponding metric and period.
					$datasets[ $metric_key ]['data'][ $period ] = $hit[ $metric_name ];
				}
			}
		}

		// strip keys from array $labels to make it a simple array and work with ChartJS.
		$labels = array_values( $labels );
		foreach ( $metrics as $metric_key => $metric_name ) {
			// strip keys from array $datasets to make it a simple array.
			$datasets[ $metric_key ]['data'] = array_values( $datasets[ $metric_key ]['data'] );
		}

		return [
			'labels'   => $labels,
			'datasets' => $datasets,
		];
	}
	/**
	 * Get comparison data between two date ranges.
	 *
	 * @param array $args {
	 *     Optional. Arguments to define the time ranges and filters.
	 * @type int        $date_start          Start of current date range (timestamp).
	 *     @type int        $date_end            End of current date range (timestamp).
	 *     @type int|null   $compare_date_start  Optional. Start of comparison date range (timestamp).
	 *     @type int|null   $compare_date_end    Optional. End of comparison date range (timestamp).
	 *     @type array      $filters             Filters to apply to both data sets.
	 * }
	 * @return array{
	 *     current: array{
	 *         pageviews: int,
	 *         sessions: int,
	 *         visitors: int,
	 *         first_time_visitors: int,
	 *         avg_time_on_page: int,
	 *         bounced_sessions: int,
	 *         bounce_rate: float
	 *     },
	 *     previous: array{
	 *         pageviews: int,
	 *         sessions: int,
	 *         visitors: int,
	 *         bounced_sessions: int,
	 *         bounce_rate: float
	 *     }
	 * }
	 */
	public function get_compare_data( array $args = [] ): array {
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args     = wp_parse_args( $args, $defaults );

		$start = (int) $args['date_start'];
		$end   = (int) $args['date_end'];

		if ( isset( $args['compare_date_start'] ) && isset( $args['compare_date_end'] ) ) {
			$start_diff = (int) $args['compare_date_start'];
			$end_diff   = (int) $args['compare_date_end'];
		} else {
			$diff       = $end - $start;
			$start_diff = $start - $diff;
			$end_diff   = $end - $diff;
		}

		$filters = $this->sanitize_filters( (array) $args['filters'] );

		$select = [ 'visitors', 'pageviews', 'sessions', 'first_time_visitors', 'avg_time_on_page', 'bounce_rate' ];

		// current data.
		$current = $this->get_data( $select, $start, $end, $filters );

		// previous data.
		$previous = $this->get_data( $select, $start_diff, $end_diff, $filters );

		// bounces.
		$curr_bounces = $this->get_bounces( $start, $end, $filters );
		$prev_bounces = $this->get_bounces( $start_diff, $end_diff, $filters );

		// combine data.
		$data = [
			'current'  => [
				'pageviews'           => (int) $current['pageviews'],
				'sessions'            => (int) $current['sessions'],
				'visitors'            => (int) $current['visitors'],
				'first_time_visitors' => (int) $current['first_time_visitors'],
				'avg_time_on_page'    => (int) $current['avg_time_on_page'],
				'bounced_sessions'    => $curr_bounces,
				'bounce_rate'         => $current['bounce_rate'],
			],
			'previous' => [
				'pageviews'        => (int) $previous['pageviews'],
				'sessions'         => (int) $previous['sessions'],
				'visitors'         => (int) $previous['visitors'],
				'bounced_sessions' => $prev_bounces,
				'bounce_rate'      => $previous['bounce_rate'],
			],
		];

		return $data;
	}

	/**
	 * Get compare goals data.
	 *
	 * @param array $args {
	 *     Optional. Arguments to customize the comparison.
	 * @type int   $date_start  Start timestamp.
	 *     @type int   $date_end    End timestamp.
	 *     @type array $filters     Optional. Filters to apply, such as goal_id, country_code, etc.
	 * }
	 * @return array{
	 *     view: string,
	 *     current: array{
	 *         pageviews: int,
	 *         visitors: int,
	 *         sessions: int,
	 *         first_time_visitors: int,
	 *         conversions: int,
	 *         conversion_rate: float
	 *     },
	 *     previous: array{
	 *         pageviews: int,
	 *         visitors: int,
	 *         sessions: int,
	 *         conversions: int,
	 *         conversion_rate: float
	 *     }
	 * }
	 */
	public function get_compare_goals_data( array $args = [] ): array {
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args     = wp_parse_args( $args, $defaults );

		$start      = (int) $args['date_start'];
		$end        = (int) $args['date_end'];
		$diff       = $end - $start;
		$start_diff = $start - $diff;
		$end_diff   = $end - $diff;
		$filters    = $this->sanitize_filters( (array) $args['filters'] );

		$filters_without_goal = $filters;
		unset( $filters_without_goal['goal_id'] );

		$select = [ 'pageviews', 'visitors', 'sessions', 'first_time_visitors' ];
		// current data.
		$current = $this->get_data( $select, $start, $end, $filters_without_goal );

		$select = [ 'pageviews', 'sessions', 'visitors' ];
		// previous data.
		$previous = $this->get_data( $select, $start_diff, $end_diff, $filters_without_goal );

		// get amount of conversions for current period.
		$current_conversions  = $this->get_conversions( $start, $end, $filters );
		$previous_conversions = $this->get_conversions( $start_diff, $end_diff, $filters );

		$current_conversion_rate  = $this->calculate_conversion_rate( $current_conversions, (int) $current['pageviews'] );
		$previous_conversion_rate = $this->calculate_conversion_rate( $previous_conversions, (int) $previous['pageviews'] );

		// combine data.
		$data = [
			'view'     => 'goals',
			'current'  => [
				'pageviews'           => (int) $current['pageviews'],
				'visitors'            => (int) $current['visitors'],
				'sessions'            => (int) $current['sessions'],
				'first_time_visitors' => (int) $current['first_time_visitors'],
				'conversions'         => $current_conversions,
				'conversion_rate'     => $current_conversion_rate,
			],
			'previous' => [
				'pageviews'       => (int) $previous['pageviews'],
				'visitors'        => (int) $previous['visitors'],
				'sessions'        => (int) $previous['sessions'],
				'conversions'     => $previous_conversions,
				'conversion_rate' => $previous_conversion_rate,
			],
		];

		return $data;
	}

	/**
	 * Get data from the statistics table.
	 *
	 * @param array<int, string> $select   List of metric columns to select.
	 * @param int                $start    Start timestamp.
	 * @param int                $end      End timestamp.
	 * @param array              $filters  Filters to apply to the query.
	 * @return array<string, int|string|null> Associative array of selected metrics with their values.
	 */
	public function get_data( array $select, int $start, int $end, array $filters ): array {
		global $wpdb;
		$sql    = $this->get_sql_table( $start, $end, $select, $filters );
		$result = $wpdb->get_results( $sql, 'ARRAY_A' );

		return $result[0] ?? array_fill_keys( $select, 0 );
	}

	/**
	 * Get bounces for a given time period.
	 */
	private function get_bounces( int $start, int $end, array $filters ): int {
		global $wpdb;
		$sql = $this->get_sql_table( $start, $end, [ 'bounces' ], $filters );

		return (int) $wpdb->get_var( $sql );
	}

	/**
	 * Get conversions for a given time period.
	 */
	private function get_conversions( int $start, int $end, array $filters ): int {
		global $wpdb;

		// filter is goal id so pageviews returned are the conversions.
		$sql = $this->get_sql_table( $start, $end, [ 'conversions' ], $filters );

		return (int) $wpdb->get_var( $sql );
	}


	/**
	 * Get devices title and value data.
	 *
	 * @param array $args {
	 *     Optional. An associative array of arguments.
	 * @type int   $date_start   Start timestamp. Default 0.
	 *     @type int   $date_end     End timestamp. Default 0.
	 *     @type array $filters      Filters to apply. Default empty array.
	 * }
	 * @return array<string, array{count: int}> Associative array of device names and counts.
	 */
	public function get_devices_title_and_value_data( array $args = [] ): array {
		global $wpdb;
		$defaults     = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args         = wp_parse_args( $args, $defaults );
		$start        = (int) $args['date_start'];
		$end          = (int) $args['date_end'];
		$filters      = $this->sanitize_filters( (array) $args['filters'] );
		$goal_id      = $filters['goal_id'] ?? null;
		$country_code = $filters['country_code'] ?? null;

		// Conditional JOIN and WHERE based on the presence of goal_id.
		$join_clause = '';
		// if string is not '' then add 'AND' to the string.
		$where_clause = $this->get_where_clause_for_filters( $filters );
		if ( $goal_id !== null ) {
			$join_clause = "INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals ON statistics.ID = goals.statistic_id";
			// append to where clause.
			$where_clause .= $wpdb->prepare( ' AND goals.goal_id = %d ', $goal_id );
		}
		if ( $country_code !== null ) {
			$join_clause  .= " INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID ";
			$where_clause .= $wpdb->prepare( ' AND sessions.country_code = %s ', $country_code );
		}
		$use_lookup_tables = $this->use_lookup_tables();
		if ( $use_lookup_tables ) {
			// prepare replacement in variable.
            //phpcs:ignore
			$sql = $wpdb->prepare(
				"SELECT device_id, COUNT(device_id) AS count
                    FROM (
                        SELECT statistics.device_id 
                        FROM {$wpdb->prefix}burst_statistics AS statistics
                        $join_clause
                        WHERE time > %s
                        AND time < %s 
                        AND device_id > 0 
                        $where_clause
                    ) AS statistics
                    GROUP BY device_id;",
				$start,
				$end,
				$goal_id
			);
		} else {
			// replacement in variable.
            //phpcs:ignore
			$sql = $wpdb->prepare(
				"SELECT device, COUNT(device) AS count
                    FROM (
                        SELECT statistics.device 
                        FROM {$wpdb->prefix}burst_statistics AS statistics
                        $join_clause
                        WHERE time > %s
                        AND time < %s 
                        AND device IS NOT NULL 
                        AND device <> ''
                        $where_clause
                    ) AS statistics
                    GROUP BY device;",
				$start,
				$end,
				$goal_id
			);
		}

		$devices_result = $wpdb->get_results( $sql, ARRAY_A );

		$total   = 0;
		$devices = [];
		foreach ( $devices_result as $key => $data ) {
			$name             = $use_lookup_tables ? $this->get_lookup_table_name_by_id( 'device', $data['device_id'] ) : $data['device'];
			$devices[ $name ] = [
				'count' => $data['count'],
			];
			$total           += $data['count'];
		}
		$devices['all'] = [
			'count' => $total,
		];

		// setup defaults.
		$default_data = [
			'all'     => [
				'count' => 0,
			],
			'desktop' => [
				'count' => 0,
			],
			'tablet'  => [
				'count' => 0,
			],
			'mobile'  => [
				'count' => 0,
			],
			'other'   => [
				'count' => 0,
			],
		];

		return wp_parse_args( $devices, $default_data );
	}

	/**
	 * Get subtitles data for devices.
	 *
	 * @param array $args {
	 *     Optional. An associative array of arguments.
	 * @type int        $date_start   Start timestamp. Default 0.
	 *     @type int        $date_end     End timestamp. Default 0.
	 *     @type array      $filters      Filters to apply. Default empty array.
	 * }
	 * @return array{
	 *     desktop: array{os: string|false, browser: string|false},
	 *     tablet: array{os: string|false, browser: string|false},
	 *     mobile: array{os: string|false, browser: string|false},
	 *     other: array{os: string|false, browser: string|false}
	 * }
	 */
	public function get_devices_subtitle_data( array $args = [] ): array {
		global $wpdb;
		$defaults     = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args         = wp_parse_args( $args, $defaults );
		$start        = (int) $args['date_start'];
		$end          = (int) $args['date_end'];
		$devices      = [ 'desktop', 'tablet', 'mobile', 'other' ];
		$filters      = $this->sanitize_filters( (array) $args['filters'] );
		$goal_id      = $filters['goal_id'] ?? null;
		$country_code = $filters['country_code'] ?? '';

		// if string is not '' then add 'AND' to the string.
		$where_clause = $this->get_where_clause_for_filters( $filters );
		$data         = [];

		// Loop through results and add count to array.
		$use_lookup_tables = $this->use_lookup_tables();
		foreach ( $devices as $device ) {

			$common_sql = " FROM {$wpdb->prefix}burst_statistics AS statistics ";
			if ( $use_lookup_tables ) {
				$device_id  = \Burst\burst_loader()->frontend->tracking->get_lookup_table_id_cached( 'device', $device );
				$device_sql = $wpdb->prepare( ' device_id=%s ', $device_id );
				$where_sql  = $wpdb->prepare( " WHERE time > %d AND time < %d AND device_id >0 $where_clause", $start, $end );
			} else {
				$device_sql = $wpdb->prepare( ' device=%s ', $device );
				$where_sql  = $wpdb->prepare( " WHERE time > %d AND time < %d AND device IS NOT NULL AND device <> '' $where_clause", $start, $end );
			}

			// Conditional JOIN and WHERE based on the presence of goal_id.
			if ( $goal_id !== null ) {
				$common_sql .= " INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals ON statistics.ID = goals.statistic_id ";
				$where_sql  .= $wpdb->prepare( ' AND goals.goal_id = %d ', $goal_id );
			}

			if ( strlen( $country_code ) > 0 ) {
				$common_sql .= " INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID ";
				$where_sql  .= $wpdb->prepare( ' AND sessions.country_code = %s ', $country_code );
			}

			// Query for browser and OS.
			if ( $use_lookup_tables ) {
				// replacement in variable.
                //phpcs:ignore
				$sql         = $wpdb->prepare( "SELECT browser_id, platform_id FROM (SELECT browser_id, platform_id, COUNT(*) AS count, device_id $common_sql $where_sql AND browser_id>0 GROUP BY browser_id, platform_id ) AS grouped_devices WHERE $device_sql ORDER BY count DESC LIMIT 1", '' );
				$results     = $wpdb->get_row( $sql, ARRAY_A );
				$browser_id  = $results['browser_id'] ?? 0;
				$platform_id = $results['platform_id'] ?? 0;
				$browser     = $this->get_lookup_table_name_by_id( 'browser', $browser_id );
				$platform    = $this->get_lookup_table_name_by_id( 'platform', $platform_id );

			} else {
				// replacement in variable.
                //phpcs:ignore
				$sql      = $wpdb->prepare( "SELECT browser, platform FROM (SELECT browser, platform, COUNT(*) AS count, device $common_sql $where_sql AND browser IS NOT NULL GROUP BY browser, platform ) AS grouped_devices WHERE $device_sql ORDER BY count DESC LIMIT 1", '' );
				$results  = $wpdb->get_row( $sql, ARRAY_A );
				$browser  = $results['browser'] ?? false;
				$platform = $results['platform'] ?? false;
			}

			$data[ $device ] = [
				'os'      => $platform,
				'browser' => $browser,
			];
		}

		// setup defaults.
		$default_data = [
			'desktop' => [
				'os'      => '',
				'browser' => '',
			],
			'tablet'  => [
				'os'      => '',
				'browser' => '',
			],
			'mobile'  => [
				'os'      => '',
				'browser' => '',
			],
			'other'   => [
				'os'      => '',
				'browser' => '',
			],
		];

		return wp_parse_args( $data, $default_data );
	}

	/**
	 * This function retrieves data related to pages for a given period and set of metrics.
	 *
	 * @param array $args {
	 *     An associative array of arguments.
	 * @type int      $date_start The start date of the period to retrieve data for, as a Unix timestamp. Default is 0.
	 *     @type int      $date_end   The end date of the period to retrieve data for, as a Unix timestamp. Default is 0.
	 *     @type string[] $metrics    An array of metrics to retrieve data for. Default is array( 'pageviews' ).
	 *     @type array    $filters    An array of filters to apply to the data retrieval. Default is an empty array.
	 *     @type int      $limit      Optional. Limit the number of results. Default is 0.
	 * }
	 * @return array{
	 *     columns: array<int, array{name: string, id: string, sortable: string, right: string}>,
	 *     data: array<int, array<string, mixed>>,
	 *     metrics: array<int, string>
	 * }
	 * @todo Add support for exit rate, entrances, actual pagespeed, returning visitors, interactions per visit.
	 */
	public function get_datatables_data(
		array $args = []
	): array {
		global $wpdb;
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'metrics'    => [ 'pageviews' ],
			'filters'    => [],
			'limit'      => '',
		];
		$args     = wp_parse_args( $args, $defaults );
		$filters  = $this->sanitize_filters( (array) $args['filters'] );
		$metrics  = $this->sanitize_metrics( $args['metrics'] );
		$group_by = $this->sanitize_metrics( $args['group_by'] ?? [] );
		// group by from array to comma seperated string.
		$group_by      = implode( ',', $group_by );
		$metric_labels = $this->get_metrics();
		$start         = (int) $args['date_start'];
		$end           = (int) $args['date_end'];
		$columns       = [];
		$limit         = (int) ( $args['limit'] ?? 0 );

		// if metrics are not set return error.
		if ( empty( $metrics ) ) {
			$metrics = [
				'pageviews',
			];
		}

		foreach ( $metrics as $metric ) {
			$metric = $this->sanitize_metric( $metric );

			// if goal_id isset then metric is a conversion.
			$title = $metric_labels[ $metric ];

			$columns[] = [
				'name'     => $title,
				'id'       => $metric,
				'sortable' => 'true',
				'right'    => 'true',
			];
		}

		$last_metric_count = count( $metrics ) - 1;
		$order_by          = isset( $metrics[ $last_metric_count ] ) ? $metrics[ $last_metric_count ] . ' DESC' : 'pageviews DESC';

		$sql  = $this->get_sql_table( $start, $end, $metrics, $filters, $group_by, $order_by, $limit );
		$data = $wpdb->get_results( $sql, ARRAY_A );
		$data = apply_filters( 'burst_datatable_data', $data, $start, $end, $metrics, $filters, $group_by, $order_by, $limit );

		return [
			'columns' => $columns,
			'data'    => $data,
			'metrics' => $metrics,
		];
	}

	/**
	 * Get the SQL query for referrers
	 */
	public function get_referrers_sql( int $start, int $end, array $filters = [] ): string {
		$remove   = [ 'http://www.', 'https://www.', 'http://', 'https://' ];
		$site_url = str_replace( $remove, '', site_url() );
		$sql      = $this->get_sql_table( $start, $end, [ 'count', 'referrer' ], $filters );
		$sql     .= "AND referrer NOT LIKE '%$site_url%' GROUP BY referrer ORDER BY 1 DESC";

		return $sql;
	}

	/**
	 * Convert date string to unix timestamp (UTC) by correcting it with WordPress timezone offset
	 *
	 * @param string $time_string date string in format Y-m-d H:i:s.
	 * @throws \Exception //exception.
	 */
	public static function convert_date_to_unix(
		string $time_string
	): int {
		$time               = \DateTime::createFromFormat( 'Y-m-d H:i:s', $time_string );
		$utc_time           = $time ? $time->format( 'U' ) : strtotime( $time_string );
		$gmt_offset_seconds = self::get_wp_timezone_offset();

		return $utc_time - $gmt_offset_seconds;
	}

	/**
	 * The FROM_UNIXTIME takes into account the timezone offset from the mysql timezone settings. These can differ from the server settings.
	 *
	 * @throws \Exception //exception.
	 */
	private function get_mysql_timezone_offset(): int {
		global $wpdb;
		$mysql_timestamp    = $wpdb->get_var( 'SELECT FROM_UNIXTIME(UNIX_TIMESTAMP());' );
		$wp_timezone_offset = self::get_wp_timezone_offset();

		// round to half hours.
		$mysql_timezone_offset_hours = round( ( strtotime( $mysql_timestamp ) - time() ) / ( HOUR_IN_SECONDS / 2 ), 0 ) * 0.5;
		$wp_timezone_offset_hours    = round( $wp_timezone_offset / ( HOUR_IN_SECONDS / 2 ), 0 ) * 0.5;
		$offset                      = $wp_timezone_offset_hours - $mysql_timezone_offset_hours;
		return (int) $offset * HOUR_IN_SECONDS;
	}

	/**
	 * Get the offset in seconds from the selected timezone in WP
	 *
	 * @throws \Exception //exception.
	 */
	private static function get_wp_timezone_offset(): int {
		$timezone = wp_timezone();
		$datetime = new \DateTime( 'now', $timezone );
		return $timezone->getOffset( $datetime );
	}

	/**
	 * Convert unix timestamp to date string by gmt offset
	 */
	public static function convert_unix_to_date( int $unix_timestamp ): string {
		$adjusted_timestamp = $unix_timestamp + self::get_wp_timezone_offset();

		// Convert the adjusted timestamp to a DateTime object.
		$time = new \DateTime();
		$time->setTimestamp( $adjusted_timestamp );

		// Format the DateTime object to 'Y-m-d' format.
		return $time->format( 'Y-m-d' );
	}

	/**
	 * Get the number of periods between two dates.
	 *
	 * @param string $period   The period to calculate (e.g., 'day', 'week', 'month').
	 * @param int    $date_start Start date as a Unix timestamp.
	 * @param int    $date_end   End date as a Unix timestamp.
	 * @return int The number of periods between the two dates.
	 */
	private function get_nr_of_periods(
		string $period,
		int $date_start,
		int $date_end
	): int {
		$range_in_seconds  = $date_end - $date_start;
		$period_in_seconds = defined( strtoupper( $period ) . '_IN_SECONDS' ) ? constant( strtoupper( $period ) . '_IN_SECONDS' ) : DAY_IN_SECONDS;

		return (int) round( $range_in_seconds / $period_in_seconds );
	}

	/**
	 * Get color for a graph
	 */
	private function get_metric_color(
		string $metric = 'visitors',
		string $type = 'default'
	): string {
		$colors = [
			'visitors'    => [
				'background' => 'rgba(41, 182, 246, 0.2)',
				'border'     => 'rgba(41, 182, 246, 1)',
			],
			'pageviews'   => [
				'background' => 'rgba(244, 191, 62, 0.2)',
				'border'     => 'rgba(244, 191, 62, 1)',
			],
			'bounces'     => [
				'background' => 'rgba(215, 38, 61, 0.2)',
				'border'     => 'rgba(215, 38, 61, 1)',
			],
			'sessions'    => [
				'background' => 'rgba(128, 0, 128, 0.2)',
				'border'     => 'rgba(128, 0, 128, 1)',
			],
			'conversions' => [
				'background' => 'rgba(46, 138, 55, 0.2)',
				'border'     => 'rgba(46, 138, 55, 1)',
			],
		];
		if ( ! isset( $colors[ $metric ] ) ) {
			$metric = 'visitors';
		}
		if ( ! isset( $colors[ $metric ][ $type ] ) ) {
			$type = 'default';
		}

		return $colors[ $metric ][ $type ];
	}

	/**
	 * Get statistics for the dashboard widget.
	 *
	 * @return array{
	 *     visitors: int,
	 *     visitors_uplift: string,
	 *     visitors_uplift_status: string,
	 *     time_per_session: float,
	 *     time_per_session_uplift: string,
	 *     time_per_session_uplift_status: string,
	 *     top_referrer: string,
	 *     top_referrer_pageviews: int,
	 *     most_visited: string,
	 *     most_visited_pageviews: int
	 * }
	 */
	public function get_dashboard_widget_statistics(
		int $date_start = 0,
		int $date_end = 0
	): array {
		global $wpdb;
		$time_diff       = $date_end - $date_start;
		$date_start_diff = $date_start - $time_diff;
		$date_end_diff   = $date_end - $time_diff;

		$curr_data = $wpdb->get_results(
			$this->get_sql_table(
				$date_start,
				$date_end,
				[
					'visitors',
					'sessions',
					'pageviews',
					'avg_time_on_page',
				]
			)
		);
		$prev_data = $wpdb->get_results(
			$this->get_sql_table(
				$date_start_diff,
				$date_end_diff,
				[
					'visitors',
					'sessions',
					'pageviews',
					'avg_time_on_page',
				]
			)
		);

		// calculate uplift for visitors.
		$visitors               = $curr_data[0]->visitors;
		$visitors_uplift        = $this->format_uplift( $prev_data[0]->visitors, $visitors );
		$visitors_uplift_status = $this->calculate_uplift_status( $prev_data[0]->visitors, $visitors );

		// time per session = avg time_on_page / avg pageviews per session.
		$average_pageviews_per_session = ( (int) $curr_data[0]->sessions !== 0 ) ? ( $curr_data[0]->pageviews / $curr_data[0]->sessions ) : 0;
		$time_per_session              = $curr_data[0]->avg_time_on_page / max( 1, $average_pageviews_per_session );

		// prev time per session.
		$prev_average_pageviews_per_session = ( (int) $prev_data[0]->sessions !== 0 ) ? ( $prev_data[0]->pageviews / $prev_data[0]->sessions ) : 0;
		$prev_time_per_session              = $prev_data[0]->avg_time_on_page / max( 1, $prev_average_pageviews_per_session );

		// calculate uplift for time per session.
		$time_per_session_uplift        = $this->format_uplift( $prev_time_per_session, $time_per_session );
		$time_per_session_uplift_status = $this->calculate_uplift_status( $prev_time_per_session, $time_per_session );

		// get top referrer.
		$top_referrer = $wpdb->get_results(
			$this->get_sql_table(
				$date_start,
				$date_end,
				[
					'pageviews',
					'referrer',
				],
				[ 'referrer' ],
				'pageviews DESC',
				'1'
			)
		);
		if ( isset( $top_referrer[0] ) ) {
			if ( $top_referrer[0]->referrer === 'Direct' ) {
				$top_referrer[0]->referrer = __( 'Direct', 'burst-statistics' );
			} elseif ( $top_referrer[0]->pageviews === 0 ) {
				$top_referrer[0]->referrer = __( 'No referrers', 'burst-statistics' );
			}
		}

		// get most visited page.
		$most_visited = $wpdb->get_results(
			$this->get_sql_table(
				$date_start,
				$date_end,
				[
					'pageviews',
					'page_url',
				],
				[ 'page_url' ],
				'pageviews DESC',
				'1'
			)
		);
		if ( isset( $most_visited[0] ) ) {
			if ( $most_visited[0]->page_url === '/' ) {
				$most_visited[0]->page_url = __( 'Homepage', 'burst-statistics' );
			} elseif ( $most_visited[0]->pageviews === 0 ) {
				$most_visited[0]->page_url = __( 'No pageviews', 'burst-statistics' );
			}
		}
		// Create the result array.
		$result                                   = [];
		$result['visitors']                       = $visitors;
		$result['visitors_uplift']                = $visitors_uplift;
		$result['visitors_uplift_status']         = $visitors_uplift_status;
		$result['time_per_session']               = $time_per_session;
		$result['time_per_session_uplift']        = $time_per_session_uplift;
		$result['time_per_session_uplift_status'] = $time_per_session_uplift_status;
		$result['top_referrer']                   = isset( $top_referrer[0]->referrer ) ? $top_referrer[0]->referrer : __( 'No referrers', 'burst-statistics' );
		$result['top_referrer_pageviews']         = isset( $top_referrer[0]->pageviews ) ? $top_referrer[0]->pageviews : 0;
		$result['most_visited']                   = isset( $most_visited[0]->page_url ) ? $most_visited[0]->page_url : __( 'No pageviews', 'burst-statistics' );
		$result['most_visited_pageviews']         = isset( $top_referrer[0]->pageviews ) ? $top_referrer[0]->pageviews : 0;

		return $result;
	}

	/**
	 * Helper function to get percentage, allow for zero division
	 */
	private function calculate_ratio(
		int $value,
		int $total,
		string $type = '%'
	): float {
		$multiply = 1;
		if ( $type === '%' ) {
			$multiply = 100;
		}

		return $total === 0 ? 0 : round( $value / $total * $multiply, 1 );
	}

	/**
	 * Calculate the conversion rate
	 */
	private function calculate_conversion_rate(
		int $value,
		int $total
	): float {
		return $this->calculate_ratio( $value, $total, '%' );
	}

	/**
	 * Cached method to check if lookup tables should be used.
	 */
	public function use_lookup_tables(): bool {

		if ( $this->use_lookup_tables === null ) {
			$this->use_lookup_tables = ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' );
		}

		return $this->use_lookup_tables;
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
	 * Generates a WHERE clause for SQL queries based on provided filters.
	 *
	 * @param array $filters Associative array of filters.
	 * @return string WHERE clause for SQL query.
	 */
	private function get_where_clause_for_filters( array $filters = [] ): string {
		$filters       = $this->sanitize_filters( $filters );
		$where_clauses = [];

		$id = $this->use_lookup_tables() ? '_id' : '';

		// Define filters including their table prefixes.
		$possible_filters_with_prefix = apply_filters(
			'burst_possible_filters_with_prefix',
			[
				'bounce'       => 'statistics.bounce',
				'page_url'     => 'statistics.page_url',
				'referrer'     => 'statistics.referrer',
				'device'       => 'statistics.device' . $id,
				'browser'      => 'statistics.browser' . $id,
				'platform'     => 'statistics.platform' . $id,
				// Assuming 'country_code' filter is in the 'sessions' table.
				'country_code' => 'sessions.country_code',
				// allow filtering by goal_id.
				'goal_id'      => 'goals.goal_id',
			]
		);

		if ( $this->use_lookup_tables() ) {
			$mappable = [
				'browser',
				'browser_version',
				'platform',
				'device',
			// only device, browser and platform in use at the moment, but leave it here for extension purposes.
			];
			foreach ( $filters as $filter_name => $filter_value ) {
				if ( in_array( $filter_name, $mappable, true ) ) {
					$filters[ $filter_name ] = \Burst\burst_loader()->frontend->tracking->get_lookup_table_id_cached( $filter_name, $filter_value );
				}
			}
		}

		foreach ( $filters as $filter => $value ) {
			if ( array_key_exists( $filter, $possible_filters_with_prefix ) ) {
				$qualified_name = $possible_filters_with_prefix[ $filter ];

				if ( is_numeric( $value ) ) {
					$where_clauses[] = "{$qualified_name} = " . intval( $value );
				} else {
					$value = esc_sql( sanitize_text_field( $value ) );
					if ( $filter === 'referrer' ) {
						$value           = ( $value === __( 'Direct', 'burst-statistics' ) ) ? "''" : "'%{$value}'";
						$where_clauses[] = "{$qualified_name} LIKE {$value}";
					} else {
						$where_clauses[] = "{$qualified_name} = '{$value}'";
					}
				}
			}
		}

		// Construct the WHERE clause.
		$where = implode( ' AND ', $where_clauses );

		return ! empty( $where ) ? "AND $where " : '';
	}

	/**
	 * Get query for statistics
	 */
	public function get_sql_table( int $start, int $end, array $select = [ '*' ], array $filters = [], string $group_by = '', string $order_by = '', int $limit = 0, array $joins = [], array $date_modifiers = [] ): string {
		$raw = count( $date_modifiers ) > 0 && strpos( $date_modifiers['sql_date_format'], '%H' ) !== false;
		if ( ! $raw && \Burst\burst_loader()->admin->summary->upgrade_completed() && \Burst\burst_loader()->admin->summary->is_summary_data( $select, $filters, $start, $end ) ) {
			return \Burst\burst_loader()->admin->summary->summary_sql( $start, $end, $select, $group_by, $order_by, $limit, $date_modifiers );
		}
		$sql = $this->get_sql_table_raw( $start, $end, $select, $filters, $group_by, $order_by, $limit, $joins );
		if ( count( $date_modifiers ) > 0 ) {
			$timezone_offset = $this->get_mysql_timezone_offset();
			$sql             = str_replace( 'SELECT', "SELECT DATE_FORMAT(FROM_UNIXTIME( time + $timezone_offset ), '{$date_modifiers['sql_date_format']}') as period,", $sql );
		}

		return $sql;
	}


	/**
	 * Function to get the SQL query to exclude bounces from query's
	 */
	public function get_sql_table_raw( int $start, int $end, array $select = [ '*' ], array $filters = [], string $group_by = '', string $order_by = '', int $limit = 0, array $joins = [] ): string {
		global $wpdb;
		$filters    = esc_sql( $filters );
		$select     = esc_sql( $select );
		$group_by   = esc_sql( $group_by );
		$order_by   = esc_sql( $order_by );
		$limit      = $limit;
		$select     = $this->get_sql_select_for_metrics( $select );
		$table_name = $wpdb->prefix . 'burst_statistics';
		$where      = $this->get_where_clause_for_filters( $filters );

		// if $select string contains referrer add where clause for referrer.
		if ( strpos( $select, 'referrer' ) !== false ) {
			$remove   = [ 'http://www.', 'https://www.', 'http://', 'https://' ];
			$site_url = str_replace( $remove, '', site_url() );
			$where   .= "AND referrer NOT LIKE '%$site_url%'";
		}

		if ( $this->is_pro() && strpos( $select, 'parameters,' ) !== false ) {
			$where .= "AND parameters IS NOT NULL AND parameters != ''";
		}

		if ( $this->is_pro() && strpos( $select, 'parameter,' ) !== false ) {
			$where .= "AND parameter IS NOT NULL AND parameter != '='";
		}

		$available_joins = apply_filters(
			'burst_available_joins',
			[
				'sessions' => [
					'table' => 'burst_sessions',
					'on'    => 'statistics.session_id = sessions.ID',
					// Optional, default is INNER JOIN.
					'type'  => 'INNER',
				],
				'goals'    => [
					'table' => 'burst_goal_statistics',
					'on'    => 'statistics.ID = goals.statistic_id',
					// Optional, default is INNER JOIN.
					'type'  => 'LEFT',
				],
			]
		);

		// find possible joins in $select and $where.
		foreach ( $available_joins as $join => $table ) {
			if ( strpos( $select, $join . '.' ) !== false || strpos( $where, $join . '.' ) !== false ) {
				$joins[ $join ] = $table;
			}
		}

		$join_sql = '';
		foreach ( $joins as $key => $join ) {
			$join_table = $wpdb->prefix . $join['table'];
			$join_on    = $join['on'];
			$join_type  = $join['type'] ?? 'INNER';
			$join_sql  .= " {$join_type} JOIN {$join_table} AS {$key} ON {$join_on}";
		}

		$table_name .= ' AS statistics';

		// if parameter is in select, then we need to join the parameters table.
		if ( strpos( $select, 'parameter,' ) !== false ) {
			// replcae the group by with the parameter.
			$group_by = 'parameters.parameter, parameters.value';
			// if parameters is also in the group by then we need to add the parameters table to the join.
			if ( strpos( $select, 'parameters,' ) !== false ) {
				// if group by is set then we add a comma and statistics.parameters to the group by. If not then it just becomes statistics.parameters.
				$group_by = $group_by . ', statistics.parameters';
			}
		}

		$group_by  = strlen( $group_by ) > 0 ? "GROUP BY $group_by" : '';
		$order_by  = strlen( $order_by ) > 0 ? "ORDER BY $order_by" : '';
		$limit_sql = $limit > 0 ? 'LIMIT ' . $limit : '';

		$sql = "SELECT $select FROM $table_name $join_sql WHERE time > $start AND time < $end $where $group_by $order_by $limit_sql";
		return $sql;
	}

	/**
	 * Generate SQL for a metric
	 */
	public function get_sql_select_for_metric( string $metric ): string {
		$exclude_bounces = $this->exclude_bounces();

		global $wpdb;
		// if metric starts with  'count(' and ends with ')', then it's a custom metric.
		// so we sanitize it and return it.
		if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
			// delete the 'count(' and ')' from the metric.
			// sanitize_title and wrap it in count().
			return 'count(' . sanitize_title( substr( $metric, 6, - 1 ) ) . ')';
		}
		// using COALESCE to prevent NULL values in the output, in the today.
		switch ( $metric ) {
			case 'pageviews':
			case 'count':
				$sql = $exclude_bounces ? 'COALESCE( SUM( CASE WHEN bounce = 0 THEN 1 ELSE 0 END ), 0)' : 'COUNT( statistics.ID )';
				break;
			case 'bounces':
				$sql = 'COALESCE( SUM( CASE WHEN bounce = 1 THEN 1 ELSE 0 END ), 0)';
				break;
			case 'bounce_rate':
				$sql = 'SUM( statistics.bounce ) / COUNT( DISTINCT statistics.session_id ) * 100';
				break;
			case 'sessions':
				$sql = $exclude_bounces ? 'COUNT( DISTINCT CASE WHEN bounce = 0 THEN statistics.session_id END )' : 'COUNT( DISTINCT statistics.session_id )';
				break;
			case 'avg_time_on_page':
				$sql = $exclude_bounces ? 'COALESCE( AVG( CASE WHEN bounce = 0 THEN statistics.time_on_page END ), 0 )' : 'AVG( statistics.time_on_page )';
				break;
			case 'first_time_visitors':
				$sql = $exclude_bounces ? 'COALESCE( SUM( CASE WHEN bounce = 0 THEN statistics.first_time_visit ELSE 0 END ), 0 ) ' : 'SUM( statistics.first_time_visit )';
				break;
			case 'visitors':
				$sql = $exclude_bounces ? 'COUNT(DISTINCT CASE WHEN bounce = 0 THEN statistics.uid END)' : 'COUNT(DISTINCT statistics.uid)';
				break;
			case 'page_url':
				$sql = 'statistics.page_url';
				break;
			case 'referrer':
				$remove   = [ 'http://www.', 'https://www.', 'http://', 'https://' ];
				$site_url = str_replace( $remove, '', site_url() );
				$sql      = $wpdb->prepare(
					"CASE
                   WHEN statistics.referrer = '' OR statistics.referrer IS NULL OR statistics.referrer LIKE %s THEN 'Direct'
                   ELSE trim( 'www.' from substring(statistics.referrer, locate('://', statistics.referrer) + 3))
               END",
					'%' . $wpdb->esc_like( $site_url ) . '%'
				);
				break;
			case 'conversions':
				$sql = 'count( goals.goal_id )';
				break;
			default:
				$sql = apply_filters( 'burst_select_sql_for_metric', $metric );
				break;
		}
		if ( $sql === false ) {
			$sql = '';
			self::error_log( 'No SQL for metric: ' . $metric );
		}

		return $sql;
	}

	/**
	 * Get select sql for metrics
	 */
	public function get_sql_select_for_metrics( array $metrics ): string {
		$metrics = array_map( 'esc_sql', $metrics );
		$select  = '';
		$count   = count( $metrics );
		$i       = 1;
		foreach ( $metrics as $metric ) {
			$sql = $this->get_sql_select_for_metric( $metric );
			if ( $sql !== '' && $metric !== '*' ) {
				// if metric starts with  'count(' and ends with ')', then it's a custom metric.
				// so we change the $metric name to 'metric'_count.
				if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
					// strip the 'count(' and ')' from the metric.
					$metric  = substr( $metric, 6, - 1 );
					$metric .= '_count';
				}
				$select .= $sql . ' as ' . $metric;
			} else {
				// if it's a wildcard, then we don't need to add the alias.
				$select .= '*';
			}

			// if it's not the last metric, then we need to add a comma.
			if ( $count !== $i ) {
				$select .= ', ';
			}
			++$i;
		}

		return $select;
	}

	/**
	 * Function to format uplift
	 */
	public function format_uplift(
		float $original_value,
		float $new_value
	): string {
		$uplift = $this->format_number( $this->calculate_uplift( $new_value, $original_value ), 0 );
		if ( $uplift === '0' ) {
			return '';
		}

		return (int) $uplift > 0 ? '+' . $uplift . '%' : $uplift . '%';
	}

	/**
	 * Format number with correct decimal and thousands separator
	 */
	public function format_number( int $number, int $precision = 2 ): string {
		if ( $number === 0 ) {
			return '0';
		}
		$number_rounded = round( $number );
		if ( $number < 10000 ) {
			// if difference is less than 1.
			if ( $number_rounded - $number > 0 && $number_rounded - $number < 1 ) {
				// return number with specified decimal precision.
				return number_format_i18n( $number, $precision );
			}

			// return number without decimal.
			return number_format_i18n( $number );
		}

		$divisors = [
			// 1000^0 == 1.
			1000 ** 0 => '',
			// Thousand - kilo.
			1000 ** 1 => 'k',
			// Million - mega.
			1000 ** 2 => 'M',
			// Billion - giga.
			1000 ** 3 => 'G',
			// Trillion - tera.
			1000 ** 4 => 'T',
			// quadrillion - peta.
			1000 ** 5 => 'P',
		];

		// Loop through each $divisor and find the.
		// lowest amount that matches.
		$divisor   = 1;
		$shorthand = '';

		foreach ( $divisors as $loop_divisor => $loop_shorthand ) {
			if ( abs( $number ) < ( $loop_divisor * 1000 ) ) {
				$divisor   = $loop_divisor;
				$shorthand = $loop_shorthand;
				break;
			}
		}
		// We found our match, or there were no matches.
		// Either way, use the last defined value for $divisor.
		$number_rounded = round( $number / $divisor );
		$number        /= $divisor;
		// if difference is less than 1.
		if ( $number_rounded - $number > 0 && $number_rounded - $number < 1 ) {
			// return number with specified decimal precision.
			return number_format_i18n( $number, $precision ) . $shorthand;
		}

		// return number without decimal.
		return number_format_i18n( $number ) . $shorthand;
	}

	/**
	 * Function to calculate uplift
	 */
	public function calculate_uplift(
		float $original_value,
		float $new_value
	): int {
		$increase = $original_value - $new_value;
		return (int) $this->calculate_ratio( (int) $increase, (int) $new_value );
	}

	/**
	 * Function to calculate uplift status
	 */
	public function calculate_uplift_status(
		float $original_value,
		float $new_value
	): string {
		$status = '';
		$uplift = $this->calculate_uplift( $new_value, $original_value );

		if ( $uplift > 0 ) {
			$status = 'positive';
		} elseif ( $uplift < 0 ) {
			$status = 'negative';
		}

		return $status;
	}


	/**
	 * Get post_views by post_id
	 */
	public function get_post_views( int $post_id, int $date_start = 0, int $date_end = 0 ): int {
		// get relative page url by post_id.
		$page_url = get_permalink( $post_id );
		// strip home_url from page_url.
		$page_url = str_replace( home_url(), '', $page_url );
		$sql      = $this->get_sql_table( $date_start, $date_end, [ 'pageviews' ], [ 'page_url' => $page_url ] );
		global $wpdb;
		$data = $wpdb->get_row( $sql );
		if ( $data && isset( $data->pageviews ) ) {
			return (int) $data->pageviews;
		}
		return 0;
	}

	/**
	 * Get Name from lookup table
	 */
	public function get_lookup_table_name_by_id( string $item, int $id ): string {
		if ( $id === 0 ) {
			return '';
		}

		$possible_items = [ 'browser', 'browser_version', 'platform', 'device' ];
		if ( ! in_array( $item, $possible_items, true ) ) {
			return '';
		}

		if ( isset( $this->look_up_table_names[ $item ][ $id ] ) ) {
			return $this->look_up_table_names[ $item ][ $id ];
		}

		// check if $value exists in tabel burst_$item.
		$name = wp_cache_get( 'burst_' . $item . '_' . $id, 'burst' );
		if ( ! $name ) {
			global $wpdb;
			$name = $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$wpdb->prefix}burst_{$item}s WHERE ID = %s LIMIT 1", $id ) );
			wp_cache_set( 'burst_' . $item . '_' . $id, $name, 'burst' );
		}
		$this->look_up_table_names[ $item ][ $id ] = $name;
		return (string) $name;
	}

	/**
	 * Install statistic table
	 * */
	public function install_statistics_table(): void {
		// used in test.
		self::error_log( 'Upgrading database tables for Burst Statistics' );

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		// Create tables without indexes first.
		$tables = [
			'burst_statistics'       => "CREATE TABLE {$wpdb->prefix}burst_statistics (
        `ID` int NOT NULL AUTO_INCREMENT,
        `page_url` varchar(191) NOT NULL,
        `time` int NOT NULL,
        `uid` varchar(255) NOT NULL,
        `time_on_page` int,
        `parameters` TEXT NOT NULL,
        `fragment` varchar(255) NOT NULL,
        `referrer` varchar(255),
        `browser_id` int(11) NOT NULL,
        `browser_version_id` int(11) NOT NULL,
        `platform_id` int(11) NOT NULL,
        `device_id` int(11) NOT NULL,
        `session_id` int,
        `first_time_visit` tinyint,
        `bounce` tinyint DEFAULT 1,
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
			'burst_summary'          => "CREATE TABLE {$wpdb->prefix}burst_summary (
        `ID` int NOT NULL AUTO_INCREMENT,
        `date` DATE NOT NULL,
        `page_url` varchar(191) NOT NULL,
        `sessions` int NOT NULL,
        `visitors` int NOT NULL,
        `first_time_visitors` int NOT NULL,
        `pageviews` int NOT NULL,
        `bounces` int NOT NULL,
        `avg_time_on_page` int NOT NULL,
        `completed` tinyint NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
		];

		// Create tables.
		foreach ( $tables as $table_name => $sql ) {
			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( "Error creating table {$table_name}: " . $wpdb->last_error );
			}
		}

		$indexes = [
			[ 'time' ],
			[ 'bounce' ],
			[ 'page_url' ],
			[ 'session_id' ],
			[ 'time', 'page_url' ],
			[ 'uid', 'time' ],
		];

		$table_name = $wpdb->prefix . 'burst_statistics';
		foreach ( $indexes as $index ) {
			$this->add_index( $table_name, $index );
		}

		$indexes = [
			[ 'date', 'page_url' ],
			[ 'page_url', 'date' ],
			[ 'date' ],
		];

		$table_name = $wpdb->prefix . 'burst_summary';
		foreach ( $indexes as $index ) {
			$this->add_index( $table_name, $index );
		}
	}
}
