<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );

if ( ! class_exists( 'burst_statistics' ) ) {
	class burst_statistics {

		private $look_up_table_names = array();
		private $use_lookup_tables = null;

		function __construct() {
		}

		/**
		 * @param string $metric
		 *
		 * Compare provided a metric with our defined list, return default count if not existing
		 */
		public function sanitize_metric( $metric ) {
			$defaults = $this->get_metrics();

			if ( isset( $defaults[ $metric ] ) ) {
				return $metric;
			}

			return 'visitors';
		}

		/**
		 * @param array $metrics
		 *
		 * Compare provided a metric with our defined list, remove if not exists
		 */
		public function sanitize_metrics( $metrics ) {
			$defaults = $this->get_metrics();
			foreach ( $metrics as $metric => $value ) {
				if ( ! isset( $defaults[ $value ] ) ) {
					burst_error_log( 'Metric ' . $value . ' does not exist' );
					unset( $metrics[ $metric ] );
				}
			}

			return $metrics;
		}

		public function get_metrics() {
			return apply_filters(
				'burst_metrics',
				array(
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
				)
			);
		}

		public function sanitize_interval( $metric ) {
			$array = array(
				'hour',
				'day',
				'week',
				'month',
			);
			if ( in_array( $metric, $array ) ) {
				return $metric;
			}

			return 'day';
		}

		public function get_live_visitors_data() {
			global $wpdb;

			// get real time visitors
			$db_name        = $wpdb->prefix . 'burst_statistics';
			$time_start     = strtotime( '10 minutes ago' );
			$now            = time();
			$on_page_offset = apply_filters( 'burst_on_page_offset', 60 );
			$sql            = "SELECT count(DISTINCT(uid))
                     	FROM $db_name
                     		WHERE time > $time_start
                       		AND ( (time + time_on_page / 1000  + $on_page_offset) > $now)";
			$live_value     = $wpdb->get_var( $sql );

			return (int) $live_value > 0 ? $live_value : 0;
		}

		public function get_today_data( $args = [] ) {
			global $wpdb;

			// Setup default arguments and merge with input
			$args = wp_parse_args(
				$args,
				array(
					'date_start' => 0,
					'date_end'   => 0,
				)
			);

			// Cast start and end dates to integer
			$start = (int) $args['date_start'];
			$end   = (int) $args['date_end'];

			// Prepare default data structure with predefined tooltips
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

			// Query today's data
			$sql     = $this->get_sql_table( $start, $end, array( 'visitors', 'pageviews', 'avg_time_on_page' ) );
			$results = $wpdb->get_row( $sql, 'ARRAY_A' );
			if ( $results ) {
				$data['today']['value']      = max( 0, (int) $results['visitors'] );
				$data['pageviews']['value']  = max( 0, (int) $results['pageviews'] );
				$data['timeOnPage']['value'] = max( 0, (int) $results['avg_time_on_page'] );
			}

			// Query for most viewed page and top referrer
			foreach (
				array(
					'mostViewed' => [ 'page_url', 'pageviews' ],
					'referrer'   => array( 'referrer', 'pageviews' ),
				) as $key => $fields
			) {
				$sql   = $this->get_sql_table( $start, $end, $fields, array(), $fields[0], 'pageviews DESC', 'LIMIT 1' );
				$query = $wpdb->get_row( $sql, 'ARRAY_A' );
				if ( $query ) {
					$data[ $key ]['title'] = $query[ $fields[0] ];
					$data[ $key ]['value'] = $query['pageviews'];
				}
			}

			return $data;
		}


		/**
		 * @param $date_start    int
		 *                       Unix timestamp
		 * @param $date_end      int
		 *                       Unix timestamp
		 *
		 * @return array
		 */
		public function get_insights_date_modifiers( $date_start, $date_end ) {
			$nr_of_days = $this->get_nr_of_periods( 'day', $date_start, $date_end );

			$week_string         = _x( 'Week', 'Week 1, as in Week number 1', 'burst-statistics' );
			$escaped_week_string = '';
			for ( $i = 0, $iMax = strlen( $week_string ); $i < $iMax; $i ++ ) {
				$escaped_week_string .= '\\' . $week_string[ $i ];
			}

			// Define intervals and corresponding settings
			$intervals = array(
				'hour'  => [ '%Y-%m-%d %H', 'Y-m-d H', 'd M H:00', HOUR_IN_SECONDS ],
				'day'   => [ '%Y-%m-%d', 'Y-m-d', 'D d M', DAY_IN_SECONDS ],
				'week'  => [ '%Y-%u', 'Y-W', $escaped_week_string . ' W', WEEK_IN_SECONDS ],
				'month' => [ '%Y-%m', 'Y-m', 'M', MONTH_IN_SECONDS ],
			);

			// Determine the interval
			if ( $nr_of_days > 364 ) {
				$interval = 'month';
			} else if ( $nr_of_days > 48 ) {
				$interval = 'week';
			} else if ( $nr_of_days > 2 ) {
				$interval = 'day';
			} else {
				$interval = 'hour';
			}

			// Extract settings based on the determined interval
			list( $sql_date_format, $php_date_format, $php_pretty_date_format, $interval_in_seconds ) = $intervals[ $interval ];

			$nr_of_intervals = $this->get_nr_of_periods( $interval, $date_start, $date_end );

			// check if $date_start does not equal the current year, so the year only shows if not the current year is in the dataset
			$is_current_year = date( 'Y', $date_start ) === date( 'Y' );
			// if date_start and date_end are not in the same year, add Y or y to the php_pretty_date_format
			$php_pretty_date_format .= $is_current_year ? '' : ' y';

			return array(
				'interval'               => $interval,
				'interval_in_seconds'    => $interval_in_seconds,
				'nr_of_intervals'        => $nr_of_intervals,
				'sql_date_format'        => $sql_date_format,
				'php_date_format'        => $php_date_format,
				'php_pretty_date_format' => $php_pretty_date_format,
			);
		}


		public function get_insights_data( $args = [] ) {
			global $wpdb;
			$defaults      = [
				'date_start' => 0,
				'date_end'   => 0,
				'metrics'    => [ 'pageviews', 'visitors' ],
			];
			$args          = wp_parse_args( $args, $defaults );
			$metrics       = $this->sanitize_metrics( $args['metrics'] );
			$metric_labels = $this->get_metrics();
			$filters       = burst_sanitize_filters( $args['filters'] );

			// generate labels for dataset
			$labels = [];
			// if not interval is a string and string is not ''
			$date_start     = (int) $args['date_start'];
			$date_end       = (int) $args['date_end'];
			$date_modifiers = $this->get_insights_date_modifiers( $date_start, $date_end );
			$datasets       = array();

			// foreach metric
			foreach ( $metrics as $metrics_key => $metric ) {
				$datasets[ $metrics_key ] = [
					'data'            => array(),
					'backgroundColor' => $this->get_metric_color( $metric, 'background' ),
					'borderColor'     => $this->get_metric_color( $metric, 'border' ),
					'label'           => $metric_labels[ $metric ],
					'fill'            => 'false',
				];
			}

			//we have a UTC corrected for timezone offset, to query in the statistics table.
			//to show the correct labels, we convert this back with the timezone offset.
			$timezone_offset = $this->get_wp_timezone_offset();
			$date = $date_start + $timezone_offset;
			for ( $i = 0; $i < $date_modifiers['nr_of_intervals']; $i ++ ) {
				$formatted_date            = date_i18n( $date_modifiers['php_date_format'], $date );
				$labels[ $formatted_date ] = date_i18n( $date_modifiers['php_pretty_date_format'], $date );

				// loop through metrics and assign x to 0, 1 , 2, 3, etc.
				foreach ( $metrics as $metric_key => $metric ) {
					$datasets[ $metric_key ]['data'][ $formatted_date ] = 0;
				}

				//increment at the end so the first will still be zero.
				$date                      += $date_modifiers['interval_in_seconds'];
			}

			$select = $this->sanitize_metrics( $metrics );

			$sql  = $this->get_sql_table( $date_start, $date_end, $select, $filters, 'period', 'period', '', array(), $date_modifiers );
			$hits = $wpdb->get_results( $sql, ARRAY_A );

			// match data from db to labels
			foreach ( $hits as $hit ) {
				$period = $hit['period']; // Get the period from the hit

				// Loop through each metric
				foreach ( $metrics as $metric_key => $metric_name ) {
					// Check if the period and the metric exist in the dataset
					if ( isset( $datasets[ $metric_key ]['data'][ $period ] ) && isset( $hit[ $metric_name ] ) ) {
						// Update the value for the corresponding metric and period
						$datasets[ $metric_key ]['data'][ $period ] = $hit[ $metric_name ];
					}
				}
			}

			// strip keys from array $labels to make it a simple array and work with ChartJS
			$labels = array_values( $labels );
			foreach ( $metrics as $metric_key => $metric_name ) {
				// strip keys from array $datasets to make it a simple array
				$datasets[ $metric_key ]['data'] = array_values( $datasets[ $metric_key ]['data'] );
			}

			return [
				'labels'   => $labels,
				'datasets' => $datasets,
			];
		}

		public function get_compare_data( $args = [] ) {
			$defaults = [
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => [],
			];
			$args     = wp_parse_args( $args, $defaults );

			$start = (int) $args['date_start'];
			$end   = (int) $args['date_end'];

			if ( isset($args['compare_date_start']) && isset($args['compare_date_end'] )) {
				$start_diff = (int) $args['compare_date_start'];
				$end_diff   = (int) $args['compare_date_end'];
			} else {
				$diff       = $end - $start;
				$start_diff = $start - $diff;
				$end_diff   = $end - $diff;
			}

			$filters = burst_sanitize_filters( $args['filters'] );

			$select = [ 'visitors', 'pageviews', 'sessions', 'first_time_visitors', 'avg_time_on_page' ];

			// current data
			$current = $this->get_data( $select, $start, $end, $filters );

			// previous data
			$previous = $this->get_data( $select, $start_diff, $end_diff, $filters );

			// bounces

			$curr_bounces = $this->get_bounces( $start, $end, $filters );
			$prev_bounces = $this->get_bounces( $start_diff, $end_diff, $filters );

			// combine data
			$data = [
				'current'  => [
					'pageviews'           => (int) $current['pageviews'],
					'sessions'            => (int) $current['sessions'],
					'visitors'            => (int) $current['visitors'],
					'first_time_visitors' => (int) $current['first_time_visitors'],
					'avg_time_on_page'    => (int) $current['avg_time_on_page'],
					'bounced_sessions'    => $curr_bounces,
				],
				'previous' => [
					'pageviews'        => (int) $previous['pageviews'],
					'sessions'         => (int) $previous['sessions'],
					'visitors'         => (int) $previous['visitors'],
					'bounced_sessions' => $prev_bounces,
				],
			];

			return $data;
		}

		public function get_compare_goals_data( $args = [] ) {
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
			$filters    = burst_sanitize_filters( $args['filters'] );

			$filters_without_goal = $filters;
			unset( $filters_without_goal['goal_id'] );

			$select = [ 'pageviews', 'visitors', 'sessions', 'first_time_visitors' ];
			// current data
			$current = $this->get_data( $select, $start, $end, $filters_without_goal );

			$select = [ 'pageviews', 'sessions', 'visitors' ];
			// previous data
			$previous = $this->get_data( $select, $start_diff, $end_diff, $filters_without_goal );

			// get amount of conversions for current period
			$current_conversions  = $this->get_conversions( $start, $end, $filters );
			$previous_conversions = $this->get_conversions( $start_diff, $end_diff, $filters );

			$current_conversion_rate  = $this->calculate_conversion_rate( $current_conversions, (int) $current['pageviews'] );
			$previous_conversion_rate = $this->calculate_conversion_rate( $previous_conversions, (int) $previous['pageviews'] );

			// combine data
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

		public function get_data( $select, $start, $end, $filters ) {
			global $wpdb;
			$sql    = $this->get_sql_table( $start, $end, $select, $filters );
			$result = $wpdb->get_results( $sql, 'ARRAY_A' );

			return $result[0] ?? array_fill_keys( $select, 0 );
		}

		private function get_bounces( $start, $end, $filters ) {
			global $wpdb;
			$sql = $this->get_sql_table( $start, $end, [ 'bounces' ], $filters );

			return (int) $wpdb->get_var( $sql );
		}

		private function get_conversions( $start, $end, $filters ) {
			global $wpdb;

			// filter is goal id so pageviews returned are the conversions
			$sql = $this->get_sql_table( $start, $end, [ 'conversions' ], $filters );

			return (int) $wpdb->get_var( $sql );
		}


		public function get_devices_title_and_value_data( $args = [] ) {
			global $wpdb;
			$defaults     = [
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => [],
			];
			$args         = wp_parse_args( $args, $defaults );
			$start        = (int) $args['date_start'];
			$end          = (int) $args['date_end'];
			$filters      = burst_sanitize_filters( $args['filters'] );
			$goal_id      = $filters['goal_id'] ?? null;
			$country_code = $filters['country_code'] ?? null;

			// Conditional JOIN and WHERE based on the presence of goal_id
			$join_clause = '';
			// if string is not '' then add 'AND' to the string
			$where_clause = $this->get_where_clause_for_filters( $filters );
			if ( $goal_id !== null ) {
				$join_clause = "INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals ON statistics.ID = goals.statistic_id";
				// append to where clause
				$where_clause .= $wpdb->prepare( ' AND goals.goal_id = %d ', $goal_id );
			}
			if ( $country_code !== null ) {
				$join_clause  .= " INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID ";
				$where_clause .= $wpdb->prepare( ' AND sessions.country_code = %s ', $country_code );
			}
			$use_lookup_tables = $this->use_lookup_tables();
			if ( $use_lookup_tables ) {
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

			$devicesResult = $wpdb->get_results( $sql, ARRAY_A );

			$total   = 0;
			$devices = array();
			foreach ( $devicesResult as $key => $data ) {
				$name             = $use_lookup_tables ?  $this->get_lookup_table_name_by_id('device', $data['device_id']) : $data['device'];
				$devices[ $name ] = [
					'count' => $data['count'],
				];
				$total            += $data['count'];
			}
			$devices['all'] = [
				'count' => $total,
			];

			// setup defaults
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
		 * Get subtitles data
		 * 
		 * @param $args
		 *
		 * @return array
		 */
		public function get_devices_subtitle_data( $args = [] ) {
			global $wpdb;
			$defaults     = [
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => array(),
			];
			$args         = wp_parse_args( $args, $defaults );
			$start        = (int) $args['date_start'];
			$end          = (int) $args['date_end'];
			$devices      = array( 'desktop', 'tablet', 'mobile', 'other' );
			$filters      = burst_sanitize_filters( $args['filters'] );
			$goal_id      = $filters['goal_id'] ?? null;
			$country_code = $filters['country_code'] ?? null;

			// if string is not '' then add 'AND' to the string
			$where_clause = $this->get_where_clause_for_filters( $filters );
			$data         = array();

			// Loop through results and add count to array
			$use_lookup_tables = $this->use_lookup_tables();
			foreach ( $devices as $device ) {

				$common_sql = " FROM {$wpdb->prefix}burst_statistics AS statistics ";
				if (  $use_lookup_tables ) {
					$device_id =  burst_get_lookup_table_id( 'device', $device );
					$device_sql = $wpdb->prepare( " device_id=%s ", $device_id );
					$where_sql  = $wpdb->prepare( " WHERE time > %d AND time < %d AND device_id >0 $where_clause", $start, $end );
				} else {
					$device_sql = $wpdb->prepare( " device=%s ", $device );
					$where_sql  = $wpdb->prepare( " WHERE time > %d AND time < %d AND device IS NOT NULL AND device <> '' $where_clause", $start, $end );
				}

				// Conditional JOIN and WHERE based on the presence of goal_id
				if ( $goal_id !== null ) {
					$common_sql .= " INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals ON statistics.ID = goals.statistic_id ";
					$where_sql  .= $wpdb->prepare( ' AND goals.goal_id = %d ', $goal_id );
				}

				if ( $country_code ) {
					$common_sql .= " INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID ";
					$where_sql  .= $wpdb->prepare( ' AND sessions.country_code = %s ', $country_code );
				}


				// Query for browser and OS
				if ( $use_lookup_tables ) {
					$sql = $wpdb->prepare( "SELECT browser_id, platform_id FROM (SELECT browser_id, platform_id, COUNT(*) AS count, device_id $common_sql $where_sql AND browser_id>0 GROUP BY browser_id, platform_id ) AS grouped_devices WHERE $device_sql ORDER BY count DESC LIMIT 1", '' );
					$results = $wpdb->get_row( $sql, ARRAY_A );
					$browser_id = $results['browser_id'] ?? 0;
					$platform_id = $results['platform_id'] ?? 0;
					$browser = $this->get_lookup_table_name_by_id( 'browser', $browser_id );
					$platform = $this->get_lookup_table_name_by_id( 'platform', $platform_id );

				} else {
					$sql  = $wpdb->prepare( "SELECT browser, platform FROM (SELECT browser, platform, COUNT(*) AS count, device $common_sql $where_sql AND browser IS NOT NULL GROUP BY browser, platform ) AS grouped_devices WHERE $device_sql ORDER BY count DESC LIMIT 1", '' );
					$results = $wpdb->get_row( $sql, ARRAY_A );
					$browser = $results['browser'] ?? false;
					$platform = $results['platform'] ?? false;
				}

				$data[ $device ] = array(
					'os'      => $platform,
					'browser' => $browser,
				);
			}

			// setup defaults
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
		 * @param array $args An associative array of arguments. Possible keys are:
		 *                    'date_start' => The start date of the period to retrieve data for, as a Unix timestamp. Default is 0.
		 *                    'date_end' => The end date of the period to retrieve data for, as a Unix timestamp. Default is 0.
		 *                    'metrics' => An array of metrics to retrieve data for. Default is array( 'pageviews' ).
		 *                    'filters' => An array of filters to apply to the data retrieval. Default is an empty array.
		 *
		 * @return array An associative array containing the following keys:
		 *               'columns' => An array of column definitions for the data.
		 *               'data' => An array of data rows.
		 *               'metrics' => An array of metrics that the data was retrieved for.
		 *
		 * @todo add support for exit rate, entrances, actual pagespeed, returning visitors, interactions per visit
		 */
		public function get_datatables_data(
			$args = []
		) {
			global $wpdb;
			$defaults = [
				'date_start' => 0,
				'date_end'   => 0,
				'metrics'    => [ 'pageviews' ],
				'filters'    => [],
				'limit'     => '',
			];
			$args     = wp_parse_args( $args, $defaults );
			$filters  = burst_sanitize_filters( $args['filters'] );
			$metrics  = $this->sanitize_metrics( $args['metrics'] );
			$group_by = $this->sanitize_metrics( $args['group_by'] ?? array() );
			// group by from array to comma seperated string
			$group_by      = implode( ',', $group_by );
			$metric_labels = $this->get_metrics();
			$start         = (int) $args['date_start'];
			$end           = (int) $args['date_end'];
			$columns       = array();
			$limit         = (int) $args['limit'] ?? '';

			// if metrics are not set return error
			if ( empty( $metrics ) ) {
                $metrics = [
                    'pageviews',
                ];
            }

			foreach ( $metrics as $metric ) {
				$metric = $this->sanitize_metric( $metric );

				// if goal_id isset then metric is a conversion
				$title = $metric_labels[ $metric ];

				$columns[] = [
					'name'     => $title,
					'id'       => $metric,
					'sortable' => true,
					'right'    => true,
				];
			}

			$last_metric_count = (int) count( $metrics ) - 1;
            $order_by          = isset($metrics[ $last_metric_count ]) ? $metrics[ $last_metric_count ] . ' DESC' : 'pageviews DESC';

			$sql  = $this->get_sql_table( $start, $end, $metrics, $filters, $group_by, $order_by, $limit );
			$data = $wpdb->get_results( $sql, ARRAY_A );
            $data = apply_filters('burst_datatable_data', $data, $start, $end, $metrics, $filters, $group_by, $order_by, $limit );

            return [
				'columns' => $columns,
				'data'    => $data,
				'metrics' => $metrics,
			];
		}

		public function get_referrers_sql( $start, $end, $filters = [] ) {
			$remove   = array( 'http://www.', 'https://www.', 'http://', 'https://' );
			$site_url = str_replace( $remove, '', site_url() );
			$sql      = $this->get_sql_table( $start, $end, array( 'count', 'referrer' ), $filters );
			$sql      .= "AND referrer NOT LIKE '%$site_url%' GROUP BY referrer ORDER BY 1 DESC";

			return $sql;
		}

		/**
		 * convert date string to unix timestamp (UTC) by correcting it with WordPress timezone offset
		 *
		 * @param $time_string      string
		 *                          date string in format Y-m-d H:i:s
		 *
		 * @return int
		 */
		public function convert_date_to_unix(
			string $time_string
		): int {
			$time               = DateTime::createFromFormat( 'Y-m-d H:i:s', $time_string );
			$utc_time = $time ? $time->format( 'U' ) : strtotime( $time_string );
			$gmt_offset_seconds = $this->get_wp_timezone_offset();

			return $utc_time - $gmt_offset_seconds;
		}

		/**
		 * The FROM_UNIXTIME takes into account the timezone offset from the mysql timezone settings. These can differ from the server settings.
		 *
		 * @return int
		 * @throws Exception
		 */
		private function get_mysql_timezone_offset():int {
			global $wpdb;
			$mysql_timestamp = $wpdb->get_var( 'SELECT FROM_UNIXTIME(UNIX_TIMESTAMP());' );
			$wp_timezone_offset = $this->get_wp_timezone_offset();

			//round to half hours
			$mysql_timezone_offset_hours = ROUND( ( strtotime( $mysql_timestamp ) - time() ) / (HOUR_IN_SECONDS / 2), 0) * 0.5;
			$wp_timezone_offset_hours = ROUND($wp_timezone_offset / (HOUR_IN_SECONDS / 2), 0) * 0.5;
			$offset = $wp_timezone_offset_hours - $mysql_timezone_offset_hours;
			return $offset * HOUR_IN_SECONDS;

		}

		/**
		 * Get the offset in seconds from the selected timezone in WP
		 *
		 * @return int
		 * @throws Exception
		 */
		private function get_wp_timezone_offset(): int {
			$timezone = wp_timezone();
			$datetime = new DateTime('now', $timezone);
			return $timezone->getOffset($datetime);
		}



		/**
		 * convert unix timestamp to date string by gmt offset
		 *
		 * @param $unix_timestamp      int
		 *
		 * @return string
		 */
		public function convert_unix_to_date( $unix_timestamp ): string {
			$adjusted_timestamp = $unix_timestamp + $this->get_wp_timezone_offset();

			// Convert the adjusted timestamp to a DateTime object
			$time = new DateTime();
			$time->setTimestamp( $adjusted_timestamp );

			// Format the DateTime object to 'Y-m-d' format
			return $time->format( 'Y-m-d' );
		}


		/**
		 * @param string $period
		 * @param int    $date_start
		 * @param int    $date_end
		 *
		 * @return float
		 */
		private function get_nr_of_periods(
			string $period,
			int $date_start,
			int $date_end
		): float {
			$range_in_seconds  = $date_end - $date_start;
			$period_in_seconds = defined( strtoupper( $period ) . '_IN_SECONDS' ) ? constant( strtoupper( $period ) . '_IN_SECONDS' ) : DAY_IN_SECONDS;

			return ROUND( $range_in_seconds / $period_in_seconds );
		}

		/**
		 * Get color for a graph
		 *
		 * @param string $metric
		 * @param string $type 'background' or 'border'
		 *
		 * @return string
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

		public function get_dashboard_widget_statistics(
			$date_start = 0,
			$date_end = 0
		) {
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

			// calculate uplift for visitors
			$visitors               = $curr_data[0]->visitors;
			$visitors_uplift        = $this->format_uplift( $prev_data[0]->visitors, $visitors );
			$visitors_uplift_status = $this->calculate_uplift_status( $prev_data[0]->visitors, $visitors );

			// time per session = avg time_on_page / avg pageviews per session
			$average_pageviews_per_session = ( (int) $curr_data[0]->sessions != 0 ) ? ( $curr_data[0]->pageviews / $curr_data[0]->sessions ) : 0;
			$time_per_session              = $curr_data[0]->avg_time_on_page / max( 1, $average_pageviews_per_session );

			// prev time per session
			$prev_average_pageviews_per_session = ( (int) $prev_data[0]->sessions != 0 ) ? ( $prev_data[0]->pageviews / $prev_data[0]->sessions ) : 0;
			$prev_time_per_session              = $prev_data[0]->avg_time_on_page / max( 1, $prev_average_pageviews_per_session );

			// calculate uplift for time per session
			$time_per_session_uplift        = $this->format_uplift( $prev_time_per_session, $time_per_session );
			$time_per_session_uplift_status = $this->calculate_uplift_status( $prev_time_per_session, $time_per_session );

			// get top referrer
			$top_referrer = $wpdb->get_results(
				$this->get_sql_table(
					$date_start,
					$date_end,
					[
						'pageviews',
						'referrer',
					],
					'referrer',
					'pageviews DESC',
					1
				)
			);
			if ( isset( $top_referrer[0] ) ) {
				if ( $top_referrer[0]->referrer == 'Direct' ) {
					$top_referrer[0]->referrer = __( 'Direct', 'burst-statistics' );
				} else if ( $top_referrer[0]->pageviews === 0 ) {
					$top_referrer[0]->referrer = __( 'No referrers', 'burst-statistics' );
				}
			}

			// get most visited page

			$most_visited = $wpdb->get_results(
				$this->get_sql_table(
					$date_start,
					$date_end,
					[
						'pageviews',
						'page_url',
					],
					'page_url',
					'pageviews DESC',
					1
				)
			);
			if ( isset( $most_visited[0] ) ) {
				if ( $most_visited[0]->page_url === '/' ) {
					$most_visited[0]->page_url = __( 'Homepage', 'burst-statistics' );
				} else if ( ! $most_visited[0]->pageviews === 0 ) {
					$most_visited[0]->page_url = __( 'No pageviews', 'burst-statistics' );
				}
			}
			// Create the result array

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
		 *
		 * @param int    $value
		 * @param int    $total
		 * @param string $type
		 *
		 * @return float
		 */
		private function calculate_ratio(
			$value,
			$total,
			string $type = '%'
		) {
			$value    = (int) $value;
			$total    = (int) $total;
			$multiply = 1;
			if ( $type === '%' ) {
				$multiply = 100;
			}

			return $total == 0 ? 0 : round( $value / $total * $multiply, 1 );
		}

		private function calculate_conversion_rate(
			$value,
			$total
		) {
			return $this->calculate_ratio( $value, $total, '%' );
		}

		/**
		 * Cached method to check if lookup tables should be used.
		 *
		 * @return bool
		 */
		public function use_lookup_tables(){

			if ( $this->use_lookup_tables === null ) {
				$this->use_lookup_tables = !get_option('burst_db_upgrade_upgrade_lookup_tables');
			}

			return $this->use_lookup_tables;
		}

		/**
		 * Generates a WHERE clause for SQL queries based on provided filters.
		 *
		 * @param array $filters Associative array of filters.
		 *
		 * @return string WHERE clause for SQL query.
		 */
		function get_where_clause_for_filters( $filters = array() ) {
			$filters      = burst_sanitize_filters( $filters );
			$whereClauses = array();

			$id = $this->use_lookup_tables() ? '_id' : '';

			// Define filters including their table prefixes.
			$possibleFiltersWithPrefix = apply_filters(
				'burst_possible_filters_with_prefix',
				[
					'bounce'       => 'statistics.bounce',
					'page_url'     => 'statistics.page_url',
					'referrer'     => 'statistics.referrer',
					'device'       => 'statistics.device'.$id,
					'browser'      => 'statistics.browser'.$id,
					'platform'     => 'statistics.platform'.$id,
					'country_code' => 'sessions.country_code', // Assuming 'country_code' filter is in the 'sessions' table.
                    'goal_id'      => 'goals.goal_id', //allow filtering by goal_id
                ]
			);

			if (  $this->use_lookup_tables() ) {
				$mappable = [
					'browser',
					'browser_version',
					'platform',
					'device',
				];//only device, browser and platform in use at the moment, but leave it here for extension purposes
				foreach ( $filters as $filter_name => $filter_value ) {
					if ( in_array( $filter_name, $mappable, true ) ) {
						$filters[ $filter_name ] = BURST()->frontend->get_lookup_table_id( $filter_name, $filter_value );
					}
				}
			}

			foreach ( $filters as $filter => $value ) {
				if ( array_key_exists( $filter, $possibleFiltersWithPrefix ) ) {
					$qualifiedName = $possibleFiltersWithPrefix[ $filter ];

					if ( is_numeric( $value ) ) {
						$whereClauses[] = "{$qualifiedName} = " . intval( $value );
					} else {
						$value = esc_sql( sanitize_text_field( $value ) );
						if ( $filter === 'referrer' ) {
							$value          = ( $value === __( 'Direct', 'burst-statistics' ) ) ? "''" : "'%{$value}'";
							$whereClauses[] = "{$qualifiedName} LIKE {$value}";
						} else {
							$whereClauses[] = "{$qualifiedName} = '{$value}'";
						}
					}
				}
			}

			// Construct the WHERE clause.
			$where = implode( ' AND ', $whereClauses );

			return ! empty( $where ) ? "AND $where " : '';
		}

		/**
		 * Get query for statistics
		 *
		 * @param int         $start
		 * @param int         $end
		 * @param array       $select
		 * @param array       $filters
		 * @param string      $group_by
		 * @param string      $order_by
		 * @param string      $limit
		 * @param array       $joins
		 * @param array|false $date_modifiers
		 *
		 * @return string|null
		 */
		public function get_sql_table( $start, $end, $select = [ '*' ], $filters = [], $group_by = '', $order_by = '', $limit = '', $joins = array(), $date_modifiers = false ) {
			$raw = $date_modifiers && strpos( $date_modifiers['sql_date_format'], '%H' ) !== false;
			if ( ! $raw && BURST()->summary->upgrade_completed() && BURST()->summary->is_summary_data( $select, $filters, $start, $end ) ) {
				return BURST()->summary->summary_sql( $start, $end, $select, $group_by, $order_by, $limit, $date_modifiers );
			}
			$sql = $this->get_sql_table_raw( $start, $end, $select, $filters, $group_by, $order_by, $limit, $joins );
			if ( $date_modifiers ) {
				$timezone_offset = $this->get_mysql_timezone_offset();
				$sql = str_replace( 'SELECT', "SELECT DATE_FORMAT(FROM_UNIXTIME( time + $timezone_offset ), '{$date_modifiers['sql_date_format']}') as period,", $sql );
			}

			return $sql;
		}



		/**
		 * Function to get the SQL query to exclude bounces from query's
		 *
		 * @return string
		 */
		public function get_sql_table_raw( int $start, int $end, $select = [ '*' ], $filters = [], $group_by = '', $order_by = '', $limit = '', $joins = array() ) {
			global $wpdb;
			$filters    = esc_sql( $filters );
			$select     = esc_sql( $select );
			$group_by   = esc_sql( $group_by );
			$order_by   = esc_sql( $order_by );
			$limit      = ! empty( $limit ) ? (int) $limit : '';
			$select     = $this->get_sql_select_for_metrics( $select );
			$table_name = $wpdb->prefix . 'burst_statistics';
			$where      = $this->get_where_clause_for_filters( $filters );

			// if $select string contains referrer add where clause for referrer
			if ( strpos( $select, 'referrer' ) !== false ) {
				$remove   = [ 'http://www.', 'https://www.', 'http://', 'https://' ];
				$site_url = str_replace( $remove, '', site_url() );
				$where    .= "AND referrer NOT LIKE '%$site_url%'";
			}

			if ( burst_is_pro() && strpos( $select, 'parameters,' ) !== false ) {
				$where .= "AND parameters IS NOT NULL AND parameters != ''";
			}

			if ( burst_is_pro() && strpos( $select, 'parameter,' ) !== false ) {
				$where .= "AND parameter IS NOT NULL AND parameter != '='";
			}

			$available_joins = apply_filters(
				'burst_available_joins',
				array(
					'sessions' => [
						'table' => 'burst_sessions',
						'on'    => 'statistics.session_id = sessions.ID',
						'type'  => 'INNER', // Optional, default is INNER JOIN
					],
					'goals'    => array(
						'table' => 'burst_goal_statistics',
						'on'    => 'statistics.ID = goals.statistic_id',
						'type'  => 'LEFT', // Optional, default is INNER JOIN
					),
				)
			);

			// find possible joins in $select and $where
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
				$join_sql   .= " {$join_type} JOIN {$join_table} AS {$key} ON {$join_on}";
			}

			$table_name .= ' AS statistics';

			// if parameter is in select, then we need to join the parameters table
			if ( strpos( $select, 'parameter,' ) !== false ) {
				// replcae the group by with the parameter
				$group_by = 'parameters.parameter, parameters.value';
				// if parameters is also in the group by then we need to add the parameters table to the join
				if ( strpos( $select, 'parameters,' ) !== false ) {
					// if group by is set then we add a comma and statistics.parameters to the group by. If not then it just becomes statistics.parameters
					$group_by = $group_by ? $group_by . ', statistics.parameters' : '';
				}
			}

			$group_by = $group_by ? "GROUP BY $group_by" : '';
			$order_by = $order_by ? "ORDER BY $order_by" : '';
			$limit    = $limit ? 'LIMIT ' . (int) $limit : '';

			$sql = "SELECT $select FROM $table_name $join_sql WHERE time > $start AND time < $end $where $group_by $order_by $limit";
			return $sql;
		}

		/**
		 * Generate SQL for a metric
		 *
		 * @param string $metric
		 *
		 * @return string
		 */
		public function get_sql_select_for_metric( string $metric ) {
			// default set to true will be changed/or removed in the future, for a more dynamic approach
			$exclude_bounces = apply_filters( 'burst_exclude_bounces', burst_get_option( 'exclude_bounces', 1 ) );

			global $wpdb;
			// if metric starts with  'count(' and ends with ')', then it's a custom metric
			// so we sanitize it and return it
			if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
				// delete the 'count(' and ')' from the metric
				// sanitize_title and wrap it in count()
				return 'count(' . sanitize_title( substr( $metric, 6, - 1 ) ) . ')';
			}
			// using COALESCE to prevent NULL values in the output, in the today
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
				burst_error_log( 'No SQL for metric: ' . $metric );
			}

			return $sql;
		}

		/**
		 * @param $metrics
		 * @param $filters array
		 *
		 * @return string
		 */
		function get_sql_select_for_metrics( $metrics ) {
			$metrics = esc_sql( $metrics );
			$select  = '';
			$count   = count( $metrics );
			$i       = 1;
			foreach ( $metrics as $metric ) {
				$sql = $this->get_sql_select_for_metric( $metric );
				if ( $sql !== false && $sql !== '' && $metric !== '*' ) {
					// if metric starts with  'count(' and ends with ')', then it's a custom metric
					// so we change the $metric name to 'metric'_count
					if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
						// strip the 'count(' and ')' from the metric
						$metric = substr( $metric, 6, - 1 );
						$metric .= '_count';
					}
					$select .= $sql . ' as ' . $metric;
				} else { // if it's a wildcard, then we don't need to add the alias
					$select .= '*';
				}

				if ( $count !== $i ) { // if it's not the last metric, then we need to add a comma
					$select .= ', ';
				}
				++ $i;
			}

			return $select;
		}

		/**
		 * Function to format uplift
		 *
		 * @param $original_value
		 * @param $new_value
		 *
		 * @return string
		 */
		public function format_uplift(
			$original_value,
			$new_value
		) {
			$uplift = burst_format_number( $this->calculate_uplift( $new_value, $original_value ), 0 );
			if ( $uplift === 0 ) {
				return '';
			}

			return $uplift > 0 ? '+' . $uplift . '%' : $uplift . '%';
		}

		/**
		 * Function to calculate uplift
		 *
		 * @param $original_value
		 * @param $new_value
		 *
		 * @return int
		 */
		public function calculate_uplift(
			$original_value,
			$new_value
		) {
			$increase = $original_value - $new_value;

			return $this->calculate_ratio( $increase, $new_value );
		}

		/**
		 * Function to calculate uplift status
		 *
		 * @param $original_value
		 * @param $new_value
		 *
		 * @return string
		 */
		public function calculate_uplift_status(
			$original_value,
			$new_value
		) {
			$status = '';
			$uplift = $this->calculate_uplift( $new_value, $original_value );

			if ( $uplift > 0 ) {
				$status = 'positive';
			} else if ( $uplift < 0 ) {
				$status = 'negative';
			}

			return $status;
		}

        /**
         * Get post_views by post_id
         *
         * @param int $post_id
         * @param int $date_start
         * @param int $date_end
         * @return int
         */
		public function get_post_views(int $post_id, int $date_start = 0, int $date_end = 0 ): int
        {
			//get relative page url by post_id.
			$page_url = get_permalink( $post_id );
			//strip home_url from page_url
			$page_url = str_replace( home_url(), '', $page_url );
			$sql = $this->get_sql_table($date_start, $date_end, ['pageviews'], ['page_url' => $page_url] );
			global $wpdb;
			$data = $wpdb->get_row( $sql );
			if ( $data && isset($data->pageviews)) {
				return (int) $data->pageviews;
			}
			return 0;
		}


		/**
		 * Get Name from lookup table
		 *
		 * @param string $item
		 * @param int    $id
		 *
		 * @return string
		 */
		public function get_lookup_table_name_by_id( string $item, int $id):string {
			if ( $id === 0 ) {
				return '';
			}

			$possible_items = ['browser', 'browser_version', 'platform', 'device'];
			if ( !in_array($item, $possible_items) ) {
				return 0;
			}

			if ( isset( $this->look_up_table_names[$item][$id] ) ){
				return $this->look_up_table_names[$item][$id];
			}

			//check if $value exists in tabel burst_$item
			$name = wp_cache_get('burst_' . $item . '_' . $id, 'burst');
			if ( !$name ) {
				global $wpdb;
				$name = $wpdb->get_var( $wpdb->prepare( "SELECT name FROM {$wpdb->prefix}burst_{$item}s WHERE ID = %s LIMIT 1", $id ) );
				wp_cache_set('burst_' . $item . '_' . $id, $name, 'burst');
			}
			$this->look_up_table_names[$item][$id] = $name;
			return (string) $name;
		}
	}
}

/**
 * Install statistic table
 * */

add_action( 'burst_install_tables', 'burst_install_statistics_table', 10 );
function burst_install_statistics_table() {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // Create tables without indexes first
    $tables = array(
        'burst_statistics' => "CREATE TABLE {$wpdb->prefix}burst_statistics (
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
        'burst_browsers' => "CREATE TABLE {$wpdb->prefix}burst_browsers (
            `ID` int(11) NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            PRIMARY KEY (ID)
        ) $charset_collate;",
        'burst_browser_versions' => "CREATE TABLE {$wpdb->prefix}burst_browser_versions (
            `ID` int(11) NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            PRIMARY KEY (ID)
        ) $charset_collate;",
        'burst_platforms' => "CREATE TABLE {$wpdb->prefix}burst_platforms (
            `ID` int(11) NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            PRIMARY KEY (ID)
        ) $charset_collate;",
        'burst_devices' => "CREATE TABLE {$wpdb->prefix}burst_devices (
            `ID` int(11) NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            PRIMARY KEY (ID)
        ) $charset_collate;",
        'burst_summary' => "CREATE TABLE {$wpdb->prefix}burst_summary (
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
        ) $charset_collate;"
    );

    // Create tables
    foreach ($tables as $table_name => $sql) {
        dbDelta($sql);
        if (!empty($wpdb->last_error)) {
            burst_error_log("Error creating table {$table_name}: " . $wpdb->last_error);
        }
    }

    $indexes = array(
        ['time'],
        ['bounce'],
        ['page_url'],
        ['session_id'],
        ['time', 'page_url'],
        ['uid', 'time'],
    );

    $table_name = $wpdb->prefix . 'burst_statistics';
    foreach ($indexes as $index ) {
        burst_add_index($table_name, $index);
    }

    $indexes = array(
        ['date', 'page_url'],
        ['page_url', 'date'],
        ['date'],
    );

    $table_name = $wpdb->prefix . 'burst_summary';
    foreach ($indexes as $index ) {
        burst_add_index($table_name, $index);
    }
}
