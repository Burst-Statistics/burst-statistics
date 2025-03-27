<?php defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );
if ( ! class_exists( 'burst_db_upgrade' ) ) {
	class burst_db_upgrade {
		private static $_this;
		private $cron_interval = MINUTE_IN_SECONDS;
		private $batch = 100000;

		public function __construct() {
			if ( isset( self::$_this ) ) {
				wp_die(
					burst_sprintf(
						'%s is a singleton class and you cannot create a second instance.',
						get_class( $this )
					)
				);
			}

			self::$_this = $this;

			add_action( 'burst_daily', array( $this, 'upgrade' ) );
			add_action( 'admin_init', array( $this, 'maybe_fire_upgrade' ) );
			add_action( "burst_upgrade_iteration", array( $this, "upgrade" ) );
			add_filter( 'burst_tasks', array( $this, 'add_progress_notice' ) );
		}

		/**
		 * Ensure upgrade progress even when Cron is not working, when the user visits the dashboard.
		 *
		 * @return void
		 */
		public function maybe_fire_upgrade(): void {
			if ( isset($_GET['page']) && $_GET['page'] === 'burst') {
				$this->upgrade();
			}
		}

		/**
		 * Add a notice about the progress to the admin dashboard in burst.
		 *
		 * @param array $warnings //array of warnings in burst.
		 *
		 * @return array
		 */
		public function add_progress_notice( array $warnings ): array {
			$progress = $this->get_progress();
			if ( $progress < 100 ) {
				$progress                     = round( $progress, 2 );
				$warnings[] = [
                    'id' => 'upgrade_progress',
                    'condition'  => [
                        'type' => 'serverside',
                        'function' => '!BURST()->db_upgrade->progress_complete'
                    ],
					'status'   => 'all',
                    'msg'         => burst_sprintf(
                                     // translators: %s: progress of the upgrade.
                                         __( 'An upgrade is running in the background, and is currently at %s.', 'burst-statistics' ),
                                         $progress . '%'
                                     ) . ' ' .
                                     __( 'For large databases this process may take a while. Your data will be tracked as usual.', 'burst-statistics' ),
                    'icon'        => 'open',
                    'dismissible' => false,
				];
			}

			return $warnings;
		}

        /**
         * If there is any upgrade running
         *
         * @return bool
         */
        public function progress_complete(): bool
        {
            return $this->get_progress() >= 100;
        }
		/**
		 * Get progress of the upgrade process
		 *
		 * @return float|int
		 */
		public function get_progress() {
			$total_upgrades     = $this->get_db_upgrades(burst_version );
			$remaining_upgrades = $total_upgrades;
			// check if all upgrades are done.
			$count_remaining_upgrades = 0;
			$intermediate_percentage  = 0;
			$intermediates            = array();
			foreach ( $remaining_upgrades as $upgrade ) {
				if ( get_option( "burst_db_upgrade_$upgrade" ) ) { // if any upgrade is not done.
					++$count_remaining_upgrades;
					// check if there's an intermediate progress count. If so, we add it as a percentage to the progress.
					$has_intermediate = get_transient( "burst_progress_$upgrade" );
					if ( $has_intermediate ) {
						$intermediates[ $upgrade ] = $has_intermediate;
					}
				}
			}
			$intermediate         = reset( $intermediates );
			$count_total_upgrades = count( $total_upgrades );
			// upgrade percentage for one upgrade is 100 / total upgrades.
			$upgrade_percentage_one_upgrade = $count_total_upgrades === 0 ? 100 : 100 / $count_total_upgrades;
			if ( $intermediate ) {
				$intermediate_percentage = $intermediate * $upgrade_percentage_one_upgrade;
			}
			$count_total_upgrades = 0 === $count_total_upgrades ? 1 : $count_total_upgrades;

			$percentage           = 100 - ( $count_remaining_upgrades / $count_total_upgrades ) * 100;
			$percentage           = $percentage + $intermediate_percentage;
			if ( $percentage > 100 ) {
				$percentage = 100;
			}

			return $percentage;
		}

		/**
		 * Init the upgrades
		 * - upgrade only if admin is logged in
		 * - only one upgrade at a time
		 *
		 * return void
		 */
		public function upgrade() {

			if ( defined( 'BURST_NO_UPGRADE' ) && BURST_NO_UPGRADE ) {
				return;
			}

			if ( ! burst_admin_logged_in() ) {
				return;
			}

			$upgrade_running = get_transient( 'burst_upgrade_running' );
			if ( $upgrade_running ) {
				return;
			}
			set_transient( 'burst_upgrade_running', true, 60 );
			// check if we need to upgrade
			$db_upgrades = $this->get_db_upgrades();
			// check if all upgrades are done
			$do_upgrade = false;
			foreach ( $db_upgrades as $upgrade ) {
				if ( get_option( "burst_db_upgrade_$upgrade" ) == true ) { // if any upgrade is not done
					$do_upgrade = $upgrade;
					// if we need to upgrade break the loop
					break;
				}
			}

			if ( WP_DEBUG ) {
				// log all upgrades that still need to be done
				foreach ( $db_upgrades as $upgrade ) {
					if ( get_option( "burst_db_upgrade_$upgrade" ) == true ) {
						burst_error_log( "Upgrade $upgrade still needs to be done." );
					}
				}
			}

            //ensure that the tasks get updated with the continuing upgrade process
            BURST()->tasks->schedule_task_validation();

			// only one upgrade at a time
			if ( 'bounces' === $do_upgrade ) {
				$this->upgrade_bounces();
			}
			if ( 'goals_remove_columns' === $do_upgrade ) {
				$this->upgrade_goals_remove_columns();
			}
			if ( 'goals_set_conversion_metric' === $do_upgrade ) {
				$this->upgrade_goals_set_conversion_metric();
			}
			if ( 'drop_user_agent' === $do_upgrade  ) {
				$this->upgrade_drop_user_agent();
			}
			if ( 'empty_referrer_when_current_domain' === $do_upgrade ) {
				$this->upgrade_empty_referrer_when_current_domain();
			}
			if ( 'strip_domain_names_from_entire_page_url' === $do_upgrade ) {
				$this->upgrade_strip_domain_names_from_entire_page_url();
			}
			if ( 'summary_table' === $do_upgrade ) {
				BURST()->summary->upgrade_summary_table_alltime();
			}
			if ( 'create_lookup_tables' === $do_upgrade ) {
				$this->create_lookup_tables();
			}
			if ( 'init_lookup_ids' === $do_upgrade ) {
				$this->initialize_lookup_ids();
			}
			if ( 'upgrade_lookup_tables' === $do_upgrade ) {
				$this->upgrade_lookup_tables();
			}
			if ( 'upgrade_lookup_tables_drop_columns' === $do_upgrade ) {
				$this->upgrade_lookup_tables_drop_columns();
			}

			if ( 'drop_page_id_column' === $do_upgrade ) {
				$this->upgrade_drop_page_id_column();
			}

			if ( 'rename_entire_page_url_column' === $do_upgrade ) {
				$this->change_column_name_entire_page_url();
			}

			if ( 'drop_path_from_parameters_column' === $do_upgrade ) {
				$this->drop_path_from_parameters_column();
			}

			if ( $this->get_progress()<100 ) {
				wp_schedule_single_event(time() + $this->cron_interval , "burst_upgrade_iteration");
			} else {
				wp_clear_scheduled_hook("burst_upgrade_iteration");
			}

			delete_transient( 'burst_upgrade_running' );
		}

		/**
		 * Get the upgrades
		 *
		 * @return array
		 */
		private function get_db_upgrades( $select_version = 'all' ) {
			$upgrades = apply_filters(
				'burst_db_upgrades',
				[
					'1.4.2.1' => [
						'bounces',
						'goals_remove_columns',
					],
					'1.5.2' => [
						'goals_set_conversion_metric',
					],
					'1.5.3' => [
						'empty_referrer_when_current_domain',
						'strip_domain_names_from_entire_page_url',
						'drop_user_agent',
					],
					'1.7.0' => [
						'summary_table',
						'create_lookup_tables',
						'init_lookup_ids',
						'upgrade_lookup_tables',

						// the below upgrades are handled within the create and upgrade look up tables functions, but are added here for the progress calculation.
						'create_lookup_tables_browser',
						'create_lookup_tables_browser_version',
						'create_lookup_tables_platform',
						'create_lookup_tables_device',
						'upgrade_lookup_tables_browser',
						'upgrade_lookup_tables_browser_version',
						'upgrade_lookup_tables_platform',
						'upgrade_lookup_tables_device',
						// end progress only upgrade items.

						'upgrade_lookup_tables_drop_columns',
						'drop_page_id_column',
					],
					'1.7.1' => [
						'rename_entire_page_url_column',
						'drop_path_from_parameters_column',
						],
				]
			);

			if ( $select_version === 'all' ) {
				$all_upgrades = array();
				foreach ( $upgrades as $upgrade_version => $upgrade ) {
					$all_upgrades = array_merge( $all_upgrades, $upgrade );
				}
				return $all_upgrades;
			}

			$all_upgrades = array();
			foreach ( $upgrades as $upgrade_version => $upgrade ) {
				if ( version_compare( $upgrade_version, $select_version, '>=' ) ) {
					$all_upgrades = array_merge( $all_upgrades, $upgrade );
				}
			}
			return $all_upgrades;
		}

		private function upgrade_bounces() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			if ( ! get_option( 'burst_db_upgrade_bounces' ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_statistics';

			$sql = "UPDATE $table_name
					SET bounce = 0
					WHERE
					  (session_id IN (
					    SELECT session_id
					    FROM (
					      SELECT session_id
					      FROM $table_name
					      GROUP BY session_id
					      HAVING COUNT(*) >= 2
					    ) as t
					  ))";

			$result = $wpdb->query( $sql );
			if ( $result === false ) {
				return;
			}

			$sql    = "UPDATE $table_name
					SET bounce = 0
					WHERE bounce = 1 AND time_on_page > 5000";
			$result = $wpdb->query( $sql );

			// if query is successful
			if ( $result !== false ) {
				delete_option( 'burst_db_upgrade_bounces' );
			} else {
				burst_error_log( 'db upgrade bounces failed' );
			}
		}

		private function upgrade_goals_remove_columns() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			if ( ! get_option( 'burst_db_upgrade_goals_remove_columns' ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_goals';
			// check if columns exist first
			$columns = $wpdb->get_col( "DESC $table_name", 0 );
			if ( ! in_array( 'event', $columns ) || ! in_array( 'action', $columns ) ) {
				delete_option( 'burst_db_upgrade_goals_remove_columns' );
				return;
			}

			// run an sql query to remove the columns `event` and `action`
			$sql = "ALTER TABLE $table_name
					DROP COLUMN `event`,
					DROP COLUMN `action`";

			$remove = $wpdb->query( $sql );

			if ( $remove !== false ) {
				delete_option( 'burst_db_upgrade_goals_remove_columns' );
			}
		}

		private function upgrade_goals_set_conversion_metric() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			$option_name = 'burst_db_upgrade_goals_set_conversion_metric';
			if ( ! get_option( $option_name ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_goals';

			// set conversion_metric to 'pageviews' for all goals
			$sql = "UPDATE $table_name
					SET conversion_metric = 'pageviews'
					WHERE conversion_metric IS NULL OR conversion_metric = ''";

			$add_conversion_metric = $wpdb->query( $sql );

			if ( $add_conversion_metric !== false ) {
				delete_option( $option_name );
			}
		}

		private function upgrade_drop_user_agent() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}

			$option_name = 'burst_db_upgrade_drop_user_agent';
			if ( ! get_option( $option_name ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_statistics';

			// check if columns exist first
			$columns = $wpdb->get_col( "DESC $table_name", 0 );
			if ( ! in_array( 'user_agent', $columns, true ) ) {
				delete_option( 'burst_db_upgrade_drop_user_agent' );
				return;
			}

			// drop user_agent column
			$sql = "ALTER TABLE $table_name
					DROP COLUMN `user_agent`";

			$drop_user_agent = $wpdb->query( $sql );

			if ( $drop_user_agent !== false ) {
				delete_option( $option_name );
			}
		}

		private function upgrade_empty_referrer_when_current_domain() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			$option_name = 'burst_db_upgrade_empty_referrer_when_current_domain';
			if ( ! get_option( $option_name ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_statistics';
			$home_url   = home_url();
			// empty referrer when starts with current domain
			$sql = "UPDATE $table_name
					SET referrer = null
					WHERE referrer LIKE '$home_url%'";

			$empty_referrer_when_current_domain = $wpdb->query( $sql );

			if ( $empty_referrer_when_current_domain !== false ) {
				delete_option( $option_name );
			}
		}

		private function upgrade_strip_domain_names_from_entire_page_url() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			$option_name = 'burst_db_upgrade_strip_domain_names_from_entire_page_url';
			if ( ! get_option( $option_name ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_statistics';
			// make sure it does not end with slash
			$home_url = untrailingslashit( home_url() );

			// strip home url from entire_page_url where it starts with home_url
			$sql = "UPDATE $table_name
					SET entire_page_url = REPLACE(entire_page_url, '$home_url', '')
					WHERE entire_page_url LIKE '$home_url%'";

			$strip_domain_names_from_entire_page_url = $wpdb->query( $sql );

			if ( $strip_domain_names_from_entire_page_url !== false ) {
				delete_option( $option_name );
			}
		}

		/**
		 * Upgrade statistics table to use lookup tables instead.
		 *
		 * @return void
		 */
		private function create_lookup_tables(): void {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			global $wpdb;
			$items = array( 'device', 'browser', 'browser_version', 'platform' );
			// check if required tables exists.
			$selected_item = false;
			foreach ( $items as $item ) {
				$table = $item . 's';
				// check if table exists.
				if ( ! $this->table_exists( 'burst_' . $table ) ) {
					return;
				}

				// check if this table already was upgraded.
				if ( ! get_option( "burst_db_upgrade_create_lookup_tables_$item" ) ) {
					continue;
				}

				$selected_item = $item;
				break;
			}

			if ( $selected_item ) {
				//check if the $selected_item column exists in the wp_burst_statistics table
				if ( !$this->column_exists( 'burst_statistics', $selected_item) ) {
					// already dropped, so mark this one as completed.
					delete_option( "burst_db_upgrade_create_lookup_tables_$selected_item" );

					//if all other lookup tables also have been dropped, stop all upgrades, as there's nothing to upgrade
					if (
						!get_option('burst_db_upgrade_upgrade_lookup_tables_browser') &&
						!get_option('burst_db_upgrade_upgrade_lookup_tables_browser_version') &&
						!get_option('burst_db_upgrade_upgrade_lookup_tables_platform') &&
						!get_option('burst_db_upgrade_upgrade_lookup_tables_device')
					) {
						delete_option( "burst_db_upgrade_create_lookup_tables" );
						delete_option( "burst_db_upgrade_init_lookup_ids" );
						delete_option( "burst_db_upgrade_upgrade_lookup_tables" );
						delete_option( "burst_db_upgrade_upgrade_lookup_tables_drop_columns" );
					}
					return;
				}

				$sql = "INSERT INTO {$wpdb->prefix}burst_{$selected_item}s (name) SELECT DISTINCT $selected_item FROM {$wpdb->prefix}burst_statistics
						WHERE $selected_item IS NOT NULL AND
						    $selected_item NOT IN (
						    SELECT name
						    FROM {$wpdb->prefix}burst_{$selected_item}s
						);";
				$wpdb->query( $sql );
				delete_option( "burst_db_upgrade_create_lookup_tables_$selected_item" );
			}

			// check if all items have been created.
			$missing_items = array();
			foreach ( $items as $item ) {
				// check if table is updated with data yet.
				if ( ! get_option( "burst_db_upgrade_create_lookup_tables_$item" ) ) {
					continue;
				}
				$missing_items[] = $item;
			}

			// stop upgrading if all have been completed.
			if ( count( $missing_items ) === 0 ) {
				delete_option( 'burst_db_upgrade_create_lookup_tables' );
			}
		}

		/**
		 * To reliably be able to check if the upgrade is completed, we set an initial bogus value for the lookup id's.
		 * @return void
		 */
		private function initialize_lookup_ids(){
			if ( ! burst_admin_logged_in() ) {
				return;
			}

			// only start if the lookup tables have been created.
			if ( get_option( 'burst_db_upgrade_create_lookup_tables' ) ) {
				return;
			}

			if ( ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
				return;
			}

			global $wpdb;
			$wpdb->query("UPDATE {$wpdb->prefix}burst_statistics SET 
                               browser_id = 999999, 
                               browser_version_id = 999999, 
                               platform_id = 999999, 
                               device_id = 999999"
			);

			delete_option( 'burst_db_upgrade_init_lookup_ids' );
		}

		/**
		 * Upgrade existing table to load id's from lookup tables
		 *
		 * @return void
		 */
		private function upgrade_lookup_tables(): void {
			if ( ! burst_admin_logged_in() ) {
				return;
			}

			// only start if the lookup tables have been created.
			if ( get_option( 'burst_db_upgrade_create_lookup_tables' ) ) {
				return;
			}

			if ( get_option( 'burst_db_upgrade_init_lookup_ids' ) ) {
				return;
			}

			if ( ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
				return;
			}

			global $wpdb;
			// check if required tables exists.
			$items         = array( 'browser', 'browser_version', 'device', 'platform' );
			$selected_item = false;
			foreach ( $items as $item ) {
				$table = $item . 's';
				// check if table exists. If not, start the create upgrade again.
				if ( ! $this->table_exists( 'burst_' . $table ) ) {
					update_option( "burst_db_upgrade_create_lookup_tables_$item", true, false );
					update_option( 'burst_db_upgrade_create_lookup_tables', true, false );
					return;
				}

				// check if this table contains data.
				// if not, ensure that the update for this table is started again.
				$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_{$item}s" );
				if ( 0 === $count ) {
					update_option( "burst_db_upgrade_create_lookup_tables_$item", true, false );
					update_option( 'burst_db_upgrade_create_lookup_tables', true, false );
					return;
				}

				// check if this table already was upgraded.
				if ( ! get_option( "burst_db_upgrade_upgrade_lookup_tables_$item" ) ) {
					continue;
				}

				// check if column exists.
				$columns = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics" );
				if ( ! in_array( $item . '_id', $columns, true ) ) {
					// already dropped, so mark this one as completed.
					delete_option( "burst_db_upgrade_upgrade_lookup_tables_$item" );
					continue;
				}
				$selected_item = $item;
			}

			// we have lookup tables with values. Now we can upgrade the statistics table.
			if ( $selected_item ) {
				$batch = $this->batch;
				$selected_item = $this->sanitize_type( $selected_item );
				$start = microtime( true );
				// check what's still to do.
				$remaining_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics where {$selected_item}_id = 999999" );
				$total_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics" );
				$done_count = $total_count - $remaining_count;

				// store progress for $selected_item, to show it in the progress notice
				$progress  = 0 === $total_count ? 1 : $done_count / $total_count;
				$progress = round($progress, 2);

				set_transient( "burst_progress_upgrade_lookup_tables_$selected_item", $progress, HOUR_IN_SECONDS);
				// measure time elapsed during query.
				if ( $done_count < $total_count ) {
					$sql = "UPDATE {$wpdb->prefix}burst_statistics AS t
						JOIN (
						    SELECT p.{$selected_item}, p.ID, COALESCE(m.ID, 0) as {$selected_item}_id
						    FROM {$wpdb->prefix}burst_statistics p 
						    LEFT JOIN {$wpdb->prefix}burst_{$selected_item}s m ON p.{$selected_item} = m.name
						    WHERE p.{$selected_item}_id = 999999
    						LIMIT $batch
						) AS s ON t.ID = s.ID
						SET t.{$selected_item}_id = s.{$selected_item}_id;";
					$wpdb->query( $sql );

					//completed
					$end               = microtime( true );
					$time_elapsed_secs = $end - $start;
				} else {
					//completed upgrade
					delete_option( "burst_db_upgrade_upgrade_lookup_tables_$selected_item" );
					delete_transient( "burst_progress_upgrade_lookup_tables_$selected_item");
				}
			}

			// check if all items have been upgraded.
			$total_not_completed = 0;
			foreach ( $items as $item ) {
				$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics WHERE {$item}_id = 999999 " );
				if ( 0 === $count ) {
					delete_option( "burst_db_upgrade_upgrade_lookup_tables_$item" );
					delete_transient( "burst_progress_upgrade_lookup_tables_$item");
				}
				$total_not_completed += $count;
			}

			// stop upgrading if all have been completed.
			if ( 0 === $total_not_completed ) {
				delete_option( 'burst_db_upgrade_upgrade_lookup_tables' );
			}
		}

		/**
		 * @param string $type
		 *
		 * @return string
		 */
		private function sanitize_type( string $type ): string {
			$types = array( 'browser', 'browser_version', 'device', 'platform' );
			if ( ! in_array( $type, $types, true ) ) {
				return 'browser';
			}
			return $type;
		}

		/**
		 * Drop the columns that are now obsolete and moved to the lookup tables.
		 *
		 * @return void
		 */
		private function upgrade_lookup_tables_drop_columns() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}

			// check if required upgrade has been completed.
			if ( get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
				return;
			}

			global $wpdb;
			$drop_columns = array( 'browser', 'browser_version', 'device_resolution', 'device', 'platform' );

			// check if columns exist first.
			$columns    = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics", 0 );
			$drop_array = array();
			foreach ( $drop_columns as $drop_column ) {
				if ( get_option( "burst_db_upgrade_upgrade_lookup_tables_$drop_column" ) ) {
					continue;
				}
				if ( in_array( $drop_column, $columns, true ) ) {
					$drop_array[] = "DROP COLUMN `$drop_column`";
				}
			}

			$drop_sql = implode( ', ', $drop_array );
			$sql      = "ALTER TABLE {$wpdb->prefix}burst_statistics $drop_sql";
			$success  = $wpdb->query( $sql );

			// check if all columns have been dropped.
			if ( $success ) {
                delete_option( 'burst_db_upgrade_upgrade_lookup_tables_drop_columns' );
			}
		}
		private function upgrade_drop_page_id_column() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}
			if ( ! get_option( 'burst_db_upgrade_drop_page_id_column' ) ) {
				return;
			}

			global $wpdb;
			$table_name = $wpdb->prefix . 'burst_statistics';
			// check if columns exist first
			$columns = $wpdb->get_col( "DESC $table_name", 0 );
			if ( ! in_array( 'page_id', $columns ) ) {
				delete_option( 'burst_db_upgrade_drop_page_id_column' );
				return;
			}

			// run an sql query to remove the columns `event` and `action`
			$sql = "ALTER TABLE $table_name DROP COLUMN `page_id`";

			$remove = $wpdb->query( $sql );

			if ( $remove !== false ) {
				delete_option( 'burst_db_upgrade_drop_page_id_column' );
			}
		}

		/**
		 * Update the entire_page_url column to the new name, paramaters, and change to TEXT
		 *
		 * @return void
		 */
		public function change_column_name_entire_page_url(): void {

			global $wpdb;
			$table = $wpdb->prefix . 'burst_statistics';
			$sql = "ALTER TABLE $table MODIFY parameters TEXT;";
			$wpdb->query( $sql );
			delete_option( 'burst_db_upgrade_rename_entire_page_url_column' );
		}

		public function drop_path_from_parameters_column(): void {
			//check if column already upgraded.
			if ( ! get_option( 'burst_db_upgrade_drop_path_from_parameters_column' ) ) {
				return;
			}

            if ( !$this->column_exists('burst_statistics', 'entire_page_url') ) {
                delete_option('burst_db_upgrade_drop_path_from_parameters_column');
                delete_option('burst_db_upgrade_column_offset');
                delete_transient( "burst_progress_drop_path_from_parameters_column");
                return;
            }

			global $wpdb;
			$batch_size = 50000;
			$table = $wpdb->prefix . 'burst_statistics';
			$offset = get_option('burst_db_upgrade_column_offset', 0);
			$sql = "UPDATE $table
					SET `parameters` = IF(LOCATE('?', `entire_page_url`) > 0, SUBSTRING(`entire_page_url`, LOCATE('?', `entire_page_url`)), '')
					WHERE ID IN (
					    SELECT ID FROM (
					        SELECT id FROM $table LIMIT $offset, $batch_size
					    ) AS temp
					);";
			$wpdb->query( $sql );
			$offset += $batch_size;
			update_option( 'burst_db_upgrade_column_offset', $offset );
			$total = $wpdb->get_var("SELECT COUNT(*) FROM $table");
			$progress = $total > 0 ? round( $offset / $total, 2 ) : 1;
			set_transient( "burst_progress_drop_path_from_parameters_column", $progress, HOUR_IN_SECONDS);

			if ( $offset >= $total ) {
				$wpdb->query("ALTER TABLE {$wpdb->prefix}burst_statistics DROP COLUMN entire_page_url");
				delete_option('burst_db_upgrade_column_offset');
                delete_option('burst_db_upgrade_drop_path_from_parameters_column');
				delete_transient( "burst_progress_drop_path_from_parameters_column");
			}
		}


		/**
		 * Check if a table exists
		 *
		 * @param string $table //the table to check.
		 *
		 * @return bool
		 */
		private function table_exists( string $table ): bool {
			global $wpdb;
			$table = $wpdb->prefix . sanitize_title( $table );
			return $wpdb->query( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		}

		/**
		 * Check if a table has a specific column
		 *
		 * @param string $table_name
		 * @param string $column_name
		 *
		 * @return bool
		 */
		public function column_exists( string $table_name, string $column_name): bool {
			global $wpdb;
			$table_name = $wpdb->prefix . $table_name;
			$columns = $wpdb->get_col( "DESC $table_name" );
			return in_array( $column_name, $columns, true );
		}

	}
}
