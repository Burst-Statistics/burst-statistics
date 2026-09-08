<?php
namespace Burst\Admin\Statistics;

use Burst\Admin\Statistics\Query_Shapes\Session_Grain_Shape;
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Admin\Database\Query_Executor;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'Goal_Statistics' ) ) {
	class Goal_Statistics {
		use Admin_Helper;
		use Database_Helper;
		use Helper;

		/**
		 * Constructor
		 */
		public function init(): void {
			add_action( 'burst_install_tables', [ $this, 'install_goal_statistics_table' ], 10 );
		}

		/**
		 * Get live goals data
		 */
		public function get_live_goals_count( array $args = [] ): int {
			$goal_id = $args['goal_id'] ?? 0;
			$today   = strtotime( 'today midnight' );

			if ( $goal_id === 'all' ) {
				global $wpdb;
				$active_goal_ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );
				if ( empty( $active_goal_ids ) ) {
					return 0;
				}
				$sql = $this->get_goal_completed_count_sql( $active_goal_ids, $today );
			} else {
				$sql = $this->get_goal_completed_count_sql( (int) $goal_id, $today );
			}

			$sql = $this->add_query_timeout_hint( $sql, $this->get_goal_query_timeout_ms() );
			$val = Query_Executor::create()
				->fingerprint( 'live_goals_count_' . $goal_id )
				->cache_ttl( 0 )
				->single_flight( false )
				->run( $sql, 'get_var' );
			return (int) $val ?: 0;
		}

		/**
		 * Resolve timeout for goal statistics queries.
		 */
		private function get_goal_query_timeout_ms(): int {
			return $this->resolve_query_timeout_ms(
				'burst_query_timeout_ms',
				'burst_query_timeout_ms_background',
				null,
				30000,
				900000,
				30000,
				false
			);
		}

		// phpcs:disable SlevomatCodingStandard.TypeHints.ParameterTypeHint.MissingNativeTypeHint
		/**
		 * Get the SQL query to count completed goals.
		 *
		 * @param int|array $goal_id Goal ID or array of active goal IDs.
		 * @param int       $date_start Start date (timestamp).
		 * @return string SQL query.
		 */
		private function get_goal_completed_count_sql( $goal_id, int $date_start = 0 ): string {
			global $wpdb;
			$date_end = 0;
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			// @phpstan-ignore-next-line
			$date_end_sql = $date_end > 0 ? $wpdb->prepare( 'AND statistics.time < %s', $date_end ) : '';

			if ( is_array( $goal_id ) ) {
				$goals_in     = implode( ',', array_map( 'intval', $goal_id ) );
				$count_sql    = 'COUNT(DISTINCT(statistics.uid_id))';
				$goal_sql     = "goals.goal_id IN ($goals_in)";
				$goal_url_sql = '';
			} else {
				$goal         = new Goal( (int) $goal_id );
				$goal_url     = $goal->url;
				$date_start   = $date_start > 0 ? $date_start : $goal->date_created;
				$goal_url_sql = $goal_url === '' || $goal_url === '*' || $goal->type === 'visits' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );

				if ( $goal->conversion_metric === 'pageviews' ) {
					$count_sql = 'COUNT(*)';
				} elseif ( $goal->conversion_metric === 'sessions' ) {
					$count_sql = 'COUNT(DISTINCT(statistics.session_id))';
				} else {
					$count_sql = 'COUNT(DISTINCT(statistics.uid_id))';
				}
				$goal_sql = $wpdb->prepare( 'goals.goal_id = %d', $goal_id );
			}

			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- using prepared parts.
			$sql = $wpdb->prepare(
				"SELECT {$count_sql} AS value FROM {$wpdb->prefix}burst_goal_statistics AS goals
        INNER JOIN {$wpdb->prefix}burst_statistics AS statistics
            ON statistics.ID = goals.statistic_id
        INNER JOIN {$wpdb->prefix}burst_sessions AS sessions
            ON statistics.session_id = sessions.ID
        WHERE {$goal_sql} AND statistics.time > %s {$date_end_sql} {$goal_url_sql}",
				$date_start
			);
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			return $sql;
		}
		// phpcs:enable SlevomatCodingStandard.TypeHints.ParameterTypeHint.MissingNativeTypeHint

		/**
		 * Get goals data for the goals block or statistics overview.
		 *
		 * @param array $args {
		 *     Optional. Arguments to filter the goal data.
		 * @type int    $date_start Start date (timestamp).
		 *     @type int    $date_end   End date (timestamp).
		 *     @type string $url        Page URL for filtering.
		 *     @type int    $goal_id    Goal ID to fetch.
		 * }
		 * @return array{
		 *     today: array{value: int, tooltip: string},
		 *     total: array{value: int, tooltip: string},
		 *     topPerformer: array{title: string, value: int},
		 *     conversionMetric: array{title: string, value: int, tooltip: string, icon: string},
		 *     conversionPercentage: array{title: string, value: int, tooltip: string},
		 *     bestDevice: array{title: string, value: int, icon: mixed},
		 *     dateCreated: int,
		 *     dateStart: int,
		 *     dateEnd: int,
		 *     status: string,
		 *     goalId: int|string
		 * }
		 */
		public function get_goals_data( array $args = [] ): array {
			if ( ! self::database_upgrade_completed() ) {
				return [
					'today'                => [
						'value'   => 0,
						'tooltip' => '',
					],
					'total'                => [
						'value'   => 0,
						'tooltip' => '',
					],
					'topPerformer'         => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
					],
					'conversionMetric'     => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
						'icon'    => '',
					],
					'conversionPercentage' => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
					],
					'bestDevice'           => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
						'icon'    => null,
					],
					'dateCreated'          => 0,
					'dateStart'            => 0,
					'dateEnd'              => 0,
					'status'               => '',
					'goalId'               => 0,
				];
			}

			global $wpdb;

			// Define default arguments.
			$defaults = [
				'date_start' => 0,
				'date_end'   => 0,
				'url'        => '',
				'goal_id'    => 0,
			];
			$args     = wp_parse_args( $args, $defaults );

			$default_data = [
				'today'                => [
					'value'   => 0,
					'tooltip' => '',
				],
				'total'                => [
					'value'   => 0,
					'tooltip' => '',
				],
				'topPerformer'         => [
					'title' => '-',
					'value' => 0,
				],
				'conversionMetric'     => [
					'title'   => __( 'Visitors', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'    => 'visitors',
				],
				'conversionPercentage' => [
					'title'   => __( 'Conversion rate', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
				],
				'bestDevice'           => [
					'title' => __( 'Not enough data', 'burst-statistics' ),
					'value' => 0,
					'icon'  => 'desktop',
				],
				'dateCreated'          => 0,
				'dateStart'            => 0,
				'dateEnd'              => 0,
				'status'               => 'inactive',
				'goalId'               => 0,
			];

			$goal                  = null;
			$goal_url              = '';
			$active_goal_ids       = [];
			$earliest_date_created = 0;

			// Sanitize input.
			$goal_id = $args['goal_id'] === 'all' ? 'all' : (int) $args['goal_id'];

			if ( $goal_id !== 'all' ) {
				$goal       = new Goal( $goal_id );
				$goal_url   = $goal->url;
				$date_start = $goal->date_created;
				$date_end   = 0;
			} else {
				$active_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );
				if ( empty( $active_goals ) ) {
					$default_data['goalId'] = 'all';
					return $default_data;
				}
				$active_goal_ids       = [];
				$earliest_date_created = time();
				foreach ( $active_goals as $g ) {
					$active_goal_ids[] = (int) $g->ID;
					if ( (int) $g->date_created < $earliest_date_created ) {
						$earliest_date_created = (int) $g->date_created;
					}
				}
				$date_start = $earliest_date_created;
				$date_end   = 0;
			}

			// Initialize data array.
			$data = $default_data;

			if ( $goal_id !== 'all' ) {
				if ( $goal->conversion_metric === 'pageviews' ) {
					$data['conversionMetric'] = [
						'title'   => __( 'Pageviews', 'burst-statistics' ),
						'value'   => 0,
						'tooltip' => '',
						'icon'    => 'pageviews',
					];
					$count_sql                = 'COUNT(*)';
				} elseif ( $goal->conversion_metric === 'sessions' ) {
					$data['conversionMetric'] = [
						'title'   => __( 'Sessions', 'burst-statistics' ),
						'value'   => 0,
						'tooltip' => '',
						'icon'    => 'sessions',
					];
					$count_sql                = 'COUNT(DISTINCT(statistics.session_id))';
				} else {
					$count_sql = 'COUNT(DISTINCT(statistics.uid_id))';
				}
			} else {
				$count_sql = 'COUNT(DISTINCT(statistics.uid_id))';
			}

			if ( $goal_id === 'all' ) {
				$data['dateCreated'] = $earliest_date_created;
				$data['dateStart']   = $date_start;
				$data['dateEnd']     = $date_end;
				$data['status']      = 'active';
				$data['goalId']      = 'all';
			} else {
				$data['dateCreated'] = $goal->date_created;
				$data['dateStart']   = $date_start;
				$data['dateEnd']     = $date_end;
				$data['status']      = $goal->status;
				$data['goalId']      = $goal_id;
			}

			if ( $goal_id !== 0 ) {
				$query_goal_id = $goal_id === 'all' ? $active_goal_ids : $goal_id;

				// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- dynamic SQL parts and lists.
				// Query to get top performing page.
				$top_performer_sql  = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );
				$top_performer_sql  = str_replace( ' AS value FROM ', ' AS value, statistics.page_url AS title FROM ', $top_performer_sql );
				$top_performer_sql .= ' GROUP BY statistics.page_url ORDER BY value DESC LIMIT 1';

				// Query to get total number of goal completions.
				$total_completed_sql = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );

				// Query to get total number of visitors, sessions or pageviews with build_raw_sql.
				if ( $goal_id === 'all' ) {
					$date_end_sql = '';
					$goal_url_sql = '';
				} else {
					// @phpstan-ignore-next-line
					$date_end_sql = $date_end > 0 ? $wpdb->prepare( 'AND statistics.time < %s', $date_end ) : '';
					$goal_url_sql = $goal_url === '' || $goal_url === '*' || $goal->type === 'visits' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );
				}

				$conversion_metric = $wpdb->prepare(
					"SELECT {$count_sql} FROM {$wpdb->prefix}burst_statistics as statistics WHERE statistics.time > %s {$date_end_sql} {$goal_url_sql}",
					$date_start
				);

				// Query to get best performing device. device_id > 0: the
				// denominators (bitmap dimension counts and the sessions
				// fallback) only carry real devices, so an unresolved-device
				// numerator row would never find a denominator and silently
				// drop out of the ranking — exclude it up front so numerator
				// and denominator describe the same population.
				$completed_goals_per_device_sql  = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );
				$completed_goals_per_device_sql  = str_replace( ' AS value FROM ', ' AS value, sessions.device_id AS device_id FROM ', $completed_goals_per_device_sql );
				$completed_goals_per_device_sql .= ' AND sessions.device_id > 0 GROUP BY sessions.device_id ORDER BY value DESC LIMIT 4';

				if ( $goal_id === 'all' ) {
					$pageviews_per_device_sql = $wpdb->prepare(
						"SELECT {$count_sql} AS value, sessions.device_id
						FROM {$wpdb->prefix}burst_statistics AS statistics
						INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID
						WHERE statistics.time > %d
						GROUP BY sessions.device_id
						ORDER BY value DESC
						LIMIT 4",
						$date_start
					);
				} else {
					$pageviews_per_device_sql = $wpdb->prepare(
						"SELECT {$count_sql} AS value, sessions.device_id
						FROM {$wpdb->prefix}burst_statistics AS statistics
						INNER JOIN {$wpdb->prefix}burst_sessions AS sessions
							ON statistics.session_id = sessions.ID
						WHERE statistics.time > %s {$date_end_sql} {$goal_url_sql}
						GROUP BY sessions.device_id
						ORDER BY value DESC
						LIMIT 4",
						$date_start
					);
				}
				// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

				$top_performer_sql    = $this->add_query_timeout_hint( $top_performer_sql, $this->get_goal_query_timeout_ms() );
				$top_performer_result = Query_Executor::create()
					->fingerprint( 'goal_top_performer_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $top_performer_sql, 'get_row', 'OBJECT' );
				if ( $top_performer_result ) {
					$data['topPerformer']['title'] = $top_performer_result->title;
					$data['topPerformer']['value'] = $top_performer_result->value;
				}

				// Query to get total number of goal completions.
				$total_completed_sql    = $this->add_query_timeout_hint( $total_completed_sql, $this->get_goal_query_timeout_ms() );
				$data['total']['value'] = Query_Executor::create()
					->fingerprint( 'goal_total_completed_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $total_completed_sql, 'get_var' );

				// Query to get total number of visitors, sessions or pageviews with build_raw_sql.
				$conversion_metric                 = $this->add_query_timeout_hint( $conversion_metric, $this->get_goal_query_timeout_ms() );
				$data['conversionMetric']['value'] = Query_Executor::create()
					->fingerprint( 'goal_conversion_metric_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $conversion_metric, 'get_var' );

				// Query to get best performing device.
				$completed_goals_per_device_sql = $this->add_query_timeout_hint( $completed_goals_per_device_sql, $this->get_goal_query_timeout_ms() );
				$completed_goals_per_device     = Query_Executor::create()
					->fingerprint( 'goal_completed_goals_per_device_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $completed_goals_per_device_sql, 'get', 'OBJECT' );

				// The denominator per device (visitors/sessions/pageviews since
				// goal start) scans all hits in range on the raw path — try
				// the fast paths first: device-scope visitor bitmaps for the
				// visitors metric, the sessions table for the sessions metric.
				$device_metric = 'visitors';
				if ( 'all' !== $goal_id && in_array( $goal->conversion_metric, [ 'pageviews', 'sessions' ], true ) ) {
					$device_metric = $goal->conversion_metric;
				}
				$pageviews_per_device = '' === $goal_url_sql
					? $this->get_denominator_per_device( $device_metric, $date_start, 'all' === $goal_id ? 0 : $date_end )
					: null;

				if ( null === $pageviews_per_device ) {
					$pageviews_per_device_sql = $this->add_query_timeout_hint( $pageviews_per_device_sql, $this->get_goal_query_timeout_ms() );
					$pageviews_per_device     = Query_Executor::create()
						->fingerprint( 'goal_pageviews_per_device_' . $goal_id )
						->cache_ttl( 30 )
						->cache_group( 'burst_stats_query_results' )
						->single_flight( false )
						->run( $pageviews_per_device_sql, 'get', 'OBJECT' );
				}

				// create lookupt table for faster access to pageviews per device.
				$pageviews_lookup = [];
				foreach ( $pageviews_per_device as $row ) {
					$pageviews_lookup[ $row->device_id ] = $row->value;
				}

				// calculate conversion rate and select the highest percentage.
				$highest_percentage = 0;
				foreach ( $completed_goals_per_device as $device ) {
					if ( isset( $pageviews_lookup[ $device->device_id ] ) && $pageviews_lookup[ $device->device_id ] > 0 ) {
						$percentage = round( ( $device->value / $pageviews_lookup[ $device->device_id ] ) * 100, 2 );
						if ( $percentage > $highest_percentage ) {
							$device_string               = \Burst\burst_loader()->admin->statistics->get_lookup_table_name_by_id( 'device', $device->device_id );
							$highest_percentage          = $percentage;
							$data['bestDevice']['title'] = $this->get_device_name( $device_string );
							$data['bestDevice']['icon']  = ( $device_string && $device_string !== 'other' ) ? $device_string : 'desktop';
							$data['bestDevice']['value'] = $percentage;
						}
					}
				}
			}

			return $data;
		}

		/**
		 * Denominator per device for the best-device conversion rate, via the
		 * fast paths where the metric allows: visitors come from the device-scope
		 * visitor bitmaps (start floored to the site-timezone day — the sub-day
		 * offset of a goal's creation moment is noise for a device ratio),
		 * sessions from the sessions table directly. Returns null when the metric
		 * or migration state requires the raw statistics scan.
		 *
		 * @param string $metric     Conversion metric: 'visitors', 'sessions' or 'pageviews'.
		 * @param int    $date_start Range start (unix timestamp).
		 * @param int    $date_end   Range end (unix timestamp, 0 = open-ended).
		 * @return array<int, object>|null Rows with ->value and ->device_id, or null for the raw fallback.
		 */
		private function get_denominator_per_device( string $metric, int $date_start, int $date_end ): ?array {
			$date_end = $date_end > 0 ? $date_end : time();

			if ( 'sessions' === $metric ) {
				return $this->sessions_denominator_per_device( 'COUNT(*)', $date_start, $date_end );
			}

			if ( 'visitors' !== $metric ) {
				// Pageviews need the hit rows; only the raw path can count them.
				return null;
			}

			$timezone  = wp_timezone();
			$start_day = ( new \DateTimeImmutable( '@' . $date_start ) )->setTimezone( $timezone )->setTime( 0, 0 )->getTimestamp();
			$bitmaps   = new Visitor_Bitmaps();

			// One grouped store read serves every device at once (one coverage
			// check, one live-tail scan), and the serve/fallback is recorded so
			// Site Health shows when this path degrades.
			$bitmap_start = microtime( true );
			$per_device   = $bitmaps->get_visitors_by_dimension( 'device_id', $start_day, $date_end );
			$bitmaps->record_serve( null === $per_device ? null : count( $per_device ), microtime( true ) - $bitmap_start );

			if ( null === $per_device ) {
				// Store not ready for this range: count distinct visitors
				// per device from the sessions table instead — the session
				// start convention every session-grain query uses, no
				// statistics scan, no per-row join. This is the middle
				// ground that keeps the goals block off the raw
				// all-history statistics/sessions join (the heaviest query
				// the dashboard used to run) even when the bitmap store
				// cannot serve the range. NULLIF: the uid_id-0 bucket is
				// many unresolved visitors, not one — same convention as
				// the visitors metric.
				return $this->sessions_denominator_per_device( 'COUNT(DISTINCT NULLIF(uid_id, 0))', $date_start, $date_end );
			}

			$rows = [];
			foreach ( $per_device as $device_id => $visitors ) {
				$rows[] = (object) [
					'value'     => $visitors,
					'device_id' => $device_id,
				];
			}
			usort( $rows, static fn( object $a, object $b ): int => $b->value <=> $a->value );
			return array_slice( $rows, 0, 4 );
		}

		/**
		 * Per-device denominator from the sessions table: one grouped pass over
		 * the (start_time-indexed) sessions rows. Shared by the sessions metric
		 * and the visitors bitmap fallback.
		 *
		 * @param string $count_expr Aggregate for the value column — an internal
		 *                           constant ('COUNT(*)' or the distinct-uid_id
		 *                           variant), never request data.
		 * @param int    $date_start Range start (unix timestamp).
		 * @param int    $date_end   Range end (unix timestamp).
		 * @return array<int, object>|null Rows with ->value and ->device_id, or null for the raw fallback.
		 */
		private function sessions_denominator_per_device( string $count_expr, int $date_start, int $date_end ): ?array {
			if ( ! Session_Grain_Shape::session_grain_ready() ) {
				return null;
			}
			global $wpdb;
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name and internal aggregate, values prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT {$count_expr} AS value, device_id FROM {$wpdb->prefix}burst_sessions
					WHERE start_time > %d AND start_time <= %d AND device_id > 0
					GROUP BY device_id ORDER BY value DESC LIMIT 4",
					$date_start,
					$date_end
				)
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			return is_array( $rows ) ? $rows : null;
		}

		/**
		 * Get translatable device name based on device type
		 */
		public function get_device_name(
			string $device
		): string {
			switch ( $device ) {
				case 'desktop':
					$device_name = __( 'Desktop', 'burst-statistics' );
					break;
				case 'mobile':
					$device_name = __( 'Mobile', 'burst-statistics' );
					break;
				case 'tablet':
					$device_name = __( 'Tablet', 'burst-statistics' );
					break;
				case 'other':
				default:
					$device_name = __( 'Other', 'burst-statistics' );
					break;
			}

			return $device_name;
		}

		/**
		 * Install goal statistic table
		 * */
		public function install_goal_statistics_table(): void {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			global $wpdb;
			$charset_collate = $wpdb->get_charset_collate();
			$sql             = "CREATE TABLE {$wpdb->prefix}burst_goal_statistics (
                `ID` int NOT NULL AUTO_INCREMENT,
                `statistic_id` int NOT NULL,
                `goal_id` int NOT NULL,
                PRIMARY KEY (ID),
                UNIQUE KEY goal_statistic_unique (goal_id, statistic_id)
            ) $charset_collate;";

			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating goal statistics table: ' . $wpdb->last_error );
				return;
			}

			$indexes = [
				[ 'statistic_id' ],
				[ 'goal_id' ],
			];

			foreach ( $indexes as $index ) {
				$this->add_index( 'burst_goal_statistics', $index );
			}
		}
	}
}
