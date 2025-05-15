<?php
namespace Burst\Admin\Statistics;

use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'Goal_Statistics' ) ) {
	class Goal_Statistics {
		use Admin_Helper;
		use Database_Helper;
		use Helper;

		/**
		 * Constructor
		 */
		public function __construct() {
			add_action( 'burst_install_tables', [ $this, 'install_goal_statistics_table' ], 10 );
		}

		/**
		 * Get live goals data
		 */
		public function get_live_goals_count( array $args = [] ): int {
			global $wpdb;

			$goal_id      = (int) $args['goal_id'];
			$today        = strtotime( 'today midnight' );
			$goal         = new Goal( $goal_id );
			$goal_url     = $goal->url;
			$goal_url_sql = $goal_url === '' || $goal_url === '*' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );

			$sql = $wpdb->prepare(
				"SELECT COUNT(*)
					FROM {$wpdb->prefix}burst_statistics as statistics 
					    INNER JOIN {$wpdb->prefix}burst_goal_statistics as goals 
					        ON statistics.ID = goals.statistic_id
					WHERE statistics.bounce = 0 AND goals.goal_id = %d AND statistics.time > %d {$goal_url_sql}",
				$goal_id,
				$today
			);
			$val = $wpdb->get_var( $sql );

			return (int) $val ?: 0;
		}

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
		 *     topPerformer: array{title: string, value: int, tooltip: string},
		 *     conversionMetric: array{title: string, value: int, tooltip: string, icon: string},
		 *     conversionPercentage: array{title: string, value: int, tooltip: string},
		 *     bestDevice: array{title: string, value: int, tooltip: string, icon: mixed},
		 *     dateCreated: int,
		 *     dateStart: int,
		 *     dateEnd: int,
		 *     status: string,
		 *     goalId: int
		 * }
		 */
		public function get_goals_data( array $args = [] ): array {
			global $wpdb;

			// Define default arguments.
			$defaults = [
				'date_start' => 0,
				'date_end'   => 0,
				'url'        => '',
				'goal_id'    => 0,
			];
			$args     = wp_parse_args( $args, $defaults );

			// Sanitize input.
			$goal_id    = (int) $args['goal_id'];
			$goal       = new Goal( $goal_id );
			$goal_url   = $goal->url;
			$date_start = $goal->date_created;
			$date_end   = 0;

			// Initialize data array.
			$data = [];
			// this data is always empty, but is needed clientside to prevent errors (crashes when not available).
			$data['today']        = [
				'value'   => 0,
				'tooltip' => '',
			];
			$data['total']        = [
				'value'   => 0,
				'tooltip' => '',
			];
			$data['topPerformer'] = [
				'title'   => '-',
				'value'   => 0,
				'tooltip' => __( 'Top performing page', 'burst-statistics' ),
			];
			// Conversion metric visitors.
			if ( $goal->conversion_metric === 'pageviews' ) {
				$data['conversionMetric'] = [
					'title'   => __( 'Pageviews', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'    => 'pageviews',
				];
				$conversion_metric_select = 'COUNT(*)';
			} elseif ( $goal->conversion_metric === 'sessions' ) {
				$data['conversionMetric'] = [
					'title'   => __( 'Sessions', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'    => 'sessions',
				];
				$conversion_metric_select = 'COUNT(DISTINCT(statistics.session_id))';
			} else {
				// visitors.
				$data['conversionMetric'] = [
					'title'   => __( 'Visitors', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'    => 'visitors',
				];
				$conversion_metric_select = 'COUNT(DISTINCT(statistics.uid))';
			}
			$data['conversionPercentage'] = [
				'title'   => __( 'Conversion rate', 'burst-statistics' ),
				'value'   => 0,
				'tooltip' => '',
			];
			$data['bestDevice']           = [
				'title'   => __( 'Not enough data', 'burst-statistics' ),
				'value'   => 0,
				'tooltip' => __( 'Best performing device', 'burst-statistics' ),
				'icon'    => 'desktop',
			];
			$data['dateCreated']          = $goal->date_created;
			$data['dateStart']            = $date_start;
			$data['dateEnd']              = $date_end;
			$data['status']               = $goal->status;
			$data['goalId']               = $goal_id;

			if ( $goal_id !== 0 ) {
				// Query to get total number of goal completions.
				// we may want to add a date_end later, so we ignore the warning about obsolete date_end check.
				// @phpstan-ignore-next-line.
				$date_end_sql = $date_end > 0 ? $wpdb->prepare( 'AND statistics.time < %s', $date_end ) : '';
				$goal_url_sql = $goal_url === '' || $goal_url === '*' || $goal->type === 'visits' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );
				$total_sql    = $wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics AS statistics
								INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
								ON statistics.ID = goals.statistic_id
								WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}",
					$goal_id,
					$date_start
				);

				$data['total']['value'] = $wpdb->get_var( $total_sql );

				// Query to get top performing page.
				$top_performer_sql    = $wpdb->prepare(
					"SELECT COUNT(*) AS value, statistics.page_url AS title FROM {$wpdb->prefix}burst_statistics AS statistics
											INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
											ON statistics.ID = goals.statistic_id
											WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
											GROUP BY statistics.page_url ORDER BY COUNT(*) DESC LIMIT 1",
					$goal_id,
					$date_start
				);
				$top_performer_result = $wpdb->get_row( $top_performer_sql );
				if ( $top_performer_result ) {
					$data['topPerformer']['title'] = $top_performer_result->title;
					$data['topPerformer']['value'] = $top_performer_result->value;
				}

				// Query to get total number of visitors, sessions or pageviews with get_sql_table.
				$conversion_metric                 = $wpdb->prepare(
					"SELECT {$conversion_metric_select} FROM {$wpdb->prefix}burst_statistics as statistics
												WHERE statistics.time > %s {$date_end_sql} AND statistics.bounce = 0 {$goal_url_sql}",
					$date_start
				);
				$data['conversionMetric']['value'] = $wpdb->get_var( $conversion_metric );

				// Query to get best performing device.
				// during upgrade to new lookupt tables.
				$use_lookup_tables = \Burst\burst_loader()->admin->statistics->use_lookup_tables();
				$device_column     = $use_lookup_tables ? 'device_id' : 'device';
				$device_sql        = $wpdb->prepare(
					"SELECT COUNT(*) AS value, statistics.$device_column AS device_id FROM {$wpdb->prefix}burst_statistics AS statistics
										INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
										ON statistics.ID = goals.statistic_id
										WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
										GROUP BY statistics.device_id ORDER BY value DESC LIMIT 4",
					$goal_id,
					$date_start
				);
				$device_result     = $wpdb->get_results( $device_sql );

				$pageviews_per_device = $wpdb->prepare(
					"SELECT COUNT(*) AS value, $device_column as device_id FROM {$wpdb->prefix}burst_statistics as statistics
										WHERE statistics.bounce = 0 AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
										GROUP BY statistics.device_id ORDER BY value DESC LIMIT 4",
					$date_start
				);

				$pageviews_per_device_result = $wpdb->get_results( $pageviews_per_device );

				// calculate conversion rate and select the highest percentage.
				$highest_percentage = 0;
				foreach ( $device_result as $device ) {
					foreach ( $pageviews_per_device_result as $pageviews_per_device_row ) {
						if ( $device->device_id === $pageviews_per_device_row->device_id ) {
							$device_id  = $use_lookup_tables ? \Burst\burst_loader()->frontend->tracking->get_lookup_table_id_cached( $device->device_id, 'device' ) : $device->device_id;
							$percentage = round( ( $device->value / $pageviews_per_device_row->value ) * 100, 2 );
							if ( $percentage > $highest_percentage ) {
								$highest_percentage          = $percentage;
								$data['bestDevice']['title'] = $this->get_device_name( $device_id );
								$data['bestDevice']['icon']  = $device;
								$data['bestDevice']['value'] = $percentage;
							}
						}
					}
				}
			}

			return $data;
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
			// Create table without indexes first.
			$table_name = $wpdb->prefix . 'burst_goal_statistics';
			$sql        = "CREATE TABLE $table_name (
        `ID` int NOT NULL AUTO_INCREMENT,
        `statistic_id` int NOT NULL,
        `goal_id` int NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;";

			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating goal statistics table: ' . $wpdb->last_error );
				// Exit without updating version if table creation failed.
				return;
			}

			$indexes = [
				[ 'statistic_id' ],
				[ 'goal_id' ],
			];

			foreach ( $indexes as $index ) {
				$this->add_index( $table_name, $index );
			}
		}
	}
}
