<?php
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die();

class Statistics_Data {
	use Helper;
	use Admin_Helper;
	use Database_Helper;
	use Sanitize;

	private array $look_up_table_names = [];

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

		$qd = Statistics_Query::create( 'live_traffic_data' )
			->date_range( $time_start_30m, $now + HOUR_IN_SECONDS )
			->with( 'sessions' )
			->select_raw( 'time+time_on_page / 1000 AS active_time, sessions.referrer AS utm_source, page_url, time, time_on_page, uid, page_id' )
			->order_by( 'active_time DESC' )
			->limit( 100 );

		$qd      = apply_filters( 'burst_live_traffic_args', $qd );
		$traffic = $qd->fetch( 'OBJECT' );
		if ( ! is_array( $traffic ) ) {
			$traffic = [];
		}
		$checkout_id = $this->burst_checkout_page_id();

		$traffic_before_10m = [];
		foreach ( $traffic as $row ) {
			if ( (float) $row->time < (float) $time_start_10m ) {
				$traffic_before_10m[ $row->uid ] = true;
			}
		}

		$traffic_in_last_10m = array_filter(
			$traffic,
			function ( $row ) use ( $time_start_10m, $exit_margin, $now, $on_page_offset ) {
				return (float) $row->time >= (float) $time_start_10m && ( (float) $row->active_time + (float) $exit_margin + (float) $on_page_offset ) >= (float) $now;
			}
		);

		$entry_marked = [];
		$exit_marked  = [];

		foreach ( array_reverse( $traffic_in_last_10m ) as $row ) {
			$row->entry    = false;
			$row->checkout = false;

			if ( ! empty( $row->page_id ) && $row->page_id !== -1 && (int) $row->page_id === $checkout_id ) {
				$row->checkout = true;
			}

			if ( ! isset( $traffic_before_10m[ $row->uid ] ) && ! isset( $entry_marked[ $row->uid ] ) ) {
				$entry_marked[ $row->uid ] = true;
				$row->entry                = true;
			}
		}

		$seen_uid_for_exit = [];

		foreach ( $traffic_in_last_10m as $row ) {
			$row->exit   = false;
			$should_exit = (float) $row->active_time + $exit_margin < (float) $now;

			if (
				$should_exit &&
				! isset( $exit_marked[ $row->uid ] ) &&
				! isset( $seen_uid_for_exit[ $row->uid ] )
			) {
				$row->exit                = true;
				$exit_marked[ $row->uid ] = true;
			}

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

		$qd         = Statistics_Query::create( 'live_visitors_data' )
			->date_range( $time_start, $now + HOUR_IN_SECONDS )
			->with( 'sessions' )
			->select_raw( 'COUNT(DISTINCT(uid))' )
			->where_raw( '( (time + time_on_page / 1000 + %d + %d) > %d)', [ $on_page_offset, $exit_margin, $now ] );
		$live_value = $qd->fetch_var();

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
	 *     live: array{value: string},
	 *     today: array{value: string},
	 *     mostViewed: array{title: string, value: string},
	 *     referrer: array{title: string, value: string},
	 *     pageviews: array{title: string, value: string},
	 *     timeOnPage: array{title: string, value: string}
	 * }
	 */
	public function get_today_data( array $args = [] ): array {
		$args = wp_parse_args(
			$args,
			[
				'date_start' => 0,
				'date_end'   => 0,
			]
		);

		$start = (int) $args['date_start'];
		$end   = (int) $args['date_end'];

		$data = [
			'live'       => [
				'value' => '0',
			],
			'today'      => [
				'value' => '0',
			],
			'mostViewed' => [
				'title' => '-',
				'value' => '0',
			],
			'referrer'   => [
				'title' => '-',
				'value' => '0',
			],
			'pageviews'  => [
				'title' => __( 'Total pageviews', 'burst-statistics' ),
				'value' => '0',
			],
			'timeOnPage' => [
				'title' => __( 'Average time on page', 'burst-statistics' ),
				'value' => '0',
			],
		];

		$qd = Statistics_Query::create( 'today_summary' )
			->date_range( $start, $end )
			->select( [ 'visitors', 'pageviews', 'avg_time_on_page' ] );

		$results = $qd->fetch_row( 'OBJECT' );
		if ( is_object( $results ) ) {
			$data['today']['value']      = max( 0, (int) $results->visitors );
			$data['pageviews']['value']  = max( 0, (int) $results->pageviews );
			$data['timeOnPage']['value'] = max( 0, (int) $results->avg_time_on_page );
		}

		foreach (
			[
				'mostViewed' => [ 'page_url', 'pageviews' ],
				'referrer'   => [ 'referrer', 'pageviews' ],
			] as $key => $fields
		) {
			$qd = Statistics_Query::create( "today_$key" )
				->date_range( $start, $end )
				->select( $fields )
				->group_by( $fields[0] )
				->order_by( 'pageviews DESC' )
				->limit( 1 );

			// Exclude direct/empty referrers so the "top referrer" is an actual referring
			// site. Without this filter the NULL/empty referrer bucket wins on pageviews and
			// surfaces as the literal string "null" in the dashboard.
			if ( $key === 'referrer' ) {
				$qd->where( 'sessions.referrer', '', '!=' )
					->where_not_null( 'sessions.referrer' );
			}

			$result = $qd->fetch_row( 'OBJECT' );
			if ( is_object( $result ) ) {
				$data[ $key ]['title'] = $result->{$fields[0]} ?? '-';
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
		$intervals = [
			'hour'  => [ '%Y-%m-%d %H', 'Y-m-d H', HOUR_IN_SECONDS ],
			'day'   => [ '%Y-%m-%d', 'Y-m-d', DAY_IN_SECONDS ],
			'week'  => [ '%x-%v', 'o-W', WEEK_IN_SECONDS ],
			'month' => [ '%Y-%m', 'Y-m', MONTH_IN_SECONDS ],
			'year'  => [ '%Y', 'Y', YEAR_IN_SECONDS ],
		];

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

		list( $sql_date_format, $php_date_format, $interval_in_seconds ) = $intervals[ $interval ];

		$nr_of_intervals = $this->get_nr_of_periods( $interval, $date_start, $date_end );

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
	 * @param array $args {
	 *     Optional. Parameters to define time range and metrics.
	 * @type int    $date_start Start of the data range (timestamp).
	 * @type int    $date_end   End of the data range (timestamp).
	 * @type string[] $metrics  List of metrics to retrieve (e.g., 'pageviews', 'visitors').
	 * @type array  $filters    Filters to apply to the query.
	 * @type string $group_by   Grouping interval ('auto'|'hour'|'day'|'week'|'month').
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

		$qd = Statistics_Query::create( 'insights_data' )
			->date_range( (int) $args['date_start'], (int) $args['date_end'] )
			->select( $args['metrics'] )
			->filters( $args['filters'] ?? [] )
			->group_by( 'period' )
			->order_by( 'period' )
			->limit( 0 )
			->set_date_modifiers(
				$this->get_insights_date_modifiers(
					(int) $args['date_start'],
					(int) $args['date_end'],
					$group_by
				)
			);

		$metric_labels  = $qd->get_allowlist()->metric_labels();
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

		$timezone_offset = self::get_wp_timezone_offset();
		$date            = $date_start + $timezone_offset;

		$timestamps = [];

		for ( $i = 0; $i < $date_modifiers['nr_of_intervals']; $i++ ) {
			$formatted_date = date_i18n( $date_modifiers['php_date_format'], $date );

			$timestamps[ $formatted_date ] = $date - $timezone_offset;

			foreach ( $metrics as $metric_key => $metric ) {
				$datasets[ $metric_key ]['data'][ $formatted_date ] = 0;
			}

			// Advance by a real calendar step so month/week/year slots align with the SQL
			// DATE_FORMAT keys; using a flat seconds constant would skip months
			// (e.g. February and December) over a 12-month range.
			$date = $this->advance_period_timestamp( $date, $date_modifiers['interval'] );
		}

		$hits = $qd->fetch( ARRAY_A );

		foreach ( $hits as $hit ) {
			$period = $hit['period'];
			foreach ( $metrics as $metric_key => $metric_name ) {
				if ( isset( $datasets[ $metric_key ]['data'][ $period ] ) && isset( $hit[ $metric_name ] ) ) {
					$datasets[ $metric_key ]['data'][ $period ] = $hit[ $metric_name ];
				}
			}
		}

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

		if ( $compare_mode !== '' && count( $metrics_list ) === 1 ) {
			$comparison = $this->get_insights_comparison_data(
				(int) $args['date_start'],
				(int) $args['date_end'],
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
	private function get_insights_comparison_data(
		int $start,
		int $end,
		string $compare_mode,
		array $metrics,
		array $filters,
		array $date_modifiers
	): array {
		if ( $compare_mode === 'year_over_year' ) {
			$compare_start = (int) strtotime( '-1 year', $start );
			$compare_end   = (int) strtotime( '-1 year', $end );
		} else {
			// Default: previous period of equal length.
			$diff          = $end - $start;
			$compare_start = $start - $diff - 1;
			$compare_end   = $end - $diff - 1;
		}

		$qd_compare = Statistics_Query::create( 'insights_data' )
			->date_range( $compare_start, $compare_end )
			->select( $metrics )
			->filters( $filters )
			->group_by( 'period' )
			->order_by( 'period' )
			->limit( 0 )
			->set_date_modifiers(
				// Re-use the same interval type so result has the same number of slots.
				$this->get_insights_date_modifiers( $compare_start, $compare_end, $date_modifiers['interval'] )
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

		// Generate exactly as many slots as the current period. The frontend aligns
		// the comparison series 1:1 by index against the main timestamps, so the
		// slot count must match even when the shifted window straddles a different
		// number of calendar weeks/months than the current period.
		$nr_of_intervals = $date_modifiers['nr_of_intervals'];
		for ( $i = 0; $i < $nr_of_intervals; $i++ ) {
			$formatted_date                     = date_i18n( $comp_date_modifiers['php_date_format'], $comp_date );
			$comp_timestamps[ $formatted_date ] = $comp_date - $timezone_offset;

			foreach ( $comp_metrics as $metric ) {
				$comp_data[ $metric ][ $formatted_date ] = 0;
			}

			$comp_date = $this->advance_period_timestamp( $comp_date, $comp_date_modifiers['interval'] );
		}

		$hits = $qd_compare->fetch( ARRAY_A );

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
	 * Advance a timestamp by one interval step.
	 *
	 * For calendar-aware intervals ('year', 'month', 'week') we use DateTimeImmutable so that
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
		$args    = wp_parse_args(
			$args,
			[
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => [],
			]
		);
		$start   = (int) $args['date_start'];
		$end     = (int) $args['date_end'];
		$filters = (array) $args['filters'];
		$prev    = $this->calculate_comparison_dates( $start, $end, $args );

		$current  = $this->get_data( [ 'visitors', 'pageviews', 'sessions', 'first_time_visitors', 'avg_time_on_page', 'bounce_rate' ], $start, $end, $filters );
		$previous = $this->get_data( [ 'pageviews', 'sessions', 'visitors', 'bounce_rate' ], $prev['start'], $prev['end'], $filters );

		return [
			'current'  => [
				'pageviews'           => (int) $current['pageviews'],
				'sessions'            => (int) $current['sessions'],
				'visitors'            => (int) $current['visitors'],
				'first_time_visitors' => (int) $current['first_time_visitors'],
				'avg_time_on_page'    => (int) $current['avg_time_on_page'],
				'bounced_sessions'    => $this->get_bounces( $start, $end, $filters ),
				'bounce_rate'         => $current['bounce_rate'],
			],
			'previous' => [
				'pageviews'        => (int) $previous['pageviews'],
				'sessions'         => (int) $previous['sessions'],
				'visitors'         => (int) $previous['visitors'],
				'bounced_sessions' => $this->get_bounces( $prev['start'], $prev['end'], $filters ),
				'bounce_rate'      => $previous['bounce_rate'],
			],
		];
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
		$args    = wp_parse_args(
			$args,
			[
				'date_start' => 0,
				'date_end'   => 0,
				'filters'    => [],
			]
		);
		$start   = (int) $args['date_start'];
		$end     = (int) $args['date_end'];
		$filters = (array) $args['filters'];
		$prev    = $this->calculate_comparison_dates( $start, $end, $args );

		$filters_without_goal = $filters;
		unset( $filters_without_goal['goal_id'] );

		$current_main  = $this->get_data( [ 'pageviews', 'visitors', 'sessions', 'first_time_visitors' ], $start, $end, $filters_without_goal );
		$previous_main = $this->get_data( [ 'pageviews', 'visitors', 'sessions' ], $prev['start'], $prev['end'], $filters_without_goal );

		$current_conversions  = $this->get_conversions( $start, $end, $filters );
		$previous_conversions = $this->get_conversions( $prev['start'], $prev['end'], $filters );

		return [
			'view'     => 'goals',
			'current'  => [
				'pageviews'           => (int) $current_main['pageviews'],
				'visitors'            => (int) $current_main['visitors'],
				'sessions'            => (int) $current_main['sessions'],
				'first_time_visitors' => (int) $current_main['first_time_visitors'],
				'conversions'         => $current_conversions,
				'conversion_rate'     => $this->calculate_conversion_rate( $current_conversions, (int) $current_main['pageviews'] ),
			],
			'previous' => [
				'pageviews'       => (int) $previous_main['pageviews'],
				'visitors'        => (int) $previous_main['visitors'],
				'sessions'        => (int) $previous_main['sessions'],
				'conversions'     => $previous_conversions,
				'conversion_rate' => $this->calculate_conversion_rate( $previous_conversions, (int) $previous_main['pageviews'] ),
			],
		];
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
		$qd     = Statistics_Query::create( 'statistics_get_data' )
			->date_range( $start, $end )
			->select( $select )
			->filters( $filters );
		$result = $qd->fetch( 'ARRAY_A' );

		return $result[0] ?? array_fill_keys( $select, 0 );
	}

	/**
	 * Get bounces for a given time period.
	 */
	private function get_bounces( int $start, int $end, array $filters ): int {
		$qd = Statistics_Query::create( 'statistics_bounces' )
			->date_range( $start, $end )
			->select( [ 'bounces' ] )
			->filters( $filters );
		return (int) $qd->fetch_var();
	}

	/**
	 * Get conversions for a given time period.
	 */
	private function get_conversions( int $start, int $end, array $filters ): int {
		$qd = Statistics_Query::create( 'statistics_conversions' )
			->date_range( $start, $end )
			->select( [ 'conversions' ] )
			->filters( $filters );

		return (int) $qd->fetch_var();
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

		$qd             = Statistics_Query::create( 'devices_title_and_value' )
			->date_range( $args['date_start'], $args['date_end'] )
			->filters( $args['filters'] )
			->select( [ 'device_id' ] )
			->select_raw( 'sessions.device_id, COUNT(sessions.device_id) AS count' )
			->where_raw( 'sessions.device_id > 0' )
			->group_by( 'device_id' );
		$devices_result = $qd->fetch( ARRAY_A );

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

		$default_data = [
			'all'     => [ 'count' => 0 ],
			'desktop' => [ 'count' => 0 ],
			'tablet'  => [ 'count' => 0 ],
			'mobile'  => [ 'count' => 0 ],
			'other'   => [ 'count' => 0 ],
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

		// Single GROUP BY across all (device, browser, platform) triples; pick the
		// highest-count row per device in PHP rather than running 4 separate queries.
		$qd   = Statistics_Query::create( 'devices_subtitle' )
			->date_range( $args['date_start'], $args['date_end'] )
			->filters( $args['filters'] )
			->select( [ 'device_id', 'browser_id', 'platform_id' ] )
			->select_raw( 'sessions.device_id, sessions.browser_id, sessions.platform_id, COUNT(*) AS count' )
			->where_raw( 'sessions.browser_id > 0 AND sessions.device_id > 0' )
			->group_by( 'device_id, browser_id, platform_id' )
			->order_by( 'count DESC' );
		$rows = $qd->fetch( ARRAY_A );

		$top_per_device = [];
		foreach ( $rows as $row ) {
			$device_name = $this->get_lookup_table_name_by_id( 'device', (int) ( $row['device_id'] ?? 0 ) );
			if ( '' === $device_name || isset( $top_per_device[ $device_name ] ) ) {
				continue;
			}
			$top_per_device[ $device_name ] = $row;
		}

		foreach ( $devices as $device ) {
			$row             = $top_per_device[ $device ] ?? [];
			$browser_id      = $row['browser_id'] ?? 0;
			$platform_id     = $row['platform_id'] ?? 0;
			$browser         = $this->get_lookup_table_name_by_id( 'browser', $browser_id );
			$platform        = $this->get_lookup_table_name_by_id( 'platform', $platform_id );
			$data[ $device ] = [
				'os'        => $platform ?: '',
				'browser'   => $browser ?: '',
				'device_id' => \Burst\burst_loader()->frontend->tracking->get_lookup_table_id( 'device', $device ),
			];
		}

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
	 */
	public function get_datatables_data( array $args = [] ): array {
		$defaults = [
			'date_start' => 0,
			'date_end'   => 0,
			'metrics'    => [ 'pageviews' ],
			'filters'    => [],
			'limit'      => '',
		];

		$args = wp_parse_args( $args, $defaults );

		$filters  = $args['filters'];
		$metrics  = $args['metrics'];
		$group_by = $args['group_by'] ?? [];
		$start    = (int) $args['date_start'];
		$end      = (int) $args['date_end'];
		$columns  = [];
		$limit    = (int) ( $args['limit'] ?? 0 );

		if ( empty( $metrics ) ) {
			$metrics = [ 'pageviews' ];
		}

		$data  = apply_filters( 'burst_datatable_pre_data', null, $args );
		$qd_id = ! empty( $args['id'] ) ? 'datatable_' . $args['id'] : 'datatables_data';
		$qd    = Statistics_Query::create( $qd_id );

		if ( null === $data ) {
			$last_metric_count = count( $metrics ) - 1;
			$order_by          = isset( $metrics[ $last_metric_count ] ) ? sprintf( '%s DESC', $metrics[ $last_metric_count ] ) : 'pageviews DESC';
			$qd                = Statistics_Query::create( $qd_id )
				->date_range( $start, $end )
				->select( $metrics )
				->filters( $filters )
				->group_by( $group_by )
				->order_by( $order_by )
				->limit( $limit );
			$data              = $qd->fetch( ARRAY_A );
		}

		$metric_labels = $qd->get_allowlist()->metric_labels();

		foreach ( $metrics as $metric ) {
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
	private function get_nr_of_periods( string $period, int $date_start, int $date_end ): int {
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
	 * Get color for a graph.
	 *
	 * @param string $metric The metric key.
	 * @param string $type   The color type (background or border).
	 * @return string RGBA color string.
	 */
	private function get_metric_color( string $metric = 'visitors', string $type = 'default' ): string {
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
	 * Calculate the ratio of value to total as a percentage or raw float.
	 *
	 * @param int    $value Numerator.
	 * @param int    $total Denominator.
	 * @param string $type  '%' for percentage, otherwise raw ratio.
	 */
	private function calculate_ratio( int $value, int $total, string $type = '%' ): float {
		$multiply = $type === '%' ? 100 : 1;
		return $total === 0 ? 0 : round( $value / $total * $multiply, 1 );
	}

	/**
	 * Calculate the conversion rate as a percentage.
	 *
	 * @param int $value Conversions count.
	 * @param int $total Total sessions/visitors.
	 */
	private function calculate_conversion_rate( int $value, int $total ): float {
		return $this->calculate_ratio( $value, $total, '%' );
	}

	/**
	 * Calculate the percentage uplift between two values.
	 *
	 * @param float $original_value Baseline value.
	 * @param float $new_value      Comparison value.
	 */
	public function calculate_uplift( float $original_value, float $new_value ): int {
		$increase = $original_value - $new_value;
		return (int) $this->calculate_ratio( (int) $increase, (int) $new_value );
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
}
