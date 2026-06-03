<?php
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

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

		// Add support for ID argument.
		add_filter( 'burst_get_data_available_args', [ $this, 'add_subscription_datatable_available_args' ], 10, 2 );
	}

	/**
	 * Add subscription datatable available args to the allow-list for validation.
	 *
	 * @param array  $available_args Existing available args (key ⇒ description).
	 * @param string $data_type The type of data being requested.
	 * @return array Extended available args.
	 */
	public function add_subscription_datatable_available_args( array $available_args, string $data_type ): array {
		if ( 'datatable' !== $data_type ) {
			return $available_args;
		}

		$available_args[] = 'id';

		return $available_args;
	}

	/**
	 * Clear the test hit from the database, which is added during onboarding.
	 */
	public function clear_test_visit(): void {
		global $wpdb;
		$session_ids = $wpdb->get_col( "SELECT session_id FROM {$wpdb->prefix}burst_statistics WHERE parameters LIKE '%burst_test_hit%' OR parameters LIKE '%burst_nextpage%'" );

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
			'date_start'               => $time_start_30m,
			'date_end'                 => $now + HOUR_IN_SECONDS,
			'custom_select'            => '%s time+time_on_page / 1000 AS active_time, sessions.referrer AS utm_source, page_url, time, time_on_page, uid, page_id',
			'custom_select_parameters' => [ '' ],
			'order_by'                 => 'active_time DESC',
			'limit'                    => 100,
			'select'                   => [ 'referrer' ],
		];

		$qd      = new Query_Data( 'live_traffic_data', $args );
		$traffic = $this->get_results( apply_filters( 'burst_live_traffic_args', $qd ) );
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
		$args       = [
			'date_start'               => $time_start,
			// Add buffer to ensure we don't exclude based on end time.
			'date_end'                 => $now + HOUR_IN_SECONDS,
			'custom_select'            => '%s COUNT(DISTINCT(uid))',
			'custom_select_parameters' => [ '' ],
			'custom_where'             => 'AND ( (time + time_on_page / 1000 + %d + %d) > %d)',
			'custom_where_parameters'  => [ $on_page_offset, $exit_margin, $now ],
		];
		$qd         = new Query_Data( 'live_visitors_data', $args );
		$live_value = $this->get_var( $qd );

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
		$qd = new Query_Data(
			'today_summary',
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'visitors', 'pageviews', 'avg_time_on_page' ] ,
			]
		);

		$results = $this->get_row( $qd );
		if ( is_object( $results ) ) {
			$data['today']['value']      = max( 0, (int) $results->visitors );
			$data['pageviews']['value']  = max( 0, (int) $results->pageviews );
			$data['timeOnPage']['value'] = max( 0, (int) $results->avg_time_on_page );
		}

		// Query for most viewed page and top referrer.
		foreach (
			[
				'mostViewed' => [ 'page_url', 'pageviews' ],
				'referrer'   => [ 'referrer', 'pageviews' ],
			] as $key => $fields
		) {
			$qd     = new Query_Data(
				"today_$key",
				[
					'date_start' => $start,
					'date_end'   => $end,
					'select'     => $fields,
					'group_by'   => $fields[0],
					'order_by'   => 'pageviews DESC',
					'limit'      => 1,
				]
			);
			$result = $this->get_row( $qd );
			if ( is_object( $result ) ) {
				$data[ $key ]['title'] = $result->{$fields[0]};
				$data[ $key ]['value'] = $result->pageviews;
			}
		}

		return $data;
	}


	/**
	 * Get date modifiers for insights charts, based on the date range.
	 *
	 * @param int    $date_start Unix timestamp marking the start of the period.
	 * @param int    $date_end   Unix timestamp marking the end of the period.
	 * @param string $group_by   Explicit grouping interval ('hour'|'day'|'week'|'month'|'year'), or 'auto' to derive from range length.
	 * @return array{
	 *     interval: string,
	 *     interval_in_seconds: mixed,
	 *     nr_of_intervals: int,
	 *     sql_date_format: string,
	 *     php_date_format: string,
	 *     spans_multiple_years: bool
	 * }
	 */
	public function get_insights_date_modifiers( int $date_start, int $date_end, string $group_by = 'auto' ): array {
		// Define intervals and corresponding settings.
		$intervals = [
			'hour'  => [ '%Y-%m-%d %H', 'Y-m-d H', HOUR_IN_SECONDS ],
			'day'   => [ '%Y-%m-%d', 'Y-m-d', DAY_IN_SECONDS ],
			// Use %x (ISO year) and %v (ISO week), to prevent 0 hits on week 1 of a leap year.
			'week'  => [ '%x-%v', 'o-W', WEEK_IN_SECONDS ],
			'month' => [ '%Y-%m', 'Y-m', MONTH_IN_SECONDS ],
			'year'  => [ '%Y', 'Y', YEAR_IN_SECONDS ],
		];

		// When group_by is 'auto', determine the best interval from the range length.
		if ( 'auto' === $group_by || ! isset( $intervals[ $group_by ] ) ) {
			$nr_of_days = $this->get_nr_of_periods( 'day', $date_start, $date_end );

			if ( $nr_of_days > 1095 ) {
				// More than ~3 years: monthly ticks become unreadable, switch to yearly.
				$interval = 'year';
			} elseif ( $nr_of_days > 364 ) {
				$interval = 'month';
			} elseif ( $nr_of_days > 48 ) {
				$interval = 'week';
			} elseif ( $nr_of_days > 2 ) {
				$interval = 'day';
			} else {
				$interval = 'hour';
			}
		} else {
			$interval = $group_by;
		}

		// Extract settings based on the determined interval.
		list( $sql_date_format, $php_date_format, $interval_in_seconds ) = $intervals[ $interval ];

		$nr_of_intervals = $this->get_nr_of_periods( $interval, $date_start, $date_end );

		// Check if the date range spans multiple years.
		$spans_multiple_years = gmdate( 'Y', $date_start ) !== gmdate( 'Y', $date_end );

		return [
			'interval'             => $interval,
			'interval_in_seconds'  => $interval_in_seconds,
			'nr_of_intervals'      => $nr_of_intervals,
			'sql_date_format'      => $sql_date_format,
			'php_date_format'      => $php_date_format,
			'spans_multiple_years' => $spans_multiple_years,
		];
	}

	/**
	 * Get insights data for charting purposes.
	 *
	 * When `compare_mode` is set and exactly one metric is selected, a second
	 * dataset entry is appended with `is_comparison: true`. That entry carries
	 * the comparison-period values aligned to the current-period x-axis, plus
	 * a `comparison_timestamps` array so the frontend can show the real
	 * comparison date in the tooltip.
	 *
	 * @param array $args {
	 *     Optional. Parameters to define time range and metrics.
	 * @type int      $date_start   Start of the data range (timestamp).
	 * @type int      $date_end     End of the data range (timestamp).
	 * @type string[] $metrics      List of metrics to retrieve (e.g., 'pageviews', 'visitors').
	 * @type array    $filters      Filters to apply to the query.
	 * @type string   $group_by     Grouping interval ('auto'|'hour'|'day'|'week'|'month').
	 * @type string   $compare_mode Comparison mode: 'previous_period' or 'year_over_year'.
	 * }
	 * @return array{
	 *     timestamps: int[],
	 *     interval: string,
	 *     spans_multiple_years: bool,
	 *     datasets: array<int, array{
	 *         data: list<int|float>,
	 *         backgroundColor: string,
	 *         borderColor: string,
	 *         label: string,
	 *         fill: string,
	 *         metric_key: string,
	 *         is_comparison: bool,
	 *         comparison_timestamps?: list<int>,
	 *         compare_mode?: string
	 *     }>
	 * }
	 * @throws \Exception //exception.
	 */
	public function get_insights_data( array $args = [] ): array {
		$defaults = [
			'date_start'   => 0,
			'date_end'     => 0,
			'metrics'      => [ 'pageviews', 'visitors' ],
			'group_by'     => 'auto',
			'compare_mode' => '',
		];
		$args     = wp_parse_args( $args, $defaults );

		// normalize_value() in class-app.php always wraps group_by in an array (e.g. ['day']).
		// Extract the first element so we get a plain string to pass to get_insights_date_modifiers().
		$group_by_raw = $args['group_by'] ?? 'auto';
		$group_by     = is_array( $group_by_raw ) ? (string) ( $group_by_raw[0] ?? 'auto' ) : (string) $group_by_raw;

		$start = (int) $args['date_start'];
		$end   = (int) $args['date_end'];

		$qd = new Query_Data(
			'insights_data',
			[
				'date_start'     => $start,
				'date_end'       => $end,
				'select'         => $args['metrics'],
				'filters'        => $args['filters'] ?? [],
				'group_by'       => 'period',
				'order_by'       => 'period',
				'limit'          => 0,
				'date_modifiers' => $this->get_insights_date_modifiers(
					$start,
					$end,
					$group_by
				),
			]
		);

		$metric_labels  = $qd->get_allowed_metrics_labels();
		$date_start     = $qd->get_date_start();
		$metrics        = $qd->get_select();
		$date_modifiers = $qd->get_date_modifiers();
		$datasets       = [];

		// Build one dataset entry per metric.
		foreach ( $metrics as $metrics_key => $metric ) {
			$datasets[ $metrics_key ] = [
				'data'            => [],
				'backgroundColor' => $this->get_metric_color( $metric, 'background' ),
				'borderColor'     => $this->get_metric_color( $metric, 'border' ),
				'label'           => $metric_labels[ $metric ],
				'fill'            => 'false',
				'metric_key'      => $metric,
				'is_comparison'   => false,
			];
		}

		// We have a UTC timestamp corrected for the timezone offset used to query the statistics table.
		// Add the offset back to compute the local-time equivalent for key generation.
		$timezone_offset = self::get_wp_timezone_offset();
		$date            = $date_start + $timezone_offset;

		// $timestamps maps the period key (e.g. '2024-01-03') to the raw UTC Unix timestamp
		// of that period's start, so the frontend can format dates with Intl.DateTimeFormat().
		$timestamps = [];

		for ( $i = 0; $i < $date_modifiers['nr_of_intervals']; $i++ ) {
			$formatted_date = date_i18n( $date_modifiers['php_date_format'], $date );

			// Store the UTC start timestamp for this period slot.
			$timestamps[ $formatted_date ] = $date - $timezone_offset;

			foreach ( $metrics as $metric_key => $metric ) {
				$datasets[ $metric_key ]['data'][ $formatted_date ] = 0;
			}

			// Advance by a real calendar step so month/week slots align with the SQL
			// DATE_FORMAT keys; using a flat seconds constant would skip months
			// (e.g. February and December) over a 12-month range.
			$date = $this->advance_period_timestamp( $date, $date_modifiers['interval'] );
		}

		$hits = $this->get_results( $qd, ARRAY_A );

		// Match DB results to period slots.
		foreach ( $hits as $hit ) {
			$period = $hit['period'];
			foreach ( $metrics as $metric_key => $metric_name ) {
				if ( isset( $datasets[ $metric_key ]['data'][ $period ] ) && isset( $hit[ $metric_name ] ) ) {
					$datasets[ $metric_key ]['data'][ $period ] = $hit[ $metric_name ];
				}
			}
		}

		// Strip associative keys so the frontend receives plain indexed arrays.
		$timestamps = array_values( $timestamps );
		foreach ( $metrics as $metric_key => $metric_name ) {
			$datasets[ $metric_key ]['data'] = array_values( $datasets[ $metric_key ]['data'] );
		}

		$result = [
			'timestamps'           => $timestamps,
			'interval'             => $date_modifiers['interval'],
			'spans_multiple_years' => $date_modifiers['spans_multiple_years'],
			'datasets'             => $datasets,
		];

		// When a compare_mode is set and only a single metric is selected, append a comparison
		// dataset so the frontend can render a dashed line without a separate data structure.
		// The comparison line is only meaningful with one active metric (no multi-series overlap).
		$compare_mode = (string) ( $args['compare_mode'] ?? '' );
		$metrics_list = (array) ( $args['metrics'] ?? [] );

		if ( ! empty( $compare_mode ) && 1 === count( $metrics_list ) ) {
			$comparison = $this->get_insights_comparison_data(
				$start,
				$end,
				$compare_mode,
				$metrics_list,
				$args['filters'] ?? [],
				$date_modifiers
			);

			$active_metric = reset( $metrics_list );

			// Append a comparison entry to datasets so the frontend treats it as a
			// regular series while styling it differently based on is_comparison.
			$result['datasets'][] = [
				'data'                  => $comparison['datasets'][0]['data'] ?? [],
				'backgroundColor'       => $this->get_metric_color( $active_metric, 'background' ),
				'borderColor'           => $this->get_metric_color( $active_metric, 'border' ),
				'label'                 => $metric_labels[ $active_metric ] ?? $active_metric,
				'fill'                  => 'false',
				'metric_key'            => $active_metric,
				'is_comparison'         => true,
				'comparison_timestamps' => $comparison['timestamps'],
				'compare_mode'          => $compare_mode,
			];
		}

		return $result;
	}

	/**
	 * Build comparison period data for the insights chart.
	 *
	 * Runs the same insights query against a shifted date window (previous period
	 * or same period last year) and returns the dataset values together with the
	 * actual comparison timestamps so the tooltip can display the correct dates.
	 *
	 * @param int    $start          Current period start timestamp.
	 * @param int    $end            Current period end timestamp.
	 * @param string $compare_mode   'previous_period' or 'year_over_year'.
	 * @param array  $metrics        Metric keys to query.
	 * @param array  $filters        Active filters.
	 * @param array  $date_modifiers Date modifiers from the current period query.
	 * @return array{
	 *     datasets: array<int, array{data: list<int|float>}>,
	 *     timestamps: list<int>,
	 *     start_date: int,
	 *     end_date: int
	 * }
	 */
	private function get_insights_comparison_data( int $start, int $end, string $compare_mode, array $metrics, array $filters, array $date_modifiers ): array {
		if ( 'year_over_year' === $compare_mode ) {
			$compare_start = (int) strtotime( '-1 year', $start );
			$compare_end   = (int) strtotime( '-1 year', $end );
		} else {
			// Default: previous period of equal length.
			$diff          = $end - $start;
			$compare_start = $start - $diff - 1;
			$compare_end   = $end - $diff - 1;
		}

		$qd_compare = new Query_Data(
			'insights_data',
			[
				'date_start'     => $compare_start,
				'date_end'       => $compare_end,
				'select'         => $metrics,
				'filters'        => $filters,
				'group_by'       => 'period',
				'order_by'       => 'period',
				'limit'          => 0,
				// Re-use the same interval type so the result has the same number of slots.
				'date_modifiers' => $this->get_insights_date_modifiers(
					$compare_start,
					$compare_end,
					$date_modifiers['interval']
				),
			]
		);

		$comp_date_start     = $qd_compare->get_date_start();
		$comp_metrics        = $qd_compare->get_select();
		$comp_date_modifiers = $qd_compare->get_date_modifiers();

		$timezone_offset = self::get_wp_timezone_offset();
		$comp_date       = $comp_date_start + $timezone_offset;
		$comp_timestamps = [];
		$comp_data       = [];

		// Initialise dataset slots using the comparison period's own timestamps.
		foreach ( $comp_metrics as $metric ) {
			$comp_data[ $metric ] = [];
		}

		for ( $i = 0; $i < $comp_date_modifiers['nr_of_intervals']; $i++ ) {
			$formatted_date                     = date_i18n( $comp_date_modifiers['php_date_format'], $comp_date );
			$comp_timestamps[ $formatted_date ] = $comp_date - $timezone_offset;

			foreach ( $comp_metrics as $metric ) {
				$comp_data[ $metric ][ $formatted_date ] = 0;
			}

			$comp_date = $this->advance_period_timestamp( $comp_date, $comp_date_modifiers['interval'] );
		}

		$hits = $this->get_results( $qd_compare, ARRAY_A );

		foreach ( $hits as $hit ) {
			$period = $hit['period'];
			foreach ( $comp_metrics as $metric ) {
				if ( isset( $comp_data[ $metric ][ $period ] ) && isset( $hit[ $metric ] ) ) {
					$comp_data[ $metric ][ $period ] = $hit[ $metric ];
				}
			}
		}

		// Build indexed datasets and timestamps for the comparison period.
		$datasets = [];
		foreach ( $comp_metrics as $i => $metric ) {
			$datasets[ $i ] = [
				'data' => array_values( $comp_data[ $metric ] ),
			];
		}

		return [
			'datasets'   => $datasets,
			'timestamps' => array_values( $comp_timestamps ),
			'start_date' => $compare_start,
			'end_date'   => $compare_end,
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
						$filters              = $args['filters'];
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
		$qd     = new Query_Data(
			'statistics_get_data',
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => $select,
				'filters'    => $filters,
			]
		);
		$result = $this->get_results( $qd, 'ARRAY_A' );

		return $result[0] ?? array_fill_keys( $select, 0 );
	}

	/**
	 * Get bounces for a given time period.
	 */
	private function get_bounces( int $start, int $end, array $filters ): int {
		$qd = new Query_Data(
			'statistics_bounces',
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'bounces' ],
				'filters'    => $filters,
			]
		);
		return (int) $this->get_var( $qd );
	}

	/**
	 * Get conversions for a given time period.
	 */
	private function get_conversions( int $start, int $end, array $filters ): int {
		global $wpdb;

		// filter is goal id so pageviews returned are the conversions.
		$qd = new Query_Data(
			'statistics_conversions',
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'conversions' ],
				'filters'    => $filters,
			]
		);

		return (int) $this->get_var( $qd );
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

		$query_args['select']                   = [ 'device_id' ];
		$query_args['custom_select']            = '%s sessions.device_id, COUNT(sessions.device_id) AS count';
		$query_args['custom_select_parameters'] = [ '' ];
		$query_args['group_by']                 = 'device_id';
		$query_args['having']                   = [ 'sessions.device_id > 0' ];

		$qd             = new Query_Data( 'devices_title_and_value', $query_args );
		$devices_result = $this->get_results( $qd, ARRAY_A );

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

		$args    = wp_parse_args( $args, $defaults );
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

			$query_args['select']                   = [ 'browser_id', 'platform_id' ];
			$query_args['custom_select']            = '%s sessions.browser_id, sessions.platform_id, COUNT(*) as count';
			$query_args['custom_select_parameters'] = [ '' ];
			$query_args['group_by']                 = [ 'browser_id', 'platform_id' ];
			$query_args['having']                   = [ 'sessions.browser_id > 0' ];
			$query_args['order_by']                 = 'count DESC';

			$qd      = new Query_Data( "devices_subtitle_$device", $query_args );
			$results = $this->get_row( $qd, ARRAY_A );

			$browser_id      = $results['browser_id'] ?? 0;
			$platform_id     = $results['platform_id'] ?? 0;
			$browser         = $this->get_lookup_table_name_by_id( 'browser', $browser_id );
			$platform        = $this->get_lookup_table_name_by_id( 'platform', $platform_id );
			$data[ $device ] = [
				'os'        => $platform ?: '',
				'browser'   => $browser ?: '',
				'device_id' => \Burst\burst_loader()->frontend->tracking->get_lookup_table_id( 'device', $device ),
			];
		}

		// Setup defaults.
		$default_data = [
			'desktop' => [
				'os'        => '',
				'browser'   => '',
				'device_id' => 0,
			],
			'tablet'  => [
				'os'        => '',
				'browser'   => '',
				'device_id' => 0,
			],
			'mobile'  => [
				'os'        => '',
				'browser'   => '',
				'device_id' => 0,
			],
			'other'   => [
				'os'        => '',
				'browser'   => '',
				'device_id' => 0,
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
	public function get_datatables_data( array $args = [] ): array {
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'metrics'    => [ 'pageviews' ],
			'filters'    => [],
			'group_by'   => [],
			'limit'      => '',
		];

		$args = wp_parse_args( $args, $defaults );

		$filters  = $args['filters'];
		$metrics  = $args['metrics'];
		$group_by = $args['group_by'];
		$start    = (int) $args['date_start'];
		$end      = (int) $args['date_end'];
		$columns  = [];
		$limit    = (int) ( $args['limit'] ?? 0 );

		// If metrics are not set return error.
		if ( empty( $metrics ) ) {
			$metrics = [
				'pageviews',
			];
		}

		$data = apply_filters( 'burst_datatable_pre_data', null, $args );
		$qd   = new Query_Data( 'datatables_data' );

		if ( null === $data ) {
			$last_metric_count = count( $metrics ) - 1;
			$order_by          = isset( $metrics[ $last_metric_count ] ) ? sprintf( '%s DESC', $metrics[ $last_metric_count ] ) : 'pageviews DESC';
			$qd                = new Query_Data(
				'datatables_data',
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
			$data              = $this->get_results( $qd, ARRAY_A );
		}

		$metric_labels = $qd->get_allowed_metrics_labels();

		foreach ( $metrics as $metric ) {
			// If goal_id isset then metric is a conversion.
			$title = $metric_labels[ $metric ] ?? ucwords( str_replace( '_', ' ', (string) $metric ) );

			$columns[] = [
				'name'     => $title,
				'id'       => $metric,
				'sortable' => 'true',
				'right'    => 'true',
			];
		}

		$data = apply_filters( 'burst_datatable_data', $data, $qd );

		$response = [
			'columns' => $columns,
			'data'    => $data,
			'metrics' => $metrics,
		];

		return apply_filters( 'burst_datatable_response', $response, $args );
	}

	/**
	 * Generate dummy data for datatable display.
	 *
	 * @return array Array of dummy data rows.
	 */
	public function get_dummy_datatable_data(): array {
		$page_urls = [
			'/',
			'/about-us',
			'/contact',
			'/blog',
			'/pricing',
			'/products',
			'/features',
			'/services',
			'/shop',
			'/checkout',
			'/cart',
			'/faq',
			'/documentation',
			'/case-studies',
			'/testimonials',
			'/careers',
			'/privacy-policy',
			'/terms-and-conditions',
			'/integrations',
			'/landing-page',
		];

		$dummy_rows = [];

		for ( $i = 0; $i < 15; $i++ ) {
			$pageviews             = wp_rand( 800, 5000 );
			$visitors              = wp_rand( (int) ( $pageviews * 0.6 ), (int) ( $pageviews * 0.9 ) );
			$sessions              = wp_rand( $visitors, (int) ( $visitors * 1.2 ) );
			$bounce_rate           = round( wp_rand( 20, 65 ) + ( wp_rand( 0, 9 ) / 10 ), 1 );
			$avg_time_on_page      = wp_rand( 90, 480 );
			$entrances             = wp_rand( 300, 1800 );
			$exit_rate             = round( wp_rand( 15, 70 ) + ( wp_rand( 0, 9 ) / 10 ), 1 );
			$conversions           = wp_rand( 20, 350 );
			$conversion_rate       = round( ( $conversions / $pageviews ) * 100, 1 );
			$sales                 = wp_rand( 5, 120 );
			$revenue               = wp_rand( 500, 10000 );
			$sales_conversion_rate = round( ( $sales / $pageviews ) * 100, 1 );
			$page_value            = round( $revenue / $pageviews, 2 );

			$dummy_rows[] = [
				'page_url'              => $page_urls[ array_rand( $page_urls ) ],
				'pageviews'             => $pageviews,
				'visitors'              => $visitors,
				'sessions'              => $sessions,
				'bounce_rate'           => $bounce_rate,
				'avg_time_on_page'      => $avg_time_on_page,
				'entrances'             => $entrances,
				'exit_rate'             => $exit_rate,
				'conversions'           => $conversions,
				'conversion_rate'       => $conversion_rate,
				'sales'                 => $sales,
				'revenue'               => [
					'currency' => 'USD',
					'value'    => $revenue,
				],
				'sales_conversion_rate' => $sales_conversion_rate,
				'page_value'            => [
					'currency' => 'USD',
					'value'    => $page_value,
				],
			];
		}

		return $dummy_rows;
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
	 * Get the number of periods between two dates.
	 *
	 * For months the calculation is calendar-aware so that every
	 * month in the range is counted correctly regardless of length.
	 *
	 * @param string $period     The period to calculate (e.g., 'day', 'week', 'month').
	 * @param int    $date_start Start date as a Unix timestamp.
	 * @param int    $date_end   End date as a Unix timestamp.
	 * @return int The number of periods between the two dates.
	 */
	private function get_nr_of_periods(
		string $period,
		int $date_start,
		int $date_end
	): int {
		// Calendar-aware counts: use real boundaries so every interval slot generated
		// by the loop in get_insights_data() matches a possible SQL DATE_FORMAT key.
		// Plain seconds division (e.g. range / WEEK_IN_SECONDS) drifts across DST and
		// leap weeks/years, leaving gaps in the chart.
		if ( 'month' === $period || 'year' === $period || 'week' === $period ) {
			$start = new \DateTime( '@' . $date_start );
			$end   = new \DateTime( '@' . $date_end );
			$start->setTimezone( wp_timezone() );
			$end->setTimezone( wp_timezone() );

			if ( 'month' === $period ) {
				$diff = $start->diff( $end );
				return $diff->y * 12 + $diff->m + 1;
			}

			if ( 'year' === $period ) {
				return (int) $end->format( 'Y' ) - (int) $start->format( 'Y' ) + 1;
			}

			// Week: align both endpoints to the ISO Monday of their week, then count weeks.
			$start->modify( 'monday this week' )->setTime( 0, 0, 0 );
			$end->modify( 'monday this week' )->setTime( 0, 0, 0 );
			$diff_days = (int) $start->diff( $end )->days;

			return (int) floor( $diff_days / 7 ) + 1;
		}

		$range_in_seconds  = $date_end - $date_start;
		$period_in_seconds = defined( strtoupper( $period ) . '_IN_SECONDS' ) ? constant( strtoupper( $period ) . '_IN_SECONDS' ) : DAY_IN_SECONDS;

		return (int) round( $range_in_seconds / $period_in_seconds );
	}

	/**
	 * Advance a timestamp by one interval step.
	 *
	 * For calendar-aware intervals ('month', 'week') we use DateTimeImmutable so that
	 * stepping respects real month lengths (28-31 days) instead of a flat 30-day
	 * constant. Falling back to fixed-length seconds would cause months to be
	 * skipped or duplicated across a year (e.g. December disappearing because
	 * 12 * 30 days = 360 days).
	 *
	 * The timestamp is treated as UTC here on purpose: callers encode local
	 * civil time into a UTC timestamp by adding the WP timezone offset, so we
	 * advance in UTC to avoid double-applying DST shifts.
	 *
	 * @param int    $timestamp Unix timestamp to advance.
	 * @param string $interval  Interval key ('hour'|'day'|'week'|'month'|'year').
	 * @return int Advanced timestamp.
	 */
	private function advance_period_timestamp( int $timestamp, string $interval ): int {
		$calendar_modifiers = [
			'year'  => '+1 year',
			'month' => '+1 month',
			'week'  => '+1 week',
		];

		if ( isset( $calendar_modifiers[ $interval ] ) ) {
			$date = ( new \DateTimeImmutable( '@' . $timestamp ) )->modify( $calendar_modifiers[ $interval ] );

			return $date->getTimestamp();
		}

		if ( 'hour' === $interval ) {
			return $timestamp + HOUR_IN_SECONDS;
		}

		return $timestamp + DAY_IN_SECONDS;
	}

	/**
	 * Get color for a graph.
	 *
	 * @param string $metric The metric key.
	 * @param string $type   The color type (background or border).
	 * @return string RGBA color string.
	 */
	private function get_metric_color(
		string $metric = 'visitors',
		string $type = 'default'
	): string {
		// CSS custom property strings; the frontend's METRIC_COLORS map takes precedence,
		// but these values serve as a consistent fallback for any context that reads
		// borderColor directly from the API response.
		$colors = [
			'visitors'    => [
				'background' => 'var(--color-blue-400)',
				'border'     => 'var(--color-blue-400)',
			],
			'pageviews'   => [
				'background' => 'var(--color-yellow-500)',
				'border'     => 'var(--color-yellow-500)',
			],
			'bounces'     => [
				'background' => 'var(--color-red-500)',
				'border'     => 'var(--color-red-500)',
			],
			'sessions'    => [
				'background' => 'var(--color-orange-500)',
				'border'     => 'var(--color-orange-500)',
			],
			'conversions' => [
				'background' => 'var(--color-primary-700)',
				'border'     => 'var(--color-primary-700)',
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
		$filters       = $data->sanitize_filters( $data->filters );
		$where_clauses = [];

		// Define filters including their table prefixes.
		$possible_filters_with_prefix = apply_filters(
			'burst_possible_filters_with_prefix',
			[
				'bounces'          => 'sessions.bounce',
				'host'             => 'sessions.host',
				'new_visitor'      => 'sessions.first_time_visit',
				'page_url'         => 'statistics.page_url',
				'referrer'         => 'sessions.referrer',
				'browser'          => 'sessions.browser_id',
				'platform'         => 'sessions.platform_id',
				'platform_id'      => 'sessions.platform_id',
				'browser_id'       => 'sessions.browser_id',
				'device'           => 'sessions.device_id',
				'device_id'        => 'sessions.device_id',
				'entry_exit_pages' => 'entry_exit_pages',
				'parameter'        => 'parameter',
				'parameters'       => 'statistics.parameters',
				// only needed for pages datatable.
				'goal_id'          => 'goals.goal_id',
			]
		);

		if ( $this->is_campaign_conversion_query( $data ) || $this->is_parameter_conversion_query( $data ) ) {
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
				$filters[ $filter_name ] = \Burst\burst_loader()->frontend->tracking->get_lookup_table_id( $filter_name, $filter_value );
			}
		}
		global $wpdb;
		foreach ( $filters as $filter => $value ) {
			if ( array_key_exists( $filter, $possible_filters_with_prefix ) ) {
				$qualified_name = $possible_filters_with_prefix[ $filter ];
				$is_exclude     = ( $data->filter_exclusions[ $filter ] ?? 'include' ) === 'exclude';
				$eq_operator    = $is_exclude ? '!=' : '=';
				$like_keyword   = $is_exclude ? 'NOT LIKE' : 'LIKE';

				// Special handling for include/exclude values.
				if ( $filter === 'entry_exit_pages' && $value !== '' ) {
					$where_clauses[] = $value === 'entry' ?
						'sessions.first_time_visit = 1 ' :
						"statistics.ID IN ( SELECT MAX(ID) FROM {$wpdb->prefix}burst_statistics GROUP BY session_id)";
				} elseif ( $value === 'include' ) {
					$where_clauses[] = "$qualified_name = 1";
				} elseif ( $value === 'exclude' ) {
					$where_clauses[] = "$qualified_name = 0";
				} elseif ( is_numeric( $value ) ) {
					$where_clauses[] = "$qualified_name $eq_operator " . intval( $value );
				} elseif ( substr( $value, -1 ) === '*' ) {
					// remove asterisk.
					$value = substr( $value, 0, -1 );
					$like  = $wpdb->esc_like( $value ) . '%';
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $qualified_name is a from a trusted array.
					$where_clauses[] = $wpdb->prepare( "$qualified_name $like_keyword %s", $wpdb->esc_like( $like ) );
				} elseif ( strpos( $value, ',' ) !== false ) {
					// explode comma separated values.
					$values = explode( ',', $value );
					$values = array_map( 'intval', $values );
					if ( $is_exclude ) {
						$where_clauses[] = "( $qualified_name != " . implode( " AND $qualified_name != ", $values ) . ')';
					} else {
						$where_clauses[] = "( $qualified_name= " . implode( " OR $qualified_name = ", $values ) . ')';
					}
				} elseif ( $filter === 'parameter' ) {
					$include_value = str_contains( $value, '=' );
					$value         = esc_sql( sanitize_text_field( $value ) );
					if ( $include_value ) {
						// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $eq_operator is defined in this function and not from user input.
						$where_clauses[] = $wpdb->prepare( "CONCAT(params.parameter, '=', params.value) $eq_operator %s", "$value" );
					} elseif ( $is_exclude ) {
							$where_clauses[] = $wpdb->prepare( ' (params.parameter != %s AND params.value != %s) ', "$value", "$value" );
					} else {
						$where_clauses[] = $wpdb->prepare( ' (params.parameter = %s OR params.value = %s) ', "$value", "$value" );
					}
				} else {
					$value = esc_sql( sanitize_text_field( $value ) );
					if ( $filter === 'referrer' ) {
						if ( $is_exclude ) {
							$where_clauses[] = $wpdb->prepare(
								// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $qualified_name is from a trusted array.
								"( $qualified_name $like_keyword %s OR $qualified_name IS NULL )",
								'%' . $wpdb->esc_like( $value ) . '%'
							);
						} else {
							$where_clauses[] = $wpdb->prepare(
								// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $qualified_name is from a trusted array.
								"( $qualified_name $like_keyword %s )",
								'%' . $wpdb->esc_like( $value ) . '%'
							);
						}
					} else {
                        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $qualified_name is a from a trusted array.
						$where_clauses[] = $wpdb->prepare( "$qualified_name $eq_operator %s", $value );
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
		$non_bounce      = 'COALESCE(sessions.bounce, 0) = 0';
		global $wpdb;
		// if metric starts with  'count(' and ends with ')', then it's a custom metric.
		// so we sanitize it and return it.
		if ( substr( $metric, 0, 6 ) === 'count(' && substr( $metric, - 1 ) === ')' ) {
			// delete the 'count(' and ')' from the metric.
			// sanitize and wrap it in count().
			$metric = $query_data->sanitize_metric( substr( $metric, 6, - 1 ) );
			return 'count(' . $metric . ')';
		}
		// using COALESCE to prevent NULL values in the output, in the today.
		switch ( $metric ) {
			case 'referrer':
				$sql = 'sessions.referrer';
				break;
			case 'pageviews':
			case 'count':
				$sql = $exclude_bounces
				? "COALESCE( SUM( CASE WHEN {$non_bounce} THEN 1 ELSE 0 END ), 0)"
				: 'COUNT( statistics.ID )';
				break;
			case 'bounces':
				$sql = 'COUNT(DISTINCT CASE WHEN sessions.bounce = 1 THEN sessions.ID END) ';
				break;
			case 'bounce_rate':
				$sql = 'ROUND(COUNT(DISTINCT CASE WHEN sessions.bounce = 1 THEN sessions.ID END) / COUNT(DISTINCT sessions.ID) * 100, 2) ';
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
					? "COALESCE( COUNT(DISTINCT CASE WHEN {$non_bounce} AND sessions.first_time_visit = 1 THEN statistics.uid END), 0)"
					: 'COUNT(DISTINCT CASE WHEN sessions.first_time_visit = 1 THEN statistics.uid END)';
				break;
			case 'visitors':
				$sql = $exclude_bounces
					? "COUNT(DISTINCT CASE WHEN {$non_bounce} THEN statistics.uid END)"
					: 'COUNT(DISTINCT statistics.uid)';
				break;
			case 'page_url':
				$sql = 'statistics.page_url';
				break;
			case 'host':
				$sql = 'sessions.host';
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
			case 'first_time_visit':
				$sql = 'sessions.' . $metric;
				break;
			case 'device_resolution_id':
			case 'session_id':
			case 'time':
			case 'time_on_page':
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
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $item is from a trusted array.
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
        `page_id` int(11) NOT NULL,
        `page_type` varchar(191) NOT NULL,
        `time` int NOT NULL,
        `uid` varchar(64) NOT NULL,
        `time_on_page` int,
        `parameters` TEXT NOT NULL,
        `fragment` varchar(255) NOT NULL,
        `session_id` int,
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
			'burst_goals'            => "CREATE TABLE {$wpdb->prefix}burst_goals (
        `ID` int NOT NULL AUTO_INCREMENT,
        `title` varchar(255) NOT NULL,
        `type` varchar(30) NOT NULL,
        `status` varchar(30) NOT NULL,
        `url` varchar(255) NOT NULL,
        `conversion_metric` varchar(255) NOT NULL,
        `date_created` int NOT NULL,
        `server_side` int NOT NULL,
        `date_start` int NOT NULL,
        `date_end` int NOT NULL,
        `selector` varchar(255) NOT NULL,
        `hook` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;",
			'burst_known_uids'       => "CREATE TABLE {$wpdb->prefix}burst_known_uids (
            `uid` varchar(64) NOT NULL,
        `first_seen` INT UNSIGNED NOT NULL,
        `last_seen` INT UNSIGNED NOT NULL,
        PRIMARY KEY (uid)
    ) $charset_collate;",
			'burst_query_stats'      => "CREATE TABLE {$wpdb->prefix}burst_query_stats (
        `ID` int NOT NULL AUTO_INCREMENT,
        `sql_hash` varchar(16) NOT NULL,
        `sql_query` text NOT NULL,
        `avg_execution_time` float NOT NULL,
        `max_execution_time` float NOT NULL,
        `min_execution_time` float NOT NULL,
        `last_updated` int NOT NULL,
        `execution_count` int NOT NULL,
        `date_range_days` int NOT NULL DEFAULT 0,
        PRIMARY KEY (ID),
        UNIQUE KEY sql_hash (sql_hash)
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
			[ 'avg_execution_time' ],
			[ 'last_updated' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_query_stats', $index );
		}

		$indexes = [
			[ 'time' ],
			[ 'page_url' ],
			[ 'session_id' ],
			[ 'time', 'page_url' ],
			[ 'time', 'uid' ],
			[ 'time', 'session_id' ],
			[ 'uid', 'time' ],
			[ 'page_id', 'page_type' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_statistics', $index );
		}

		$indexes = [
			[ 'last_seen' ],
			[ 'uid', 'first_seen' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_known_uids', $index );
		}

		$indexes = [
			[ 'status' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_goals', $index );
		}
	}

	/**
	 * Check if the query is for parameter conversions or parameter sales/revenue.
	 */
	public function is_parameter_conversion_query( Query_Data $data ): bool {
		// Check if the select contains conversion or sales-related fields.
		$goal_or_conversion = in_array( 'conversions', $data->select, true ) || isset( $data->filters['goal_id'] );
		$sales_or_revenue   = in_array( 'sales', $data->select, true ) || in_array( 'revenue', $data->select, true );
		if ( ( $goal_or_conversion || $sales_or_revenue ) && in_array( 'parameter', $data->select, true ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Check if the query is for campaign conversions or campaign sales/revenue.
	 */
	public function is_campaign_conversion_query( Query_Data $data ): bool {
		// Check if the select contains campaign related fields.
		$goal_or_conversion = in_array( 'conversion_rate', $data->select, true ) || in_array( 'conversions', $data->select, true ) || isset( $data->filters['goal_id'] );
		// Also check for sales/revenue metrics which should be attributed to campaigns.
		$sales_or_revenue = in_array( 'sales', $data->select, true ) || in_array( 'revenue', $data->select, true );
		if ( ( $goal_or_conversion || $sales_or_revenue ) && ! empty( array_intersect( $this->campaign_parameters, $data->select ) ) ) {
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
	 * Wrapper function for get_var()
	 *
	 * @param Query_Data $qd The sanitized query data.
	 * @return int|float|null The resulting variable.
	 */
	public function get_var( Query_Data $qd ): null|int|float {
		global $wpdb;
		$sql                    = $this->build_raw_sql( $qd );
		$timeout_ms             = $this->get_query_timeout_ms( $qd );
		$timed_sql              = $this->add_query_timeout_hint( $sql, $timeout_ms );
		$start_time             = microtime( true );
		$stress_test_iterations = $this->get_stress_test_query_iterations();

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
		if ( $stress_test_iterations > 0 ) {
			$result = null;
			for ( $i = 0; $i < $stress_test_iterations; $i++ ) {
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
				$result = $wpdb->get_var( $timed_sql );
			}
			// phpcs:disable WordPress.DB.PreparedSQL -- stress logging only reads SQL text and does not execute SQL.
			$this->log_stress_test_execution_time( $start_time, $timed_sql );
			$this->log_stress_test_result_signature( $result, $timed_sql, 'var' );
			// phpcs:enable WordPress.DB.PreparedSQL
		} else {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
			$result   = $wpdb->get_var( $timed_sql );
			$end_time = microtime( true );
			$this->store_query_execution_time( $sql, $start_time, $end_time, $qd );
		}

		if ( $this->is_timeout_error( $wpdb->last_error ) ) {
			self::error_log( 'Burst query timed out in get_var for query id ' . $qd->get_id() );
			return null;
		}

		return $result;
	}

	/**
	 * Resolve stress-test iterations from a runtime constant.
	 */
	private function get_stress_test_query_iterations(): int {
		if ( ! defined( 'BURST_STRESS_TEST_QUERIES' ) ) {
			return 0;
		}

		return max( 0, (int) constant( 'BURST_STRESS_TEST_QUERIES' ) );
	}

	/**
	 * Log total query execution time during stress-test mode.
	 */
	private function log_stress_test_execution_time( float $start_time, string $sql ): void {
		$query_time = microtime( true ) - $start_time;
		self::error_log( 'Query execution time: ' . $query_time . ' ' . $sql );
	}

	/**
	 * Log a deterministic signature of the stress-test query output for baseline comparisons.
	 */
	private function log_stress_test_result_signature( mixed $result, string $sql, string $result_type ): void {
		$normalized_sql = preg_replace( '/\s+/', ' ', trim( $sql ) );
		$sql_hash       = substr( hash( 'sha256', (string) $normalized_sql ), 0, 16 );
		$normalized     = $this->normalize_stress_result_for_hash( $result );
		$json_payload   = wp_json_encode( $normalized );
		$result_hash    = hash( 'sha256', (string) $json_payload );
		$result_count   = $this->count_stress_result_items( $result );

		self::error_log(
			sprintf(
				'Query result signature: sql_hash=%s result_hash=%s count=%d type=%s',
				$sql_hash,
				$result_hash,
				$result_count,
				$result_type
			)
		);
	}

	/**
	 * Normalize result data for deterministic hashing.
	 */
	private function normalize_stress_result_for_hash( mixed $value ): mixed {
		if ( is_object( $value ) ) {
			$value = get_object_vars( $value );
		}

		if ( is_array( $value ) ) {
			if ( $this->is_assoc_array( $value ) ) {
				ksort( $value );
			}

			foreach ( $value as $key => $item ) {
				$value[ $key ] = $this->normalize_stress_result_for_hash( $item );
			}
		}

		return $value;
	}

	/**
	 * Determine if an array has string keys.
	 */
	private function is_assoc_array( array $value ): bool {
		return array_keys( $value ) !== range( 0, count( $value ) - 1 );
	}

	/**
	 * Count top-level result items for stress output logging.
	 */
	private function count_stress_result_items( mixed $result ): int {
		if ( is_array( $result ) ) {
			return count( $result );
		}

		if ( null === $result ) {
			return 0;
		}

		return 1;
	}

	/**
	 * Store query execution time for slow query analysis.
	 *
	 * @param string     $sql The executed SQL query.
	 * @param float      $start The start time in seconds.
	 * @param float      $end The end time in seconds.
	 * @param Query_Data $query_data Query metadata used for deterministic hashing.
	 */
	private function store_query_execution_time( string $sql, float $start, float $end, Query_Data $query_data ): void {
		global $wpdb;

		// Stress tests intentionally execute the same query repeatedly.
		// Skip query_stats writes to prevent lock contention noise during benchmark runs.
		if ( $this->get_stress_test_query_iterations() > 0 ) {
			return;
		}

		$execution_time = $end - $start;
		$date_start     = $query_data->date_start;
		$date_end       = $query_data->date_end;
		$sql_hash       = $query_data->get_fingerprint_hash();

		$date_range_days = $date_start > 0 && $date_end > 0
			? (int) ceil( ( $date_end - $date_start ) / DAY_IN_SECONDS )
			: 0;

		// only store queries for date ranges below one year.
		if ( $date_range_days > 365 ) {
			return;
		}

		// Check if query exists and was updated recently.
		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}burst_query_stats WHERE sql_hash = %s",
				$sql_hash
			)
		);

		if ( $existing ) {
			// Only update if last update was more than 7 days ago.
			$time_since_last_update = time() - $existing->last_updated;
			if ( $time_since_last_update < WEEK_IN_SECONDS ) {
				return;
			}

			$updated = $this->run_query_stats_write(
				static function () use ( $wpdb, $existing, $execution_time, $date_range_days, $sql_hash ) {
					return $wpdb->update(
						$wpdb->prefix . 'burst_query_stats',
						[
							'avg_execution_time' => ( $existing->avg_execution_time * $existing->execution_count + $execution_time ) / ( $existing->execution_count + 1 ),
							'max_execution_time' => max( $existing->max_execution_time, $execution_time ),
							'min_execution_time' => min( $existing->min_execution_time, $execution_time ),
							'execution_count'    => $existing->execution_count + 1,
							'last_updated'       => time(),
							'date_range_days'    => $date_range_days,
						],
						[ 'sql_hash' => $sql_hash ],
						[ '%f', '%f', '%f', '%d', '%s', '%d' ],
						[ '%s' ]
					);
				}
			);

			if ( ! $updated ) {
				return;
			}
		} else {
			// INSERT IGNORE prevents a duplicate entry error on concurrent requests.
			$inserted = $this->run_query_stats_write(
				static function () use ( $wpdb, $sql_hash, $sql, $execution_time, $date_range_days ) {
					return $wpdb->query(
						$wpdb->prepare(
							"INSERT IGNORE INTO {$wpdb->prefix}burst_query_stats
                (sql_hash, sql_query, avg_execution_time, max_execution_time, min_execution_time, execution_count, last_updated, date_range_days)
                VALUES (%s, %s, %f, %f, %f, %d, %d, %d)",
							$sql_hash,
							$sql,
							$execution_time,
							$execution_time,
							$execution_time,
							1,
							time(),
							$date_range_days
						)
					);
				}
			);

			if ( ! $inserted ) {
				return;
			}
		}

		// Prune to keep only the 100 slowest queries.
		$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_query_stats" );
		if ( $count > 100 ) {
			$this->run_query_stats_write(
				static function () use ( $wpdb ) {
					return $wpdb->query(
						"DELETE FROM {$wpdb->prefix}burst_query_stats
				WHERE ID NOT IN (
					SELECT ID FROM (
						SELECT ID FROM {$wpdb->prefix}burst_query_stats
						ORDER BY avg_execution_time DESC
						LIMIT 100
					) AS top
				)"
					);
				}
			);
		}
	}

	/**
	 * Execute query_stats write operations with deadlock retries and suppressed DB-error output.
	 */
	private function run_query_stats_write( callable $write_operation ): bool {
		global $wpdb;

		$max_attempts = 3;

		for ( $attempt = 1; $attempt <= $max_attempts; $attempt++ ) {
			$previous_suppress = $wpdb->suppress_errors( true );
			$wpdb->last_error  = '';
			$operation_result  = $write_operation();
			$error_message     = $this->get_wpdb_last_error_message();
			$wpdb->suppress_errors( $previous_suppress );

			if ( false !== $operation_result && '' === $error_message ) {
				return true;
			}

			if ( '' === $error_message ) {
				self::error_log( 'Query stats write failed without a database error message.' );
				return false;
			}

			if ( ! $this->is_deadlock_db_error( $error_message ) ) {
				self::error_log( 'Query stats write failed: ' . $error_message );
				return false;
			}

			if ( $attempt < $max_attempts ) {
				usleep( $attempt * 50000 );
			}
		}

		self::error_log( 'Skipping query_stats write after repeated deadlock retries.' );
		return false;
	}

	/**
	 * Retrieve the current wpdb error string.
	 */
	private function get_wpdb_last_error_message(): string {
		global $wpdb;

		return is_string( $wpdb->last_error ) ? $wpdb->last_error : '';
	}

	/**
	 * Detect MySQL deadlock error messages.
	 */
	private function is_deadlock_db_error( string $error_message ): bool {
		return strpos( strtolower( $error_message ), 'deadlock found when trying to get lock' ) !== false;
	}

	/**
	 * Wrapper function for get_row()
	 *
	 * @param Query_Data $qd The sanitized query data.
	 * @param string     $output_type The output type: OBJECT, ARRAY_A, ARRAY_N.
	 * @return array|object|null The resulting row.
	 */
	public function get_row( Query_Data $qd, string $output_type = 'OBJECT' ): null|array|object {
		global $wpdb;
		$sql                    = $this->build_raw_sql( $qd );
		$timeout_ms             = $this->get_query_timeout_ms( $qd );
		$timed_sql              = $this->add_query_timeout_hint( $sql, $timeout_ms );
		$cache_ttl              = $this->get_query_cache_ttl( $qd );
		$stress_test_iterations = $this->get_stress_test_query_iterations();
		$cache_group            = 'burst_stats_query_results';
		$cache_key              = '';
		$lock                   = null;

		if ( $cache_ttl > 0 && 0 === $stress_test_iterations ) {
			$cache_key = $this->get_query_cache_key( $timed_sql, $output_type, true );
			if ( $this->is_query_timeout_cached( $cache_key, $cache_group ) ) {
				return null;
			}

			$cached = wp_cache_get( $cache_key, $cache_group );
			if ( false !== $cached ) {
				return $cached;
			}

			if ( $this->is_query_single_flight_enabled( $qd ) ) {
				$lock = $this->acquire_query_single_flight_lock( $cache_key, $qd, $timeout_ms );
				if ( ! $lock['acquired'] ) {
					$cached_after_wait = $this->wait_for_query_cache_fill( $cache_key, $cache_group, $this->get_query_single_flight_wait_ms( $qd ) );
					if ( false !== $cached_after_wait ) {
						return $cached_after_wait;
					}

					// A leader query is already running and no cached value is ready yet.
					// Return fast to prevent duplicate heavy query fan-out.
					return null;
				}
			}
		}

		try {
			$start_time = microtime( true );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
			if ( $stress_test_iterations > 0 ) {
				$result = null;
				for ( $i = 0; $i < $stress_test_iterations; $i++ ) {
					// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
					$result = $wpdb->get_row( $timed_sql, $output_type );
				}
				// phpcs:disable WordPress.DB.PreparedSQL -- stress logging only reads SQL text and does not execute SQL.
				$this->log_stress_test_execution_time( $start_time, $timed_sql );
				$this->log_stress_test_result_signature( $result, $timed_sql, 'row' );
				// phpcs:enable WordPress.DB.PreparedSQL
			} else {
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
				$result   = $wpdb->get_row( $timed_sql, $output_type );
				$end_time = microtime( true );
				$this->store_query_execution_time( $sql, $start_time, $end_time, $qd );
			}

			if ( $this->is_timeout_error( $wpdb->last_error ) ) {
				self::error_log( 'Burst query timed out in get_row for query id ' . $qd->get_id() );
				if ( $cache_ttl > 0 && '' !== $cache_key ) {
					$this->cache_query_timeout_marker( $cache_key, $cache_group, $qd, $timeout_ms );
				}
				return null;
			}

			if ( $cache_ttl > 0 && 0 === $stress_test_iterations && '' !== $cache_key && null !== $result ) {
				wp_cache_set( $cache_key, $result, $cache_group, $cache_ttl );
			}

			return $result;
		} finally {
			if ( is_array( $lock ) && ! empty( $lock['acquired'] ) ) {
				$this->release_query_single_flight_lock( $lock );
			}
		}
	}

	/**
	 * Wrapper function for get_results()
	 *
	 * @param Query_Data $qd The sanitized query data.
	 * @param string     $output_type The output type: OBJECT, ARRAY_A, ARRAY_N.
	 * @return array|object The results.
	 */
	public function get_results( Query_Data $qd, string $output_type = 'OBJECT' ): array|object {
		global $wpdb;
		$sql                    = $this->build_raw_sql( $qd );
		$timeout_ms             = $this->get_query_timeout_ms( $qd );
		$timed_sql              = $this->add_query_timeout_hint( $sql, $timeout_ms );
		$cache_ttl              = $this->get_query_cache_ttl( $qd );
		$stress_test_iterations = $this->get_stress_test_query_iterations();
		$cache_group            = 'burst_stats_query_results';
		$cache_key              = '';
		$lock                   = null;

		if ( $cache_ttl > 0 && 0 === $stress_test_iterations ) {
			$cache_key = $this->get_query_cache_key( $timed_sql, $output_type, false );
			if ( $this->is_query_timeout_cached( $cache_key, $cache_group ) ) {
				return [];
			}

			$cached = wp_cache_get( $cache_key, $cache_group );
			if ( false !== $cached ) {
				return $cached;
			}

			if ( $this->is_query_single_flight_enabled( $qd ) ) {
				$lock = $this->acquire_query_single_flight_lock( $cache_key, $qd, $timeout_ms );
				if ( ! $lock['acquired'] ) {
					$cached_after_wait = $this->wait_for_query_cache_fill( $cache_key, $cache_group, $this->get_query_single_flight_wait_ms( $qd ) );
					if ( false !== $cached_after_wait ) {
						return $cached_after_wait;
					}

					// A leader query is already running and no cached value is ready yet.
					// Return fast to prevent duplicate heavy query fan-out.
					return [];
				}
			}
		}

		try {
			$start_time = microtime( true );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
			if ( $stress_test_iterations > 0 ) {
				$result = [];
				for ( $i = 0; $i < $stress_test_iterations; $i++ ) {
					// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
					$result = $wpdb->get_results( $timed_sql, $output_type );
				}
				// phpcs:disable WordPress.DB.PreparedSQL -- stress logging only reads SQL text and does not execute SQL.
				$this->log_stress_test_execution_time( $start_time, $timed_sql );
				$this->log_stress_test_result_signature( $result, $timed_sql, 'results' );
				// phpcs:enable WordPress.DB.PreparedSQL
			} else {
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $timed_sql is built and sanitized in Query_Data and only prepends a timeout hint.
				$result   = $wpdb->get_results( $timed_sql, $output_type );
				$end_time = microtime( true );
				$this->store_query_execution_time( $sql, $start_time, $end_time, $qd );
			}

			if ( $this->is_timeout_error( $wpdb->last_error ) ) {
				self::error_log( 'Burst query timed out in get_results for query id ' . $qd->get_id() );
				if ( $cache_ttl > 0 && '' !== $cache_key ) {
					$this->cache_query_timeout_marker( $cache_key, $cache_group, $qd, $timeout_ms );
				}
				return [];
			}

			if ( $cache_ttl > 0 && 0 === $stress_test_iterations && '' !== $cache_key && ! empty( $result ) ) {
				wp_cache_set( $cache_key, $result, $cache_group, $cache_ttl );
			}

			return $result;
		} finally {
			if ( is_array( $lock ) && ! empty( $lock['acquired'] ) ) {
				$this->release_query_single_flight_lock( $lock );
			}
		}
	}

	/**
	 * Only enable query single-flight when a shared external object cache is active.
	 */
	private function is_query_single_flight_enabled( Query_Data $qd ): bool {
		$enabled = function_exists( 'wp_using_ext_object_cache' )
			&& wp_using_ext_object_cache();

		return (bool) apply_filters( 'burst_query_single_flight_enabled', $enabled, $qd );
	}

	/**
	 * Get the maximum follower wait time in milliseconds.
	 */
	private function get_query_single_flight_wait_ms( Query_Data $qd ): int {
		$default_wait_ms = 1200;
		$wait_ms         = (int) apply_filters( 'burst_query_single_flight_wait_ms', $default_wait_ms, $qd );

		return max( 0, $wait_ms );
	}

	/**
	 * Get lock TTL in seconds. The lock lifetime tracks query timeout with a small buffer.
	 */
	private function get_query_single_flight_lock_ttl( Query_Data $qd, int $timeout_ms ): int {
		$derived_ttl  = (int) ceil( $timeout_ms / 1000 ) + 2;
		$default_ttl  = max( 5, $derived_ttl );
		$lock_ttl_sec = (int) apply_filters( 'burst_query_single_flight_lock_ttl', $default_ttl, $qd, $timeout_ms );

		return max( 1, $lock_ttl_sec );
	}

	/**
	 * Try to become the leader request for a query cache key.
	 */
	private function acquire_query_single_flight_lock( string $cache_key, Query_Data $qd, int $timeout_ms ): array {
		$lock_group = 'burst_stats_query_locks';
		$lock_key   = 'lock_' . $cache_key;
		$owner      = function_exists( 'wp_generate_uuid4' )
			? wp_generate_uuid4()
			: uniqid( 'burst_lock_', true );
		$lock_ttl   = $this->get_query_single_flight_lock_ttl( $qd, $timeout_ms );
		$acquired   = wp_cache_add( $lock_key, $owner, $lock_group, $lock_ttl );

		return [
			'acquired'   => (bool) $acquired,
			'owner'      => $owner,
			'lock_key'   => $lock_key,
			'lock_group' => $lock_group,
		];
	}

	/**
	 * Release single-flight lock if this request still owns it.
	 */
	private function release_query_single_flight_lock( array $lock ): void {
		if ( empty( $lock['owner'] ) || empty( $lock['lock_key'] ) || empty( $lock['lock_group'] ) ) {
			return;
		}

		$current_owner = wp_cache_get( $lock['lock_key'], $lock['lock_group'] );
		if ( $current_owner === $lock['owner'] ) {
			wp_cache_delete( $lock['lock_key'], $lock['lock_group'] );
		}
	}

	/**
	 * Follower requests briefly poll cache for a leader-written result.
	 */
	private function wait_for_query_cache_fill( string $cache_key, string $cache_group, int $wait_ms ): mixed {
		if ( $wait_ms <= 0 ) {
			return false;
		}

		$started_at   = microtime( true );
		$sleep_us     = 50000;
		$max_sleep_us = 200000;

		while ( ( microtime( true ) - $started_at ) * 1000 < $wait_ms ) {
			usleep( $sleep_us );

			$cached = wp_cache_get( $cache_key, $cache_group );
			if ( false !== $cached ) {
				return $cached;
			}

			$sleep_us = min( $max_sleep_us, (int) ( $sleep_us * 1.5 ) );
		}

		return false;
	}

	/**
	 * Get per-query timeout in milliseconds.
	 *
	 * Background cron queries (aggregation, backfill) use longer timeout (900s = 15 minutes).
	 * Real-time dashboard queries use timeout (30s) for balance between responsiveness and reliability.
	 *
	 * Filters:
	 * - 'burst_query_timeout_ms_background': Override background timeout (ms)
	 * - 'burst_query_timeout_ms': Override real-time timeout (ms)
	 */
	public function get_query_timeout_ms( Query_Data $qd ): int {
		return $this->resolve_query_timeout_ms(
			'burst_query_timeout_ms',
			'burst_query_timeout_ms_background',
			$qd,
			30000,
			900000,
			0,
			true
		);
	}

	/**
	 * Get cache TTL in seconds for query result caching.
	 */
	private function get_query_cache_ttl( Query_Data $qd ): int {
		$default_ttl = 30;

		if ( $this->is_expensive_aggregation_window( $qd ) ) {
			$default_ttl = 300;
		}

		$option_ttl = (int) get_option( 'burst_query_results_cache_ttl', -1 );
		if ( $option_ttl >= 0 ) {
			$default_ttl = $option_ttl;
		}

		$ttl = (int) apply_filters( 'burst_query_results_cache_ttl', $default_ttl, $qd );

		return max( 0, $ttl );
	}

	/**
	 * Build a deterministic cache key from SQL and output type.
	 */
	private function get_query_cache_key( string $sql, string $output_type, bool $single_row ): string {
		$hash = hash( 'sha256', $sql . '|' . $output_type . '|' . ( $single_row ? 'row' : 'results' ) );

		return 'burst_query_' . $hash;
	}

	/**
	 * Cache a short-lived timeout marker to prevent immediate repeated retries.
	 */
	private function cache_query_timeout_marker( string $cache_key, string $cache_group, Query_Data $qd, int $timeout_ms ): void {
		$timeout_cache_ttl = $this->get_query_timeout_cooldown_ttl( $qd, $timeout_ms );
		if ( $timeout_cache_ttl <= 0 ) {
			return;
		}

		wp_cache_set( $cache_key . ':timeout', 1, $cache_group, $timeout_cache_ttl );
	}

	/**
	 * Check if this query recently timed out and is in cooldown.
	 */
	private function is_query_timeout_cached( string $cache_key, string $cache_group ): bool {
		return false !== wp_cache_get( $cache_key . ':timeout', $cache_group );
	}

	/**
	 * Cooldown TTL (seconds) after timeout before allowing retries.
	 */
	private function get_query_timeout_cooldown_ttl( Query_Data $qd, int $timeout_ms ): int {
		$derived_default = max( 30, (int) ceil( $timeout_ms / 1000 ) );
		$cooldown_ttl    = (int) apply_filters( 'burst_query_timeout_cooldown_ttl', $derived_default, $qd, $timeout_ms );

		return max( 0, $cooldown_ttl );
	}

	/**
	 * Detect if a query range is expensive enough for a longer cache default.
	 */
	private function is_expensive_aggregation_window( Query_Data $qd ): bool {
		if ( $qd->date_start <= 0 || $qd->date_end <= 0 || $qd->date_end <= $qd->date_start ) {
			return false;
		}

		$date_range_days = (int) ceil( ( $qd->date_end - $qd->date_start ) / DAY_IN_SECONDS );

		return $date_range_days > 30;
	}

	/**
	 * Detect if the database reported a timeout/interruption for the last query.
	 */
	private function is_timeout_error( string $last_error ): bool {
		if ( '' === $last_error ) {
			return false;
		}

		$normalized_error = strtolower( $last_error );

		return str_contains( $normalized_error, 'max_execution_time' )
			|| str_contains( $normalized_error, 'maximum statement execution time exceeded' )
			|| str_contains( $normalized_error, 'query execution was interrupted' )
			|| str_contains( $normalized_error, 'error 3024' )
			|| str_contains( $normalized_error, 'error 1317' );
	}

	/**
	 * Recommend persistent object cache when slow analytics queries are detected.
	 */
	public static function should_recommend_object_cache(): bool {
		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			return false;
		}

		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_query_stats';

		$exists = $wpdb->get_var(
			$wpdb->prepare(
				'SHOW TABLES LIKE %s',
				$table_name
			)
		);

		if ( ! $exists ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is built from trusted prefix.
		$slowest_query = (float) $wpdb->get_var( "SELECT MAX(max_execution_time) FROM {$table_name}" );
		$threshold     = (float) apply_filters( 'burst_object_cache_recommendation_threshold_seconds', 10.0 );

		return $slowest_query >= max( 0.1, $threshold );
	}

	/**
	 * Build raw SQL query with enhanced features.
	 */
	public function build_raw_sql( Query_Data $data ): string {
		global $wpdb;

		// Escape inputs for SQL.
		$data->select   = esc_sql( $data->select );
		$data->group_by = esc_sql( $data->group_by );
		$data->order_by = esc_sql( $data->order_by );

		// Build SELECT clause first to get the actual SQL field references.
		$select = $this->build_select_clause( $data );

		// Build JOIN clauses early — detect_needed_statistics_columns() needs
		// to see the JOIN ON references (e.g. statistics.session_id) so the
		// subquery projects every column the outer query touches.
		$join_sql = $this->build_join_clauses( $data, $select );

		// Build FROM clause.
		$table_name = $wpdb->prefix . 'burst_statistics AS statistics';

		// if we use joins, use a pre-filtered subquery to improve performance.
		if ( ! empty( $data->joins ) ) {
			$columns    = implode( ', ', $this->detect_needed_statistics_columns( $data, $select, $join_sql ) );
			$table_name = " (
                SELECT {$columns}
                FROM {$wpdb->prefix}burst_statistics
                WHERE time BETWEEN {$data->date_start} AND {$data->date_end}
            ) AS statistics ";
		}

		$where    = $this->build_where_clause( $data );
		$group_by = $this->build_group_by_clause( $data );
		$having   = $this->build_having_clause( $data->having );

		$order_by = '';
		if ( ! empty( $data->order_by ) ) {
			$order_by = sprintf( 'ORDER BY %s', implode( ',', $data->order_by ) );
		}

		$limit_sql = '';
		if ( $data->limit > 0 ) {
			$limit_sql = sprintf( 'LIMIT %d', $data->limit );
		}

		if ( $this->is_parameter_conversion_query( $data ) ) {
			$table_name = " (
                SELECT
                    p.parameter,
                    p.value,
                    s.uid,
                    MIN(s.time) AS first_visit_time
                FROM {$wpdb->prefix}burst_parameters AS p
                JOIN {$wpdb->prefix}burst_statistics AS s ON s.ID = p.statistic_id
                WHERE s.time BETWEEN {$data->date_start} AND {$data->date_end}
                AND s.parameters IS NOT NULL AND s.parameters != ''
                GROUP BY p.parameter, p.value, s.uid
            ) AS params ";
		} elseif ( in_array( 'parameter', $data->select, true ) ) {
			// make a faster parameters query by filtering out statistics without parameters first.
			$columns = $this->detect_needed_statistics_columns( $data, $select, $join_sql );
			if ( ! in_array( 'parameters', $columns, true ) ) {
				$columns[] = 'parameters';
			}
			$columns_sql = implode( ', ', $columns );
			$table_name  = " (
                SELECT {$columns_sql}
                FROM {$wpdb->prefix}burst_statistics
                WHERE time BETWEEN {$data->date_start} AND {$data->date_end}
                    AND parameters IS NOT NULL
                    AND parameters != ''
            ) AS statistics";
		}

		// Pre-filter referrers if referrer is in select.
		if ( in_array( 'referrer', $data->select, true ) ) {
			$empty_referrers_sql = empty( $data->custom_select ) ? "AND sess.referrer != '' AND sess.referrer IS NOT NULL " : '';
			$columns             = $this->detect_needed_statistics_columns( $data, $select, $join_sql );
			$prefixed_columns    = array_map( static fn( string $col ): string => 's.' . $col, $columns );
			$prefixed_columns[]  = 'sess.referrer';
			$columns_sql         = implode( ', ', $prefixed_columns );
			$table_name          = " (
                            SELECT {$columns_sql}
                            FROM {$wpdb->prefix}burst_statistics AS s
                            JOIN {$wpdb->prefix}burst_sessions AS sess ON s.session_id = sess.ID
                            WHERE s.time BETWEEN {$data->date_start} AND {$data->date_end}
                                $empty_referrers_sql
                        ) AS statistics ";
		}

		if ( $this->is_campaign_conversion_query( $data ) ) {
			// Get campaign parameters from select args.
			$parameters = [];
			foreach ( $data->select as $value ) {
				if ( $this->is_campaign_parameter( $value ) ) {
					$parameters[] = 'ca.' . esc_sql( $value );
				}
			}

			// Also include campaign parameters used as filters so they are available in WHERE.
			foreach ( array_keys( $data->filters ) as $filter_key ) {
				if ( $this->is_campaign_parameter( $filter_key ) && ! in_array( 'ca.' . $filter_key, $parameters, true ) ) {
					$parameters[] = 'ca.' . esc_sql( $filter_key );
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
              WHERE s.time BETWEEN {$data->date_start} AND {$data->date_end}
              GROUP BY $parameter_sql s.uid
            ) AS campaigns ";
		}

		// Assemble main query.
		$sql = "SELECT {$select} FROM {$table_name} {$join_sql} WHERE statistics.time BETWEEN {$data->date_start} AND {$data->date_end} {$where} {$group_by} {$having} {$order_by} {$limit_sql}";

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

		$select   = $data->select;
		$distinct = $data->distinct ? 'DISTINCT ' : '';

		// Handle date modifiers for period grouping.
		$period_select = '';
		if ( ! empty( $data->date_modifiers ) ) {
			$timezone_offset = $this->get_mysql_timezone_offset();
			$period_select   = "DATE_FORMAT(FROM_UNIXTIME( time + {$timezone_offset} ), '{$data->date_modifiers['sql_date_format']}') as period, ";
		}

		// Build metrics select.
		$metrics_select = $this->get_sql_select_for_metrics( $select, $data );

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
				// prepend each group_by with 'campaigns_subquery.' to match the campaigns subquery.
				$data->group_by = array_map(
					function ( $item ) {
						return 'campaigns.' . esc_sql( $item );
					},
					$data->group_by
				);
			}

			// we need to group parameters by parameter AND value.
			if ( in_array( 'parameter', $data->group_by, true ) ) {
				foreach ( $data->group_by as $key => $group_by_item ) {
					if ( trim( $group_by_item ) === 'parameter' ) {
						$data->group_by[ $key ] = 'params.parameter, params.value';
					}
				}
			}

			if ( empty( $data->group_by ) ) {
				return '';
			}

			return sprintf( 'GROUP BY %s', implode( ', ', $data->group_by ) );
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

		// If we're filtering by goal_id, we need to add it to the join clause. We don't filter in the where clause.
		if ( isset( $data->filters['goal_id'] ) ) {
			$is_exclude_goal = ( $data->filter_exclusions['goal_id'] ?? 'include' ) === 'exclude';
			$goal_operator   = $is_exclude_goal ? '!=' : '=';
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $goal_operator is from a trusted ternary.
			$goal_sql = $wpdb->prepare( " AND goals.goal_id $goal_operator %d ", (int) $data->filters['goal_id'] );
		}

		$available_joins = apply_filters(
			'burst_available_joins',
			[
				'sessions' => [
					'table'      => 'burst_sessions',
					'on'         => 'statistics.session_id = sessions.ID',
					'type'       => 'INNER',
					'depends_on' => [],
				],
				'goals'    => [
					'table'      => 'burst_goal_statistics',
					'on'         => 'statistics.ID = goals.statistic_id ' . $goal_sql,
					'type'       => 'LEFT',
					'depends_on' => [],
				],
			],
			$data
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

			if ( in_array( 'referrer', $data->select, true ) || isset( $data->filters['referrer'] ) ) {
				$needed_joins['sessions'] = $available_joins['sessions'];
			}

			if ( strpos( $search_string, $join_name . '.' ) !== false ) {
				$needed_joins[ $join_name ] = $join_config;
			}
		}
		return $needed_joins;
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
	 * Detect which burst_statistics columns are referenced by the outer query.
	 *
	 * Mirrors detect_needed_joins(): scans the already-built SELECT, custom
	 * SELECT, JOIN ON, WHERE, GROUP BY, ORDER BY and HAVING for `statistics.X`
	 * references and returns only those columns. ID and time are always
	 * included since the subquery needs them for joins and the time filter.
	 * The TEXT-heavy `parameters` column and `fragment` are only included when
	 * actually used, which keeps the materialized derived table much smaller.
	 *
	 * @param Query_Data $data           Query arguments.
	 * @param string     $select_clause  Already-built SELECT clause.
	 * @param string     $join_sql       Already-built JOIN SQL — its ON-clauses
	 *                                   typically reference columns like
	 *                                   `statistics.session_id` that the outer
	 *                                   SELECT never names directly.
	 * @return array<int, string> List of column names to project.
	 */
	private function detect_needed_statistics_columns( Query_Data $data, string $select_clause, string $join_sql = '' ): array {
		static $candidates = [
			'page_url',
			'page_id',
			'page_type',
			'uid',
			'time_on_page',
			'parameters',
			'fragment',
			'session_id',
		];

		// A custom_select may reference statistics columns by bare name (e.g. `page_url`
		// instead of `statistics.page_url`), which the prefix-based scan below cannot
		// detect. Projecting the full candidate set keeps those queries correct.
		if ( ! empty( $data->custom_select ) ) {
			return array_values( array_unique( array_merge( [ 'ID', 'time' ], $candidates ) ) );
		}

		$search_string = implode(
			' ',
			[
				$select_clause,
				$join_sql,
				$this->get_where_clause_for_filters( $data ),
				implode( ' ', $data->order_by ),
				implode( ' ', $data->group_by ),
				$this->build_having_clause( $data->having ),
			]
		);

		$needed = [ 'ID', 'time' ];
		foreach ( $candidates as $col ) {
			if ( strpos( $search_string, 'statistics.' . $col ) !== false ) {
				$needed[] = $col;
			}
		}

		return array_values( array_unique( $needed ) );
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
		$filters = (array) $args['filters'];

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

				$qd                = new Query_Data( 'base_data_enhanced', $enhanced_args );
				$result['current'] = $this->get_results( $qd, ARRAY_A );
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
