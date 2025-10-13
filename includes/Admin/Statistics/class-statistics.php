<?php
namespace Burst\Admin\Statistics;

use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use Peast\Query;

defined( 'ABSPATH' ) || die();

class Statistics {
	use Helper;
	use Admin_Helper;
	use Database_Helper;
	use Sanitize;

	private array $look_up_table_names = [];
	public array $campaign_parameters  = [ 'source', 'medium', 'campaign', 'term', 'content' ];
	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_statistics_table' ], 10 );
		add_action( 'burst_clear_test_visit', [ $this, 'clear_test_visit' ] );
	}

	/**
	 * Clear the test hit from the database, which is added during onboarding.
	 */
	public function clear_test_visit(): void {
		global $wpdb;
		$session_ids = $wpdb->get_col(
			"SELECT session_id FROM {$wpdb->prefix}burst_statistics WHERE parameters LIKE '%burst_test_hit%' OR parameters LIKE '%burst_nextpage%'"
		);

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
	 * Get live traffic data for the dashboard, an array of currently active URLs.
	 *
	 * @return array An array of live traffic data objects with properties like active_time, utm_source, page_url, time, time_on_page, uid, page_id, entry, checkout, live, exit.
	 */
	public function get_live_traffic_data(): array {
		$time_start_30m = strtotime( '30 minutes ago' );
		$time_start_10m = strtotime( '10 minutes ago' );
		$now            = time();
		$on_page_offset = apply_filters( 'burst_on_page_offset', 60 );
		$exit_margin    = 4 * MINUTE_IN_SECONDS;

		// Query last 30 minutes of traffic.
		$args = [
			'date_start'    => $time_start_30m,
			'date_end'      => $now + HOUR_IN_SECONDS,
			'custom_select' => 'time+time_on_page / 1000 AS active_time, referrer AS utm_source, page_url, time, time_on_page, uid, page_id',
			'order_by'      => 'active_time DESC',
			'limit'         => 100,
		];

		$qd  = new Query_Data( $args );
		$sql = $this->get_sql_table( apply_filters( 'burst_live_traffic_args', $qd ) );

		global $wpdb;
		$traffic = $wpdb->get_results( $sql );
		if ( ! is_array( $traffic ) ) {
			$traffic = [];
		}
		$checkout_id = $this->burst_checkout_page_id();

		// Split traffic into before/within 10m window.
		$traffic_before_10m = [];
		foreach ( $traffic as $row ) {
			if ( (float) $row->time < (float) $time_start_10m ) {
				$traffic_before_10m[ $row->uid ] = true;
			}
		}

		// Create a new set of array with only last 10m of traffic.
		$traffic_in_last_10m = array_filter(
			$traffic,
			function ( $row ) use ( $time_start_10m, $exit_margin, $now, $on_page_offset ) {
				// Move the custom where from the query to here to get the actual dataset of last 30 minutes.
				return (float) $row->time >= (float) $time_start_10m && ( (float) $row->active_time + (float) $exit_margin + (float) $on_page_offset ) >= (float) $now;
			}
		);

		$entry_marked = [];
		$exit_marked  = [];

		// Pass 1: Detect entries by iterating oldest → newest (reverse the DESC result).
		foreach ( array_reverse( $traffic_in_last_10m ) as $row ) {
			$row->entry    = false;
			$row->checkout = false;

			if ( ! empty( $row->page_id ) && $row->page_id !== -1 && (int) $row->page_id === $checkout_id ) {
				$row->checkout = true;
			}

			// Entry logic: only mark the first (oldest) row in the 10m window per UID.
			if ( ! isset( $traffic_before_10m[ $row->uid ] ) && ! isset( $entry_marked[ $row->uid ] ) ) {
				$entry_marked[ $row->uid ] = true;
				$row->entry                = true;
			}
		}

		$seen_uid_for_exit = [];

		// Pass 2: Detect live/exit by iterating newest → oldest.
		foreach ( $traffic_in_last_10m as $row ) {
			$row->exit   = false;
			$should_exit = (float) $row->active_time + $exit_margin < (float) $now;

			// Exit: only mark the most recent row per UID that qualifies.
			if (
				$should_exit &&
				! isset( $exit_marked[ $row->uid ] ) &&
				! isset( $seen_uid_for_exit[ $row->uid ] )
			) {
				$row->exit                = true;
				$exit_marked[ $row->uid ] = true;
			}

			// This will ensure that only the last activity is marked as exit and no other entry is marked as exit even if it falls in the exit criteria.
			$seen_uid_for_exit[ $row->uid ] = false;
		}

		return $traffic_in_last_10m;
	}

	/**
	 * Get the live visitors count
	 */
	public function get_live_visitors_data(): int {
		$time_start     = strtotime( '10 minutes ago' );
		$now            = time();
		$on_page_offset = apply_filters( 'burst_on_page_offset', 60 );
		$exit_margin    = 4 * MINUTE_IN_SECONDS;

		// Use enhanced query builder with custom WHERE for complex live visitor logic.
		$args = [
			'date_start'    => $time_start,
			// Add buffer to ensure we don't exclude based on end time.
			'date_end'      => $now + HOUR_IN_SECONDS,
			'custom_select' => 'COUNT(DISTINCT(uid))',
			'custom_where'  => "AND ( (time + time_on_page / 1000 + {$on_page_offset} + {$exit_margin}) > {$now})",
		];
		$qd   = new Query_Data( $args );
		$sql  = $this->get_sql_table( $qd );

		global $wpdb;
		$live_value = $wpdb->get_var( $sql );

		// check if the plugin was activated in the last hour. If so, this could be a call coming from the onboarding.

		return max( (int) $live_value, 0 );
	}

	/**
	 * Get data for the Today block in the dashboard.
	 *
	 * @param array $args {
	 *     Optional. Date range for today's stats.
	 *     @type int $date_start Start of today (timestamp).
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
		$qd      = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'visitors', 'pageviews', 'avg_time_on_page' ] ,
			]
		);
		$sql     = $this->get_sql_table( $qd );
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
			$qd    = new Query_Data(
				[
					'date_start' => $start,
					'date_end'   => $end,
					'select'     => $fields,
					'group_by'   => $fields[0],
					'order_by'   => 'pageviews DESC',
					'limit'      => 1,
				]
			);
			$sql   = $this->get_sql_table( $qd );
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
		$metric_labels = $this->allowed_metrics();
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
		$qd     = new Query_Data(
			[
				'date_start'     => $date_start,
				'date_end'       => $date_end,
				'select'         => $select,
				'filters'        => $filters,
				'group_by'       => 'period',
				'order_by'       => 'period',
				'limit'          => 0,
				'date_modifiers' => $date_modifiers,
			]
		);
		$sql    = $this->get_sql_table( $qd );
		$hits   = $wpdb->get_results( $sql, ARRAY_A );

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
		return $this->get_base_data(
			[
				'args'             => $args,
				'needs_comparison' => true,
				'queries'          => [
					'main_data' => [
						'type'       => 'standard',
						'select'     => [ 'visitors', 'pageviews', 'sessions', 'first_time_visitors', 'avg_time_on_page', 'bounce_rate' ],
						'comparison' => true,
					],
					'bounces'   => [
						'type'       => 'bounces',
						'comparison' => true,
					],
				],
				'formatters'       => [
					function ( $results ) {
						$main_data = $results['main_data'];
						$bounces   = $results['bounces'];

						return [
							'current'  => [
								'pageviews'           => (int) $main_data['current']['pageviews'],
								'sessions'            => (int) $main_data['current']['sessions'],
								'visitors'            => (int) $main_data['current']['visitors'],
								'first_time_visitors' => (int) $main_data['current']['first_time_visitors'],
								'avg_time_on_page'    => (int) $main_data['current']['avg_time_on_page'],
								'bounced_sessions'    => $bounces['current'],
								'bounce_rate'         => $main_data['current']['bounce_rate'],
							],
							'previous' => [
								'pageviews'        => (int) $main_data['previous']['pageviews'],
								'sessions'         => (int) $main_data['previous']['sessions'],
								'visitors'         => (int) $main_data['previous']['visitors'],
								'bounced_sessions' => $bounces['previous'],
								'bounce_rate'      => $main_data['previous']['bounce_rate'],
							],
						];
					},
				],
			]
		);
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
		return $this->get_base_data(
			[
				'args'             => $args,
				'needs_comparison' => true,
				'queries'          => [
					'main_data'   => [
						'type'       => 'standard',
						'select'     => [ 'pageviews', 'visitors', 'sessions', 'first_time_visitors' ],
						'comparison' => true,
						// Will be processed to remove goal_id.
						'filters'    => [],
					],
					'conversions' => [
						'type'       => 'conversions',
						'comparison' => true,
					],
				],
				'processors'       => [
					function ( $results, $args ) {
						// Remove goal_id from filters for main data query.
						$filters              = $this->sanitize_filters( (array) $args['filters'] );
						$filters_without_goal = $filters;
						unset( $filters_without_goal['goal_id'] );

						// Re-execute main data query with correct filters.
						$start            = (int) $args['date_start'];
						$end              = (int) $args['date_end'];
						$comparison_dates = $this->calculate_comparison_dates( $start, $end, $args );

						$results['main_data']['current'] = $this->get_data(
							[ 'pageviews', 'visitors', 'sessions', 'first_time_visitors' ],
							$start,
							$end,
							$filters_without_goal
						);

						$results['main_data']['previous'] = $this->get_data(
							[ 'pageviews', 'sessions', 'visitors' ],
							$comparison_dates['start'],
							$comparison_dates['end'],
							$filters_without_goal
						);

						return $results;
					},
				],
				'formatters'       => [
					function ( $results ) {
						$main_data   = $results['main_data'];
						$conversions = $results['conversions'];

						$current_conversion_rate  = $this->calculate_conversion_rate(
							$conversions['current'],
							(int) $main_data['current']['pageviews']
						);
						$previous_conversion_rate = $this->calculate_conversion_rate(
							$conversions['previous'],
							(int) $main_data['previous']['pageviews']
						);

						return [
							'view'     => 'goals',
							'current'  => [
								'pageviews'           => (int) $main_data['current']['pageviews'],
								'visitors'            => (int) $main_data['current']['visitors'],
								'sessions'            => (int) $main_data['current']['sessions'],
								'first_time_visitors' => (int) $main_data['current']['first_time_visitors'],
								'conversions'         => $conversions['current'],
								'conversion_rate'     => $current_conversion_rate,
							],
							'previous' => [
								'pageviews'       => (int) $main_data['previous']['pageviews'],
								'visitors'        => (int) $main_data['previous']['visitors'],
								'sessions'        => (int) $main_data['previous']['sessions'],
								'conversions'     => $conversions['previous'],
								'conversion_rate' => $previous_conversion_rate,
							],
						];
					},
				],
			]
		);
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
		$qd     = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => $select,
				'filters'    => $filters,
			]
		);
		$sql    = $this->get_sql_table( $qd );
		$result = $wpdb->get_results( $sql, 'ARRAY_A' );

		return $result[0] ?? array_fill_keys( $select, 0 );
	}

	/**
	 * Get bounces for a given time period.
	 */
	private function get_bounces( int $start, int $end, array $filters ): int {
		global $wpdb;
		$qd  = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'bounces' ],
				'filters'    => $filters,
			]
		);
		$sql = $this->get_sql_table( $qd );
		return (int) $wpdb->get_var( $sql );
	}

	/**
	 * Get conversions for a given time period.
	 */
	private function get_conversions( int $start, int $end, array $filters ): int {
		global $wpdb;

		// filter is goal id so pageviews returned are the conversions.
		$qd  = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'conversions' ],
				'filters'    => $filters,
			]
		);
		$sql = $this->get_sql_table( $qd );

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
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args     = wp_parse_args( $args, $defaults );

		$query_args = [
			'date_start' => $args['date_start'],
			'date_end'   => $args['date_end'],
			'filters'    => $args['filters'],
		];

		$query_args['select']        = [ 'device_id' ];
		$query_args['custom_select'] = 'device_id, COUNT(device_id) AS count';
		$query_args['group_by']      = 'device_id';
		$query_args['having']        = [ 'device_id > 0' ];

		$qd  = new Query_Data( $query_args );
		$sql = $this->get_sql_table( $qd );

		global $wpdb;
		$devices_result = $wpdb->get_results( $sql, ARRAY_A );

		$total   = 0;
		$devices = [];

		foreach ( $devices_result as $data ) {
			$name = $this->get_lookup_table_name_by_id( 'device', $data['device_id'] );

			if ( ! empty( $name ) ) {
				$devices[ $name ] = [
					'count' => (int) $data['count'],
				];
				$total           += (int) $data['count'];
			}
		}

		$devices['all'] = [
			'count' => $total,
		];

		// Setup defaults.
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
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'filters'    => [],
		];
		$args     = wp_parse_args( $args, $defaults );

		$devices = [ 'desktop', 'tablet', 'mobile', 'other' ];
		$data    = [];

		foreach ( $devices as $device ) {
			// Build device-specific query using enhanced builder.
			$query_args = [
				'date_start' => $args['date_start'],
				'date_end'   => $args['date_end'],
				'filters'    => array_merge( $args['filters'], [ 'device' => $device ] ),
				'limit'      => 1,
			];

			$query_args['select']        = [ 'browser_id', 'platform_id' ];
			$query_args['custom_select'] = 'browser_id, platform_id, COUNT(*) as count';
			$query_args['group_by']      = 'browser_id, platform_id';
			$query_args['having']        = [ 'browser_id > 0' ];
			$query_args['order_by']      = 'count DESC';
			$qd                          = new Query_Data( $query_args );
			$sql                         = $this->get_sql_table( $qd );

			global $wpdb;
			$results = $wpdb->get_row( $sql, ARRAY_A );

			$browser_id      = $results['browser_id'] ?? 0;
			$platform_id     = $results['platform_id'] ?? 0;
			$browser         = $this->get_lookup_table_name_by_id( 'browser', $browser_id );
			$platform        = $this->get_lookup_table_name_by_id( 'platform', $platform_id );
			$data[ $device ] = [
				'os'      => $platform ?: '',
				'browser' => $browser ?: '',
			];
		}

		// Setup defaults.
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
		$metric_labels = $this->allowed_metrics();
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
		$qd                = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => $metrics,
				'filters'    => $filters,
				'group_by'   => $group_by,
				'order_by'   => $order_by,
				'limit'      => $limit,
			]
		);
		$sql               = $this->get_sql_table( $qd );
		$data              = $wpdb->get_results( $sql, ARRAY_A );

		$data = apply_filters( 'burst_datatable_data', $data, $qd );

		return [
			'columns' => $columns,
			'data'    => $data,
			'metrics' => $metrics,
		];
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
	 * Get the offset in seconds from the selected timezone in WP.
	 *
	 * @throws \Exception //exception.
	 */
	private static function get_wp_timezone_offset(): int {
		$timezone = wp_timezone();
		$datetime = new \DateTime( 'now', $timezone );
		return $timezone->getOffset( $datetime );
	}

	/**
	 * Convert unix timestamp to date string by gmt offset.
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
	 * Get color for a graph.
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

		$qd  = new Query_Data(
			[
				'date_start' => $date_start,
				'date_end'   => $date_end,
				'select'     => [
					'visitors',
					'sessions',
					'pageviews',
					'avg_time_on_page',
				],
			]
		);
		$sql = $this->get_sql_table( $qd );

		$curr_data = $wpdb->get_results( $sql );
		$qd        = new Query_Data(
			[
				'date_start' => $date_start_diff,
				'date_end'   => $date_end_diff,
				'select'     => [
					'visitors',
					'sessions',
					'pageviews',
					'avg_time_on_page',
				],
			]
		);
		$sql       = $this->get_sql_table( $qd );
		$prev_data = $wpdb->get_results( $sql );

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

		$qd  = new Query_Data(
			[
				'date_start' => $date_start,
				'date_end'   => $date_end,
				'select'     => [
					'pageviews',
					'referrer',
				],
				'filters'    => [ 'referrer' ],
				'group_by'   => 'pageviews DESC',
				'order_by'   => '1',
			]
		);
		$sql = $this->get_sql_table( $qd );
		// get top referrer.
		$top_referrer = $wpdb->get_results( $sql );
		if ( isset( $top_referrer[0] ) ) {
			if ( $top_referrer[0]->referrer === 'Direct' ) {
				$top_referrer[0]->referrer = __( 'Direct', 'burst-statistics' );
			} elseif ( $top_referrer[0]->pageviews === 0 ) {
				$top_referrer[0]->referrer = __( 'No referrers', 'burst-statistics' );
			}
		}

		// get most visited page.
		$qd           = new Query_Data(
			[
				'date_start' => $date_start,
				'date_end'   => $date_end,
				'select'     => [
					'pageviews',
					'page_url',
				],
				'filters'    => [ 'page_url' ],
				'group_by'   => 'pageviews DESC',
				'order_by'   => '1',
			]
		);
		$sql          = $this->get_sql_table( $qd );
		$most_visited = $wpdb->get_results( $sql );
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
	 * Generates a WHERE clause for SQL queries based on provided filters.
	 *
	 * @param Query_Data $data Query_Data object.
	 * @return string WHERE clause for SQL query.
	 */
	private function get_where_clause_for_filters( Query_Data $data ): string {
		$filters       = $this->sanitize_filters( $data->filters );
		$where_clauses = [];

		// Define filters including their table prefixes.
		$possible_filters_with_prefix = apply_filters(
			'burst_possible_filters_with_prefix',
			[
				'bounces'          => 'session_bounces.bounce',
				'new_visitor'      => 'statistics.first_time_visit',
				'page_url'         => 'statistics.page_url',
				'referrer'         => 'statistics.referrer',
				'device'           => 'statistics.device_id',
				'browser'          => 'statistics.browser_id',
				'platform'         => 'statistics.platform_id',
				'platform_id'      => 'statistics.platform_id',
				'browser_id'       => 'statistics.browser_id',
				'device_id'        => 'statistics.device_id',
				'entry_exit_pages' => 'entry_exit_pages',
				// only needed for pages datatable.
				'goal_id'          => 'goals.goal_id',
			]
		);

		if ( $this->is_campaign_conversion_query( $data ) || $this->is_referrer_conversion_query( $data ) || $this->is_parameter_conversion_query( $data ) ) {
			unset( $possible_filters_with_prefix['goal_id'] );
		}

		$mappable = apply_filters(
			'burst_mappable_filters',
			[
				'browser',
				'browser_version',
				'platform',
				'device',
			]
		);
		foreach ( $filters as $filter_name => $filter_value ) {
			if ( in_array( $filter_name, $mappable, true ) ) {
				$filters[ $filter_name ] = \Burst\burst_loader()->frontend->tracking->get_lookup_table_id_cached( $filter_name, $filter_value );
			}
		}
		global $wpdb;
		foreach ( $filters as $filter => $value ) {
			if ( array_key_exists( $filter, $possible_filters_with_prefix ) ) {
				$qualified_name = $possible_filters_with_prefix[ $filter ];
				// Special handling for include/exclude values.
				if ( $filter === 'entry_exit_pages' && $value !== '' ) {
					$where_clauses[] = $value === 'entry' ?
						'statistics.first_time_visit = 1 ' :
						"statistics.ID IN ( SELECT MAX(ID) FROM {$wpdb->prefix}burst_statistics GROUP BY session_id)";
				} elseif ( $value === 'include' ) {
					$where_clauses[] = "{$qualified_name} = 1";
				} elseif ( $value === 'exclude' ) {
					$where_clauses[] = "{$qualified_name} = 0";
				} elseif ( is_numeric( $value ) ) {
					$where_clauses[] = "{$qualified_name} = " . intval( $value );
				} elseif ( substr( $value, -1 ) === '*' ) {
					// remove asterisk.
					$value           = substr( $value, 0, -1 );
					$like            = $wpdb->esc_like( $value ) . '%';
					$where_clauses[] = $wpdb->prepare( "{$qualified_name} LIKE %s", $like );
				} elseif ( strpos( $value, ',' ) !== false ) {
					// explode comma separated values.
					$values          = explode( ',', $value );
					$values          = array_map( 'intval', $values );
					$where_clauses[] = "( $qualified_name= " . implode( " OR $qualified_name = ", $values ) . ')';
				} else {
					$value = esc_sql( sanitize_text_field( $value ) );
					if ( $filter === 'referrer' ) {
						if ( $value === __( 'Direct', 'burst-statistics' ) ) {
							$where_clauses[] = $wpdb->prepare( "{$qualified_name} = %s", '' );
						} else {
							$where_clauses[] = $wpdb->prepare( "{$qualified_name} LIKE %s", "%{$value}" );
						}
					} else {
						$where_clauses[] = $wpdb->prepare( "{$qualified_name} = %s", $value );
					}
				}
			}
		}

		// Construct the WHERE clause.
		$where = implode( ' AND ', $where_clauses );
		return ! empty( $where ) ? "AND $where " : '';
	}

	/**
	 * Generate SQL for a metric
	 */
	public function get_sql_select_for_metric( string $metric, Query_Data $query_data ): string {
		$exclude_bounces = $query_data->exclude_bounces;
		$non_bounce      = 'COALESCE(session_bounces.bounce, 0) = 0';
		global $wpdb;
		// if metric starts with  'count(' and ends with ')', then it's a custom metric.
		// so we sanitize it and return it.
		if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
			// delete the 'count(' and ')' from the metric.
			// sanitize and wrap it in count().
			$metric = $this->sanitize_metric( substr( $metric, 6, - 1 ) );
			return 'count(' . $metric . ')';
		}
		// using COALESCE to prevent NULL values in the output, in the today.
		switch ( $metric ) {
			case 'pageviews':
			case 'count':
				$sql = $exclude_bounces
				? "COALESCE( SUM( CASE WHEN {$non_bounce} THEN 1 ELSE 0 END ), 0)"
				: 'COUNT( statistics.ID )';
				break;
			case 'bounces':
				$sql = 'SUM(session_bounces.bounce) ';
				break;
			case 'bounce_rate':
				$sql = 'ROUND(SUM(session_bounces.bounce) / COUNT(DISTINCT session_bounces.session_id) * 100, 2) ';
				break;
			case 'sessions':
				$sql = $exclude_bounces
					? "COUNT( DISTINCT CASE WHEN {$non_bounce} THEN statistics.session_id END )"
					: 'COUNT( DISTINCT statistics.session_id )';
				break;
			case 'avg_time_on_page':
				$sql = $exclude_bounces
					? "COALESCE( AVG( CASE WHEN {$non_bounce} THEN statistics.time_on_page END ), 0 )"
					: 'AVG( statistics.time_on_page )';
				break;
			case 'avg_session_duration':
				$sql = 'CASE WHEN COUNT( DISTINCT statistics.session_id ) > 0 THEN AVG( statistics.time_on_page ) ELSE 0 END';
				break;
			case 'first_time_visitors':
				$sql = $exclude_bounces
					? "COALESCE( COUNT(DISTINCT CASE WHEN {$non_bounce} AND statistics.first_time_visit = 1 THEN statistics.uid END), 0)"
					: 'COUNT(DISTINCT CASE WHEN statistics.first_time_visit = 1 THEN statistics.uid END)';
				break;
			case 'visitors':
				$sql = $exclude_bounces
					? "COUNT(DISTINCT CASE WHEN {$non_bounce} THEN statistics.uid END)"
					: 'COUNT(DISTINCT statistics.uid)';
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
			case 'conversion_rate':
				$sql = 'LEAST(100, COUNT(goals.goal_id) / COUNT(DISTINCT statistics.session_id) * 100) ';
				break;
			// Handle direct field references (non-aggregated fields).
			case 'device_id':
			case 'browser_id':
			case 'platform_id':
			case 'browser_version_id':
			case 'device_resolution_id':
			case 'session_id':
			case 'time':
			case 'time_on_page':
			case 'first_time_visit':
				$sql = 'statistics.' . $metric;
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
	public function get_sql_select_for_metrics( array $metrics, Query_Data $query_data ): string {
		$metrics = array_map( 'esc_sql', $metrics );
		$select  = '';
		$count   = count( $metrics );
		$i       = 1;
		foreach ( $metrics as $metric ) {
			$sql = $this->get_sql_select_for_metric( $metric, $query_data );
			if ( $sql !== '' && $metric !== '*' ) {
				// if metric starts with  'count(' and ends with ')', then it's a custom metric.
				// so we change the $metric name to 'metric'_count.
				if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
					// strip the 'count(' and ')' from the metric.
					$metric  = substr( $metric, 6, - 1 );
					$metric .= '_count';
				}
				$select .= $sql . ' as ' . $metric;
			} elseif ( $metric === '*' ) {
				// if it's a wildcard, then we don't need to add the alias.
				$select .= '*';
			} else {
				// Skip empty metrics instead of falling back to *.
				self::error_log( 'Skipping empty metric: ' . $metric );
				// Adjust the counter since we're skipping this metric.
				if ( $count !== $i ) {
					// Don't add comma if this is the last metric or if next iteration will be the last.
					$next_metrics_empty = true;
					for ( $j = $i + 1; $j <= $count; $j++ ) {
						if ( $this->get_sql_select_for_metric( $metrics[ $j - 1 ], $query_data ) !== '' || $metrics[ $j - 1 ] === '*' ) {
							$next_metrics_empty = false;
							break;
						}
					}
					if ( ! $next_metrics_empty && $select !== '' ) {
						$select .= ', ';
					}
				}
				++$i;
				continue;
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
		update_option( 'burst_last_db_upgrade_finished_time', time(), false );
		// Create tables without indexes first.
		$tables = [
			'burst_statistics'       => "CREATE TABLE {$wpdb->prefix}burst_statistics (
        `ID` int NOT NULL AUTO_INCREMENT,
        `page_url` varchar(191) NOT NULL,
        `page_id` int(11) NOT NULL,
        `page_type` varchar(191) NOT NULL,
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
			'burst_referrers'        => "CREATE TABLE {$wpdb->prefix}burst_referrers (
        `ID` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL UNIQUE,
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
			[ 'page_id', 'page_type' ],
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

	/**
	 * Enhanced SQL query builder with support for complex queries.
	 *
	 * @param Query_Data $qd Query data object containing all necessary parameters.
	 * @return string Generated SQL query.
	 */
	public function get_sql_table( Query_Data $qd ): string {

		// Check if we can use summary tables.
		$raw = ! empty( $qd->date_modifiers ) && strpos( $qd->date_modifiers['sql_date_format'] ?? '', '%H' ) !== false;
		if ( ! $raw && $this->can_use_summary_tables( $qd ) ) {
			return $this->get_summary_sql( $qd );
		}

		return $this->build_raw_sql( $qd );
	}

	/**
	 * Check if we can use summary tables for this query.
	 */
	private function can_use_summary_tables( Query_Data $data ): bool {
		return ! empty( $data->custom_select ) === false &&
				empty( $data->subquery ) &&
				empty( $data->union ) &&
				empty( $data->window ) &&
				\Burst\burst_loader()->admin->summary->upgrade_completed() &&
				\Burst\burst_loader()->admin->summary->is_summary_data(
					$data->select,
					$data->filters,
					$data->date_start,
					$data->date_end
				);
	}

	/**
	 * Check if the query is for campaign conversions.
	 */
	public function is_parameter_conversion_query( Query_Data $data ): bool {
		// Check if the select contains campaign related fields.
		$goal_or_conversion = in_array( 'conversions', $data->select, true ) || isset( $data->filters['goal_id'] );
		if ( $goal_or_conversion && in_array( 'parameter', $data->select, true ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Check if the query is for campaign conversions.
	 */
	public function is_campaign_conversion_query( Query_Data $data ): bool {
		// Check if the select contains campaign related fields.
		$goal_or_conversion = in_array( 'conversion_rate', $data->select, true ) || in_array( 'conversions', $data->select, true ) || isset( $data->filters['goal_id'] );
		if ( $goal_or_conversion && ! empty( array_intersect( $this->campaign_parameters, $data->select ) ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Check if the query is for referrer conversions.
	 */
	private function is_referrer_conversion_query( Query_Data $data ): bool {
		// Check if the select contains campaign related fields.
		$goal_or_conversion = in_array( 'conversions', $data->select, true ) || isset( $data->filters['goal_id'] );
		if ( $goal_or_conversion && in_array( 'referrer', $data->select, true ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Check if the parameter is a campaign parameter.
	 */
	private function is_campaign_parameter( string $parameter ): bool {
		// Check if the parameter is one of the campaign parameters.
		return in_array( $parameter, $this->campaign_parameters, true );
	}

	/**
	 * Build raw SQL query with enhanced features.
	 */
	private function build_raw_sql( Query_Data $data ): string {
		global $wpdb;
		// Sanitize inputs.
		$data->select   = array_map( 'esc_sql', $data->select );
		$data->filters  = $this->sanitize_filters( $data->filters );
		$data->group_by = esc_sql( $data->group_by );
		$data->order_by = esc_sql( $data->order_by );

		// Build SELECT clause first to get the actual SQL field references.
		$select = $this->build_select_clause( $data );

		// Build FROM clause.
		$table_name = $wpdb->prefix . 'burst_statistics AS statistics';

		// Build JOIN clauses - now that we have the actual SELECT clause.
		$join_sql  = $this->build_join_clauses( $data, $select );
		$where     = $this->build_where_clause( $data );
		$group_by  = $this->build_group_by_clause( $data );
		$having    = $this->build_having_clause( $data->having );
		$order_by  = ! empty( $data->order_by ) ? "ORDER BY {$data->order_by}" : '';
		$limit_sql = $data->limit > 0 ? 'LIMIT ' . $data->limit : '';

		if ( $this->is_parameter_conversion_query( $data ) ) {
			$table_name = " (
                SELECT 
                    p.parameter,
                    p.value,
                    s.uid,
                    MIN(s.time) AS first_visit_time
                FROM {$wpdb->prefix}burst_parameters AS p
                JOIN {$wpdb->prefix}burst_statistics AS s ON s.ID = p.statistic_id
                WHERE s.time > {$data->date_start} AND s.time < {$data->date_end}
                GROUP BY CONCAT(p.parameter, '|', p.value), s.uid
            ) AS params ";
		}

		if ( $this->is_campaign_conversion_query( $data ) ) {
			// get campaigns parameters from select args.
			$parameters = [];
			foreach ( $data->select as $value ) {
				if ( $this->is_campaign_parameter( $value ) ) {
					// prepend ca. to the parameter.
					$parameters[] = 'ca.' . esc_sql( $value );
				}
			}
			$parameter_sql = implode( ', ', $parameters ) . ',';

			// If campaigns are selected, we need to handle the campaigns query.
			$table_name = " (
            SELECT
                s.uid,
                $parameter_sql
                MIN(s.time) AS first_visit_time
              FROM {$wpdb->prefix}burst_campaigns AS ca
              JOIN {$wpdb->prefix}burst_statistics AS s ON s.ID = ca.statistic_id
              WHERE s.time > {$data->date_start} AND s.time < {$data->date_end}
              GROUP BY $parameter_sql s.uid 
            ) AS campaigns ";
		}

		// check if this query needs referrer data.
		if ( $this->is_referrer_conversion_query( $data ) ) {
			$referrer_sql = str_replace( 'statistics.', 's.', $this->get_sql_select_for_metric( 'referrer', $data ) );
			$table_name   = " (
            SELECT
                s.uid, 
                $referrer_sql as referrer,
                MIN(s.time) AS first_visit_time
              FROM {$wpdb->prefix}burst_statistics s
              WHERE s.time > {$data->date_start} AND s.time < {$data->date_end}
              GROUP BY s.uid
            ) AS referrers ";
		}

		// Assemble main query.
		$sql = "SELECT {$select} FROM {$table_name} {$join_sql} WHERE statistics.time > {$data->date_start} AND statistics.time < {$data->date_end} {$where} {$group_by} {$having} {$order_by} {$limit_sql}";

		// Handle subquery wrapping.
		if ( ! empty( $data->subquery ) ) {
			$sql = "SELECT * FROM ({$sql}) AS {$data->subquery}";
		}

		// Handle UNION.
		if ( ! empty( $data->union ) ) {
			foreach ( $data->union as $union_query ) {
				$sql .= ' UNION ' . $union_query;
			}
		}
		return $sql;
	}

	/**
	 * Build SELECT clause with enhanced features.
	 */
	private function build_select_clause( Query_Data $data ): string {
		// Use custom select if provided.
		if ( ! empty( $data->custom_select ) ) {
			return $data->custom_select;
		}
		$select                = $data->select;
		$manually_add_referrer = false;
		if ( $this->is_referrer_conversion_query( $data ) ) {
			$referrer_index = array_search( 'referrer', $select, true );
			unset( $select[ $referrer_index ] );
			$manually_add_referrer = true;
		}

		$distinct = $data->distinct ? 'DISTINCT ' : '';

		// Handle date modifiers for period grouping.
		$period_select = '';
		if ( ! empty( $data->date_modifiers ) ) {
			$timezone_offset = $this->get_mysql_timezone_offset();
			$period_select   = "DATE_FORMAT(FROM_UNIXTIME( time + {$timezone_offset} ), '{$data->date_modifiers['sql_date_format']}') as period, ";
		}

		// Build metrics select.
		$metrics_select = $this->get_sql_select_for_metrics( $select, $data );
		if ( $manually_add_referrer ) {
			$metrics_select = ' referrers.referrer, ' . $metrics_select;
		}
		// Handle window functions.
		$window_select = '';
		if ( ! empty( $data->window ) ) {
			$window_functions = [];
			foreach ( $data->window as $alias => $window_def ) {
				$window_functions[] = "{$window_def} AS {$alias}";
			}
			$window_select = ', ' . implode( ', ', $window_functions );
		}

		return $distinct . $period_select . $metrics_select . $window_select;
	}

	/**
	 * Build enhanced WHERE clause.
	 */
	private function build_where_clause( Query_Data $data ): string {
		$where = $this->get_where_clause_for_filters( $data );
		// Add referrer filtering if needed.
		if ( $this->select_contains_referrer( $data->select ) ) {
			$remove   = [ 'http://www.', 'https://www.', 'http://', 'https://' ];
			$site_url = str_replace( $remove, '', site_url() );
			$table    = $this->is_referrer_conversion_query( $data ) ? 'referrers' : 'statistics';
			$where   .= " AND $table.referrer NOT LIKE '%{$site_url}%'";
		}

		$where = apply_filters( 'burst_build_where_clause', $where, $data );

		// Add custom WHERE clause if provided.
		if ( ! empty( $data->custom_where ) ) {
			$where .= ' ' . $data->custom_where;
		}

		// Add filters to where.
		return $where;
	}

	/**
	 * Build GROUP BY clause from arguments.
	 *
	 * @param Query_Data $data Query arguments containing group_by configuration.
	 * @return string GROUP BY clause string.
	 */
	private function build_group_by_clause( Query_Data $data ): string {
		if ( ! empty( $data->group_by ) ) {
			if ( $this->is_campaign_conversion_query( $data ) ) {
				$group_by_array = explode( ',', $data->group_by );
				// prepend each group_by with 'campaigns_subquery.' to match the campaigns subquery.
				$group_by_array = array_map(
					function ( $item ) {
						return 'campaigns.' . esc_sql( $item );
					},
					$group_by_array
				);
				$data->group_by = implode( ', ', $group_by_array );
			}

			// we need to group parameters by parmater AND value, so we do a concat.
			if ( strpos( $data->group_by, 'parameter' ) !== false ) {
				$group_by_array = explode( ',', $data->group_by );
				foreach ( $group_by_array as $key => $group_by_item ) {
					if ( trim( $group_by_item ) === 'parameter' ) {
						$group_by_array[ $key ] = "CONCAT(params.parameter, '|', params.value)";
					}
				}
				$data->group_by = implode( ', ', $group_by_array );
			}

			return ! empty( $data->group_by ) ? "GROUP BY {$data->group_by}" : '';
		}

		// If no explicit group_by is provided, return empty string.
		// Grouping should be explicit, not automatic based on select fields.
		return '';
	}

	/**
	 * Build HAVING clause.
	 */
	private function build_having_clause( array $having_conditions ): string {
		if ( empty( $having_conditions ) ) {
			return '';
		}

		$conditions = [];
		foreach ( $having_conditions as $condition ) {
			// Ensure condition is a string before escaping.
			$condition_string = is_array( $condition ) ? implode( ' ', $condition ) : (string) $condition;
			// Ensure esc_sql result is always a string.
			$escaped_condition = esc_sql( $condition_string );
			$conditions[]      = is_array( $escaped_condition ) ? implode( ' ', $escaped_condition ) : $escaped_condition;
		}

		return 'HAVING ' . implode( ' AND ', $conditions );
	}

	/**
	 * Enhanced JOIN building with dependency resolution.
	 */
	private function build_join_clauses( Query_Data $data, string $select_clause = '' ): string {
		global $wpdb;
		$goal_sql = '';
		// if we're filtering by goal_id, we need to add it to the join clause. We don't filter in the where clause.
		if ( isset( $data->filters['goal_id'] ) ) {
			$goal_sql = ' AND goals.goal_id = ' . (int) $data->filters['goal_id'] . ' ';
		}
		$available_joins = apply_filters(
			'burst_available_joins',
			[
				'sessions'        => [
					'table'      => 'burst_sessions',
					'on'         => 'statistics.session_id = sessions.ID',
					'type'       => 'INNER',
					'depends_on' => [],
				],
				'goals'           => [
					'table'      => 'burst_goal_statistics',
					'on'         => 'statistics.ID = goals.statistic_id ' . $goal_sql,
					'type'       => 'LEFT',
					'depends_on' => [],
				],
				// we can have multiple bounces per session, so we need to use a subquery to get the bounce status.
				'session_bounces' => [
					'table'      => "( 
                                          SELECT 
                                            session_id,
                                            CASE WHEN MAX(bounce) = 1 THEN 1 ELSE 0 END AS bounce 
                                          FROM {$wpdb->prefix}burst_statistics
                                          WHERE time > {$data->date_start} AND time < {$data->date_end}
                                          GROUP BY session_id
                                        )",
					'on'         => 'statistics.session_id = session_bounces.session_id ',
					'type'       => 'LEFT',
					'depends_on' => [],
				],
			]
		);

		// Auto-detect needed joins from select and filters.
		$needed_joins    = $this->detect_needed_joins( $data, $available_joins, $data->joins, $select_clause );
		$processed_joins = $this->resolve_join_dependencies( $needed_joins, $available_joins );
		return $this->build_join_sql( $processed_joins );
	}

	/**
	 * Auto-detect joins needed based on select and filters.
	 *
	 * @param Query_Data $data           Query arguments.
	 * @param array      $available_joins Available join configurations.
	 * @param array      $needed_joins   Reference to array of needed joins to populate.
	 * @param string     $select_clause  Optional. Built SELECT clause for additional analysis.
	 */
	private function detect_needed_joins( Query_Data $data, array $available_joins, array $needed_joins, string $select_clause = '' ): array {
		$select_string = implode( ' ', $data->select );
		$where_string  = $this->get_where_clause_for_filters( $data );
		$custom_select = $data->custom_select ?? '';

		// Include the actual built SELECT clause which contains the real SQL field references.
		$search_string = $select_string . ' ' . $where_string . ' ' . $custom_select . ' ' . $select_clause . ' ';
		foreach ( $data->select as $metric ) {
			$metric_sql     = $this->get_sql_select_for_metric( $metric, $data );
			$search_string .= ' ' . $metric_sql;
		}

		foreach ( $available_joins as $join_name => $join_config ) {
			if ( $this->is_campaign_conversion_query( $data ) ) {
				if ( $join_name === 'campaigns_conversions' ) {
					$needed_joins['statistics'] = $join_config;
				}

				if ( $join_name === 'campaigns' ) {
					continue;
				}
			}

			if ( $this->is_parameter_conversion_query( $data ) ) {
				if ( $join_name === 'parameter_conversions' ) {
					$needed_joins['statistics'] = $join_config;
				}

				if ( $join_name === 'params' ) {
					continue;
				}
			}

			if ( $this->is_referrer_conversion_query( $data ) ) {
				if ( $join_name === 'referrers_conversions' ) {
					$needed_joins['statistics'] = $join_config;
				}
			}
			if ( strpos( $search_string, $join_name . '.' ) !== false ) {
				$needed_joins[ $join_name ] = $join_config;
			}
		}
		return $needed_joins;
	}

	/**
	 * Helper methods for select content detection
	 */
	private function select_contains_referrer( array $select ): bool {
		return in_array( 'referrer', $select, true ) ||
				! empty( array_filter( $select, fn( $s ) => is_string( $s ) && strpos( $s, 'referrer' ) !== false ) );
	}

	/**
	 * Helper method to check if select contains parameters.
	 *
	 * @param array $select Array of select fields to check.
	 * @return bool True if parameters are referenced in select.
	 */
	public function select_contains_parameters( array $select ): bool {
		return in_array( 'parameters', $select, true ) ||
				! empty( array_filter( $select, fn( $s ) => is_string( $s ) && strpos( $s, 'parameter' ) !== false ) );
	}

	/**
	 * Resolve JOIN dependencies recursively.
	 *
	 * @param array $needed_joins    Array of joins that are needed.
	 * @param array $available_joins Array of all available join configurations.
	 * @return array<string, array{table: string, on: string, type?: string, depends_on?: array<int, string>}> Processed joins with dependencies resolved.
	 */
	private function resolve_join_dependencies( array $needed_joins, array $available_joins ): array {
		$processed_joins = [];

		$add_join_with_dependencies = function ( $join_name, $join_info ) use ( &$processed_joins, &$available_joins, &$add_join_with_dependencies ): void {
			if ( isset( $processed_joins[ $join_name ] ) ) {
				return;
			}

			// Process dependencies first.
			if ( ! empty( $join_info['depends_on'] ) ) {
				foreach ( $join_info['depends_on'] as $dependency ) {
					if ( isset( $available_joins[ $dependency ] ) ) {
						$add_join_with_dependencies( $dependency, $available_joins[ $dependency ] );
					}
				}
			}

			$processed_joins[ $join_name ] = $join_info;
		};

		foreach ( $needed_joins as $join_name => $join_info ) {
			$add_join_with_dependencies( $join_name, $join_info );
		}

		return $processed_joins;
	}

	/**
	 * Build the actual JOIN SQL string
	 */
	private function build_join_sql( array $processed_joins ): string {
		global $wpdb;

		$join_sql = '';
		foreach ( $processed_joins as $alias => $join ) {
			// if the join is a subquery, no prefix is needed.
			$join_table = strpos( $join['table'], 'SELECT' ) === false ? $wpdb->prefix . $join['table'] : $join['table'];
			$join_on    = $join['on'];
			$join_type  = $join['type'] ?? 'INNER';
			$join_sql  .= " {$join_type} JOIN {$join_table} AS {$alias} ON {$join_on}";
		}

		return $join_sql;
	}

	/**
	 * Get summary SQL using the enhanced args format
	 */
	private function get_summary_sql( Query_Data $data ): string {
		return \Burst\burst_loader()->admin->summary->summary_sql(
			$data->date_start,
			$data->date_end,
			$data->select,
			$data->group_by,
			$data->order_by,
			$data->limit,
			$data->date_modifiers
		);
	}

	/**
	 * Base data retrieval method that handles common patterns.
	 *
	 * @param array $config Configuration array with data retrieval settings.
	 * @return array<string, mixed> Processed data result.
	 */
	private function get_base_data( array $config ): array {
		// Set up default configuration.
		$defaults = [
			'args'         => [],
			'default_args' => [
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => [],
			],
			'queries'      => [],
			'processors'   => [],
			'formatters'   => [],
		];

		$config = wp_parse_args( $config, $defaults );

		// Process arguments with defaults.
		$args = wp_parse_args( $config['args'], $config['default_args'] );

		// Extract common values.
		$start   = (int) $args['date_start'];
		$end     = (int) $args['date_end'];
		$filters = $this->sanitize_filters( (array) $args['filters'] );

		// Calculate comparison dates if needed.
		$comparison_dates = null;
		if ( isset( $config['needs_comparison'] ) && $config['needs_comparison'] ) {
			$comparison_dates = $this->calculate_comparison_dates( $start, $end, $args );
		}

		// Execute queries.
		$results = [];
		foreach ( $config['queries'] as $key => $query_config ) {
			$results[ $key ] = $this->execute_data_query( $query_config, $start, $end, $filters, $comparison_dates );
		}

		// Process results.
		foreach ( $config['processors'] as $processor ) {
			if ( is_callable( $processor ) ) {
				$results = $processor( $results, $args );
			}
		}

		// Format final result.
		$formatted_result = $results;
		foreach ( $config['formatters'] as $formatter ) {
			if ( is_callable( $formatter ) ) {
				$formatted_result = $formatter( $formatted_result, $args );
			}
		}

		return $formatted_result;
	}

	/**
	 * Calculate comparison date ranges.
	 *
	 * @param int   $start Start timestamp.
	 * @param int   $end   End timestamp.
	 * @param array $args  Arguments containing optional comparison dates.
	 * @return array{start: int, end: int} Array with start and end timestamps for comparison period.
	 */
	private function calculate_comparison_dates( int $start, int $end, array $args ): array {
		if ( isset( $args['compare_date_start'] ) && isset( $args['compare_date_end'] ) ) {
			return [
				'start' => (int) $args['compare_date_start'],
				'end'   => (int) $args['compare_date_end'],
			];
		}

		$diff = $end - $start;
		return [
			'start' => $start - $diff,
			'end'   => $end - $diff,
		];
	}

	/**
	 * Execute a single data query based on configuration.
	 *
	 * @param array      $query_config     Query configuration settings.
	 * @param int        $start            Start timestamp.
	 * @param int        $end              End timestamp.
	 * @param array      $filters          Filters to apply.
	 * @param array|null $comparison_dates Optional comparison date range.
	 * @return array<string, mixed> Query results with current and optionally previous period data.
	 */
	private function execute_data_query( array $query_config, int $start, int $end, array $filters, ?array $comparison_dates = null ): array {
		$defaults = [
			// standard, bounces, conversions, enhanced.
			'type'          => 'standard',
			'select'        => [ '*' ],
			'filters'       => [],
			'group_by'      => '',
			'order_by'      => '',
			'limit'         => 0,
			'enhanced_args' => [],
			'comparison'    => false,
		];

		$query_config = wp_parse_args( $query_config, $defaults );

		// Merge filters.
		$merged_filters = array_merge( $filters, $query_config['filters'] );

		$result = [];

		// Execute current period query.
		switch ( $query_config['type'] ) {
			case 'bounces':
				$result['current'] = $this->get_bounces( $start, $end, $merged_filters );
				break;
			case 'conversions':
				$result['current'] = $this->get_conversions( $start, $end, $merged_filters );
				break;
			case 'enhanced':
				$enhanced_args = array_merge(
					[
						'date_start' => $start,
						'date_end'   => $end,
						'filters'    => $merged_filters,
					],
					$query_config['enhanced_args']
				);

				global $wpdb;
				$qd                = new Query_Data( $enhanced_args );
				$sql               = $this->get_sql_table( $qd );
				$result['current'] = $wpdb->get_results( $sql, ARRAY_A );
				break;
			default:
				$result['current'] = $this->get_data(
					$query_config['select'],
					$start,
					$end,
					$merged_filters
				);
				break;
		}

		// Execute comparison period query if needed.
		if ( $query_config['comparison'] && $comparison_dates !== null ) {
			switch ( $query_config['type'] ) {
				case 'bounces':
					$result['previous'] = $this->get_bounces(
						$comparison_dates['start'],
						$comparison_dates['end'],
						$merged_filters
					);
					break;
				case 'conversions':
					$result['previous'] = $this->get_conversions(
						$comparison_dates['start'],
						$comparison_dates['end'],
						$merged_filters
					);
					break;
				default:
					$result['previous'] = $this->get_data(
						$query_config['select'],
						$comparison_dates['start'],
						$comparison_dates['end'],
						$merged_filters
					);
					break;
			}
		}
		return $result;
	}
}
