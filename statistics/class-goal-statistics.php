<?php
defined( 'ABSPATH' ) or die( "you do not have access to this page!" );

if ( ! class_exists( "burst_goal_statistics" ) ) {
	class burst_goal_statistics {
		function __construct() {
			add_action( 'init', array( $this, 'init' ), 10, 3 );
		}

		public function init() {
		}

		public function get_goal_id( $goal_id ) {
			global $wpdb;
			$goal_id = (int) $goal_id ?: 0;
			if ( ! $goal_id ) {
				// get first active goal from db
				$goal_id = $wpdb->get_var( "SELECT ID FROM {$wpdb->prefix}burst_goals WHERE status = 'active' ORDER BY ID LIMIT 1" );
			}
			if ( ! $goal_id ) {
				return 0;
			}

			return $goal_id;
		}

		public function get_live_goals_data( $args = [] ): int {
			global $wpdb;

			$goal_id      = $this->get_goal_id( $args['goal_id'] );
			$today        = strtotime( 'today midnight' );
			require_once burst_path . 'goals/class-goal.php';
			$goal = new burst_goal($goal_id);
			$goal_url     = $goal->url;
			$goal_url_sql = $goal_url === '' || $goal_url === '*' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );

			$sql = $wpdb->prepare("SELECT COUNT(*)
					FROM {$wpdb->prefix}burst_statistics as statistics 
					    INNER JOIN {$wpdb->prefix}burst_goal_statistics as goals 
					        ON statistics.ID = goals.statistic_id
					WHERE statistics.bounce = 0 AND goals.goal_id = %d AND statistics.time > %d {$goal_url_sql}", $goal_id, $today );
			$val = $wpdb->get_var( $sql );

			return (int) $val ?: 0;
		}

		public function get_goals_data( $args = array() ): array {
			global $wpdb;

			// Define default arguments
			$defaults = array(
				'date_start' => 0,
				'date_end'   => 0,
				'url'        => '',
				'goal_id'    => 0,
			);
			$args     = wp_parse_args( $args, $defaults );


			// Sanitize input
			$goal_id    = (int) $this->get_goal_id( $args['goal_id'] );
			require_once burst_path . 'goals/class-goal.php';
			$goal = new burst_goal($goal_id);
            $goal_url   = $goal->url;
            $date_start = $goal->date_created;
            $date_end   = 0;
			$goal_type = $goal->type;
			$goal_conversion_metric = $goal->conversion_metric;

			// Initialize data array
			$data = array();
            //this data is always empty, but is needed clientside to prevent errors (crashes when not available).
            $data['today'] = array( 'value' => 0, 'tooltip' => '' );
			$data['total'] = array( 'value' => 0, 'tooltip' => '' );
			$data['topPerformer'] = array(
				'title'   => '-',
				'value'   => 0,
				'tooltip' => __( 'Top performing page', 'burst-statistics' ),
			);
			// Conversion metric visitors
			if ( $goal_conversion_metric === 'pageviews' ) {
				$data['conversionMetric'] = array(
					'title'   => __( 'Pageviews', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'   => 'pageviews'
				);
				$conversion_metric_select = 'COUNT(*)';
			} else if ( $goal_conversion_metric === 'sessions' ) {
				$data['conversionMetric'] = array(
					'title'   => __( 'Sessions', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'   => 'sessions'
				);
				$conversion_metric_select = "COUNT(DISTINCT(statistics.session_id))";
			} else { // visitors
				$data['conversionMetric'] = array(
					'title'   => __( 'Visitors', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'   => 'visitors'
				);
				$conversion_metric_select = "COUNT(DISTINCT(statistics.uid))";
			}
			$data['conversionPercentage'] = array(
				'title'   => __( 'Conversion rate', 'burst-statistics' ),
				'value'   => 0,
				'tooltip' => ''
			);
			$data['bestDevice'] = array(
				'title'   => __( 'Not enough data', 'burst-statistics' ),
				'value'   => 0,
				'tooltip' => __( 'Best performing device', 'burst-statistics' ),
				'icon'    => 'desktop'
			);
			$data['dateCreated'] = $goal->date_created;
			$data['dateStart'] = $date_start;
			$data['dateEnd'] = $date_end;
			$data['status'] = $goal->status;
			$data['goalId'] = $goal_id;

			if ( $goal_id !== 0 ) {
				// Query to get total number of goal completions

				$date_end_sql = $date_end > 0 ? $wpdb->prepare("AND statistics.time < %s", $date_end) : '';
				$goal_url_sql = $goal_url === '' || $goal_url === '*' || $goal_type === 'visits' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );
				$total_sql    = $wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics AS statistics
								INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
								ON statistics.ID = goals.statistic_id
								WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}", $goal_id, $date_start);

				$data['total']['value'] = $wpdb->get_var( $total_sql );

				// Query to get top performing page

				$top_performer_sql    = $wpdb->prepare("SELECT COUNT(*) AS value, statistics.page_url AS title FROM {$wpdb->prefix}burst_statistics AS statistics
											INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
											ON statistics.ID = goals.statistic_id
											WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
											GROUP BY statistics.page_url ORDER BY COUNT(*) DESC LIMIT 1", $goal_id, $date_start);
				$top_performer_result = $wpdb->get_row( $top_performer_sql );
				if ( $top_performer_result ) {
					$data['topPerformer']['title'] = $top_performer_result->title;
					$data['topPerformer']['value'] = $top_performer_result->value;
				}

				// Query to get total number of visitors, sessions or pageviews with get_sql_table
				$conversionMetric               = $wpdb->prepare("SELECT {$conversion_metric_select} FROM {$wpdb->prefix}burst_statistics as statistics
												WHERE statistics.time > %s {$date_end_sql} AND statistics.bounce = 0 {$goal_url_sql}", $date_start);
				$data['conversionMetric']['value'] = $wpdb->get_var( $conversionMetric );

				// Query to get best performing device
				$use_lookup_tables = BURST()->statistics->use_lookup_tables(); //during upgrade to new lookupt tables.
				$device_column = $use_lookup_tables ? 'device_id' : 'device';
				$device_sql    = $wpdb->prepare("SELECT COUNT(*) AS value, statistics.$device_column AS device_id FROM {$wpdb->prefix}burst_statistics AS statistics
										INNER JOIN {$wpdb->prefix}burst_goal_statistics AS goals
										ON statistics.ID = goals.statistic_id
										WHERE statistics.bounce = 0 AND goals.goal_id = %s AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
										GROUP BY statistics.device_id ORDER BY value DESC LIMIT 4", $goal_id, $date_start);
				$device_result = $wpdb->get_results( $device_sql );

				$pageviews_per_device = $wpdb->prepare("SELECT COUNT(*) AS value, $device_column as device_id FROM {$wpdb->prefix}burst_statistics as statistics
										WHERE statistics.bounce = 0 AND statistics.time > %s {$date_end_sql} {$goal_url_sql}
										GROUP BY statistics.device_id ORDER BY value DESC LIMIT 4", $date_start);


				$pageviews_per_device_result = $wpdb->get_results($pageviews_per_device);

				// calculate conversion rate and select the highest percentage
				$highest_percentage = 0;
				foreach ( $device_result as $device ) {
					foreach ( $pageviews_per_device_result as $pageviews_per_device ) {
						if ( $device->device_id === $pageviews_per_device->device_id ) {
							$device_id = $use_lookup_tables ? BURST()->frontend->get_lookup_table_id( $device->device_id, 'device' ) : $device->device_id;
							$percentage = round( ( $device->value / $pageviews_per_device->value ) * 100, 2 );
							if ( $percentage > $highest_percentage ) {
								$highest_percentage = $percentage;
								$data['bestDevice']['title'] = $this->get_device_name($device_id);
								$data['bestDevice']['icon'] = $device;
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
		 * @param $device
		 *
		 * @return string|null
		 */
		public function get_device_name(
			$device
		): ?string {
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
	}
}


/**
 * Install goal statistic table
 * */

add_action( 'burst_install_tables', 'burst_install_goal_statistics_table', 10 );
function burst_install_goal_statistics_table() {
    require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    // Create table without indexes first
    $table_name = $wpdb->prefix . 'burst_goal_statistics';
    $sql = "CREATE TABLE $table_name (
        `ID` int NOT NULL AUTO_INCREMENT,
        `statistic_id` int NOT NULL,
        `goal_id` int NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;";

    dbDelta($sql);
    if (!empty($wpdb->last_error)) {
        burst_error_log("Error creating goal statistics table: " . $wpdb->last_error);
        return; // Exit without updating version if table creation failed
    }

    $indexes = array(
        ['statistic_id'],
        ['goal_id'],
    );

    foreach ($indexes as $index ) {
        burst_add_index($table_name, $index);
    }
}
