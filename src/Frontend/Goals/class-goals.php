<?php
namespace Burst\Frontend\Goals;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Goals {
	use Helper;
	use Admin_Helper;
	use Sanitize;

	private array $orderby_columns = [];

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_goals_table' ], 10 );
	}

	/**
	 * Install goal table
	 * */
	public function install_goals_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		global $wpdb;
		// server_side property to be removed after 2.2 update.
		$charset_collate = $wpdb->get_charset_collate();
		$table_name      = $wpdb->prefix . 'burst_goals';
		$sql             = "CREATE TABLE $table_name (
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
    ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating goals table: ' . $wpdb->last_error );
		}
	}

	/**
	 * Sanitize the orderby parameter.
	 */
	public function sanitize_orderby( string $orderby ): string {
		global $wpdb;

		// Get all columns from {$wpdb->prefix}burst_goals table.
		$table_name = $wpdb->prefix . 'burst_goals';
		if ( empty( $this->orderby_columns ) ) {
			$cols                  = $wpdb->get_results( "SHOW COLUMNS FROM $table_name", ARRAY_A );
			$this->orderby_columns = array_column( $cols, 'Field' );
		}

		// If $orderby is not in $col_names, set it to 'ID'.
		if ( ! in_array( $orderby, $this->orderby_columns, true ) ) {
			$orderby = 'ID';
		}

		return $orderby;
	}

	/**
	 *  Get predefined goals from the integrations list.
	 *
	 *  @param bool $skip_active_check Whether to skip checking if the plugin is active.
	 *  @return array<int, array{
	 *      id: string,
	 *      type: string,
	 *      description: string,
	 *      status: string,
	 *      server_side: bool,
	 *      url: string,
	 *      hook: string
	 *  }>
	 */
	public function get_predefined_goals( bool $skip_active_check = false ): array {
		$predefined_goals = [];
		foreach ( \Burst\burst_loader()->integrations->integrations as $plugin => $details ) {
			if ( ! isset( $details['goals'] ) ) {
				continue;
			}

			if ( ! $skip_active_check && ! \Burst\burst_loader()->integrations->plugin_is_active( $plugin ) ) {
				continue;
			}

			$predefined_goals = array_merge( $details['goals'], $predefined_goals );
		}
		return $predefined_goals;
	}

	/**
	 * Get list of goals
	 *
	 * @param array $args Optional arguments for filtering and pagination.
	 * @return Goal[] Array of Goal objects.
	 */
	public function get_goals( array $args = [] ): array {
		if ( ! $this->user_can_view() ) {
			return [];
		}

		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_goals';

		try {
			$default_args = [
				'status'  => 'all',
				'limit'   => 9999,
				'offset'  => 0,
				'orderby' => 'ID',
				'order'   => 'ASC',
			];

			// merge args.
			$args = wp_parse_args( $args, $default_args );

			// sanitize args.
			$args['order']   = $args['order'] === 'DESC' ? 'DESC' : 'ASC';
			$args['orderby'] = $this->sanitize_orderby( $args['orderby'] );
			$args['status']  = $this->sanitize_status( $args['status'] );
			$args['limit']   = (int) $args['limit'];
			$args['offset']  = (int) $args['offset'];

			$query = "SELECT * FROM {$table_name}";
			$where = [];
			if ( $args['status'] !== 'all' ) {
				$where[] = $wpdb->prepare( 'status = %s', $args['status'] );
			}
			if ( ! empty( $where ) ) {
				$query .= ' WHERE ' . implode( ' AND ', $where );
			}

			// can only be columns or DESC/ASC because of sanitizing.
			$query .= " ORDER BY {$args['orderby']} {$args['order']}";
			// can only be integer because of sanitizing.
			$query  .= " LIMIT {$args['offset']}, {$args['limit']}";
			$results = $wpdb->get_results( $query, ARRAY_A );

		} catch ( \Exception $e ) {
			self::error_log( $e->getMessage() );
			// If an exception is caught, assume the table does not exist.
			do_action( 'burst_install_tables' );
			return [];
		}

		$goals = array_reduce(
			$results,
			static function ( $accumulator, $current_value ) {
				$id = $current_value['ID'];
				unset( $current_value['ID'] );
				$accumulator[ $id ] = $current_value;
				return $accumulator;
			},
			[]
		);

		// loop through goals and add the fields and get then object for each goal.
		$objects = [];
		foreach ( $goals as $goal_id => $goal_item ) {
			$goal      = new Goal( $goal_id );
			$objects[] = $goal;
		}

		return $objects;
	}
}
