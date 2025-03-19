<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );

if ( ! class_exists( 'burst_goals' ) ) {
	class burst_goals {
		public function __construct() {
		}

		public function sanitize_orderby( $orderby ) {
			global $wpdb;

			// Get all columns from {$wpdb->prefix}burst_goals table
			$table_name = $wpdb->prefix . 'burst_goals';
			$cols       = $wpdb->get_results( "SHOW COLUMNS FROM $table_name", ARRAY_A );

			// Extract the 'Field' values into an array
			$col_names = array_column( $cols, 'Field' );

			// If $orderby is not in $col_names, set it to 'ID'
			if ( ! in_array( $orderby, $col_names, true ) ) {
				$orderby = 'ID';
			}

			return $orderby;
		}

		/**
		 * Get predefined goals from the integrations list
		 * @param bool $skip_active_check // skip checking if the plugin is active.
		 * @return array
		 */
		public function get_predefined_goals( $skip_active_check = false ): array {
			global $burst_integrations_list;

			$predefined_goals = [];
			foreach ( $burst_integrations_list as $plugin => $details ) {
				if ( ! isset( $details['goals'] ) ) {
					continue;
				}

				if ( !$skip_active_check && ! burst_integration_plugin_is_active( $plugin, true ) ) {
                    continue;
				}

				$predefined_goals = array_merge( $details['goals'], $predefined_goals );
			}
			return $predefined_goals;
		}

		/**
		 * Get list of goals
		 *
		 * @param $args
		 *
		 * @return array
		 */
		public function get_goals( array $args = [] ): array {
			if ( ! burst_user_can_view() ) {
				return array();
			}

			global $wpdb;
			$default_args = array(
				'status'  => 'all',
				'limit'   => 9999,
				'offset'  => 0,
				'orderby' => 'ID',
				'order'   => 'ASC',
			);
			// merge args
			$args = wp_parse_args( $args, $default_args );

			// sanitize args
			$args['order']   = $args['order'] === 'DESC' ? 'DESC' : 'ASC';
			$args['orderby'] = $this->sanitize_orderby( $args['orderby'] );
			require_once burst_path . 'goals/class-goal.php';
			$goal           = new burst_goal();
			$args['status'] = $goal->sanitize_status( $args['status'] );
			$args['limit']  = (int) $args['limit'];
			$args['offset'] = (int) $args['offset'];

			$query = "SELECT * FROM {$wpdb->prefix}burst_goals";
			$where = array();
			if ( $args['status'] !== 'all' ) {
				$where[] = $wpdb->prepare( 'status = %s', $args['status'] );
			}
			if ( ! empty( $where ) ) {
				$query .= ' WHERE ' . implode( ' AND ', $where );
			}

			$query .= " ORDER BY {$args['orderby']} {$args['order']}";// can only be columns or DESC/ASC because of sanitizing
			$query .= " LIMIT {$args['offset']}, {$args['limit']}"; // can only be integer because of sanitizing

			$results = $wpdb->get_results( $query, ARRAY_A );

			$goals = array_reduce(
				$results,
				static function ( $accumulator, $currentValue ) {
					$id = $currentValue['ID'];
					unset( $currentValue['ID'] );
					$accumulator[ $id ] = $currentValue;
					return $accumulator;
				},
				array()
			);

			// loop through goals and add the fields and get then object for each goal
			require_once burst_path . 'goals/class-goal.php';
			$objects = array();
			foreach ( $goals as $goal_id => $goal ) {
				$goal      = new burst_goal( $goal_id );
				$objects[] = $goal;
			}

			return $objects;
		}
	} // class closure

} // class exists closure

/**
 * Install goal table
 * */

add_action( 'burst_install_tables', 'burst_install_goals_table', 10 );
function burst_install_goals_table() {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    $table_name = $wpdb->prefix . 'burst_goals';
    $sql = "CREATE TABLE $table_name (
        `ID` int NOT NULL AUTO_INCREMENT,
        `title` varchar(255) NOT NULL,
        `type` varchar(30) NOT NULL,
        `status` varchar(30) NOT NULL,
        `server_side` tinyint NOT NULL,
        `url` varchar(255) NOT NULL,
        `conversion_metric` varchar(255) NOT NULL,
        `date_created` int NOT NULL,
        `date_start` int NOT NULL,
        `date_end` int NOT NULL,
        `attribute` varchar(255) NOT NULL,
        `attribute_value` varchar(255) NOT NULL,
        `hook` varchar(255) NOT NULL,
        PRIMARY KEY (ID)
    ) $charset_collate;";

    $result = dbDelta($sql);
    if ( !empty($wpdb->last_error) ) {
        burst_error_log("Error creating goals table: " . $wpdb->last_error);
    }
}
