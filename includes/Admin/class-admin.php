<?php
namespace Burst\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\App\App;
use Burst\Admin\Archive\Archive;
use Burst\Admin\Burst_Wp_Cli\Burst_Wp_Cli;
use Burst\Admin\Cron\Cron;
use Burst\Admin\Dashboard_Widget\Dashboard_Widget;
use Burst\Admin\DB_Upgrade\DB_Upgrade;
use Burst\Admin\Debug\Debug;
use Burst\Admin\Mailer\Mail_Reports;
use Burst\Admin\Posts\Posts;
use Burst\Admin\Statistics\Goal_Statistics;
use Burst\Admin\Statistics\Statistics;
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Goals\Goals;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;
use Burst\Admin\Capability\Capability;

class Admin {
	use Database_Helper;
	use Helper;
	use Admin_Helper;
	use Save;

	public Tasks $tasks;
	public Statistics $statistics;
	public App $app;

	/**
	 * Initialize the admin class
	 */
	public function init(): void {
		/**
		 * Tell the consent API we're following the api
		 */
		$plugin = BURST_PLUGIN;
		add_filter( "wp_consent_api_registered_$plugin", '__return_true' );
		add_filter( "plugin_action_links_$plugin", [ $this, 'plugin_settings_link' ] );
		add_filter( "network_admin_plugin_action_links_$plugin", [ $this, 'plugin_settings_link' ] );

		// deactivating.
		add_action( 'admin_footer', [ $this, 'deactivate_popup' ], 40 );
		add_action( 'admin_init', [ $this, 'listen_for_deactivation' ], 40 );
		add_action( 'admin_init', [ $this, 'add_privacy_info' ], 10 );

		// remove tables on multisite uninstall.
		add_filter( 'wpmu_drop_tables', [ $this, 'ms_remove_tables' ], 10, 2 );
		add_filter( 'burst_do_action', [ $this, 'maybe_delete_all_data' ], 10, 3 );
		add_action( 'burst_after_updated_goals', [ $this, 'create_js_file' ], 10, 1 );
		add_action( 'burst_after_saved_fields', [ $this, 'create_js_file' ], 10, 1 );
		add_action( 'burst_daily', [ $this, 'create_js_file' ] );
		add_action( 'burst_daily', [ $this, 'detect_malicious_data' ] );
		add_action( 'burst_dismiss_task', [ $this, 'dismiss_malicious_data_notice' ], 10, 1 );
		add_action( 'burst_dismiss_task', [ $this, 'dismiss_php_error_notice' ], 10, 1 );
		add_action( 'wp_initialize_site', [ $this, 'create_js_file' ], 10, 1 );
		add_action( 'admin_init', [ $this, 'activation' ] );
		add_action( 'burst_activation', [ $this, 'setup_defaults' ], 20, 1 );

		add_action( 'burst_activation', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'after_reset_stats', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'wp_initialize_site', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_upgrade_before', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_cron_table_upgrade', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_daily', [ $this, 'validate_tasks' ] );
		add_action( 'burst_validate_tasks', [ $this, 'validate_tasks' ] );
		add_action( 'plugins_loaded', [ $this, 'init_wpcli' ] );
		add_action( 'burst_scheduled_task_fix', [ $this, 'clean_malicious_data' ] );
		add_action( 'burst_daily', [ $this, 'test_database_tables' ] );
		add_action( 'burst_attempt_database_fix', [ $this, 'test_database_tables' ] );
		add_action( 'burst_weekly', [ $this, 'long_term_user_deal' ] );
		add_action( 'burst_weekly', [ $this, 'cleanup_bf_dismissed_tasks' ] );
		add_action( 'burst_daily', [ $this, 'cleanup_php_error_notices' ] );
		$recalculate_cron_interval = apply_filters( 'burst_recalculate_cron_interval', 'burst_every_ten_minutes' );
		add_action( $recalculate_cron_interval, [ $this, 'update_last_statistic_data' ] );
		add_action( 'burst_recalculate_known_uids_cron', [ $this, 'update_known_uids_table' ] );
		add_action( 'burst_recalculate_bounces_cron', [ $this, 'recalculate_bounces' ] );
		add_action( 'burst_recalculate_first_time_visits_cron', [ $this, 'recalculate_first_time_visits' ] );

		add_filter( 'burst_menu', [ $this, 'add_ecommerce_menu_item' ] );

		$upgrade = new Upgrade();
		$upgrade->init();
		$db_upgrade = new DB_Upgrade();
		$db_upgrade->init();
		$cron = new Cron();
		$cron->init();

		$archive = new Archive();
		$archive->init();

		$goal_statistics = new Goal_Statistics();
		$goal_statistics->init();
		$this->statistics = new Statistics();
		$this->statistics->init();
		$reports = new Mail_Reports();
		$reports->init();
		$this->app = new App();
		$this->app->init();

		$posts = new Posts();
		$posts->init();

		$review = new Review();
		$review->init();
		$this->tasks = new Tasks();
		$widget      = new Dashboard_Widget();
		$widget->init();

		$debug = new Debug();
		$debug->init();

		$milestones = new Milestones();
		$milestones->init();

		if ( defined( 'BURST_BLUEPRINT' ) && ! get_option( 'burst_demo_data_installed' ) ) {
			add_action( 'init', [ $this, 'install_demo_data' ] );
			update_option( 'burst_demo_data_installed', true, false );
		}
	}

	/**
	 * Cron to update the last 10 minutes of user data for bounces and first_time_visits.
	 */
	public function update_last_statistic_data(): void {
		if ( ! wp_next_scheduled( 'burst_recalculate_known_uids_cron' ) ) {
			wp_schedule_single_event( time() + 10, 'burst_recalculate_known_uids_cron' );
		}

		if ( ! wp_next_scheduled( 'burst_recalculate_bounces_cron' ) ) {
			wp_schedule_single_event( time() + 60, 'burst_recalculate_bounces_cron' );
		}

		if ( ! wp_next_scheduled( 'burst_recalculate_first_time_visits_cron' ) ) {
			wp_schedule_single_event( time() + 120, 'burst_recalculate_first_time_visits_cron' );
		}
	}

	/**
	 * Recalculate first_time_visit flags
	 *
	 * Marks the earliest statistic for each UID as first_time_visit = 1
	 * Runs daily to keep data accurate without impacting real-time performance
	 *
	 * @hooked burst_recalculate_first_time_visits_cron
	 */
	public function recalculate_first_time_visits(): void {
		global $wpdb;

		$last_update    = get_option( 'burst_last_first_time_visit_update', time() - 15 * MINUTE_IN_SECONDS );
		$default_cutoff = time() - apply_filters( 'burst_cron_update_range_seconds', 15 * MINUTE_IN_SECONDS );
		$time_cutoff    = ( $last_update < $default_cutoff ) ? $last_update : $default_cutoff;

		// Mark as first-time visit if:
		// 1. UID is NOT in known_uids, OR.
		// 2. UID's first_seen timestamp is >= time_cutoff (meaning they're new in this batch).
		$wpdb->query(
			$wpdb->prepare(
				"
        UPDATE {$wpdb->prefix}burst_statistics bs
        INNER JOIN (
            SELECT curr.uid, MIN(curr.time) AS first_time
            FROM {$wpdb->prefix}burst_statistics curr
            LEFT JOIN {$wpdb->prefix}burst_known_uids known ON curr.uid = known.uid
            WHERE curr.time >= %d
              AND curr.first_time_visit = 0
              AND (known.uid IS NULL OR known.first_seen >= %d)
            GROUP BY curr.uid
        ) first_visits ON bs.uid = first_visits.uid 
                       AND bs.time = first_visits.first_time
        SET bs.first_time_visit = 1
        WHERE bs.first_time_visit = 0
    ",
				$time_cutoff,
				$time_cutoff
			)
		);

		update_option( 'burst_last_first_time_visit_update', time(), false );
	}

	/**
	 * Update incrementail UIDs table.
	 */
	public function update_known_uids_table(): void {
		global $wpdb;
		// Get sync cutoff (default: last 10 minutes of new data to process).
		$last_sync      = get_option( 'burst_last_known_uids_sync', time() - 15 * MINUTE_IN_SECONDS );
		$default_cutoff = time() - apply_filters( 'burst_cron_update_range_seconds', 15 * MINUTE_IN_SECONDS );
		$sync_cutoff    = ( $last_sync < $default_cutoff ) ? $last_sync : $default_cutoff;

		// Cleanup threshold: remove UIDs not seen in 31+ days.
		$cleanup_cutoff = time() - ( 31 * DAY_IN_SECONDS );

		// Step 1: Add/update UIDs from recent statistics (last 10-15 minutes).
		$wpdb->query(
			$wpdb->prepare(
				"
        INSERT INTO {$wpdb->prefix}burst_known_uids (uid, first_seen, last_seen)
        SELECT uid, MIN(time) as first_seen, MAX(time) as last_seen
        FROM {$wpdb->prefix}burst_statistics
        WHERE time >= %d
        GROUP BY uid
        ON DUPLICATE KEY UPDATE 
            first_seen = LEAST(first_seen, VALUES(first_seen)),
            last_seen = GREATEST(last_seen, VALUES(last_seen))
    ",
				$sync_cutoff
			)
		);

		// Step 2: Remove UIDs not seen in 31+ days (cleanup old visitors).
		$wpdb->query(
			$wpdb->prepare(
				"
        DELETE FROM {$wpdb->prefix}burst_known_uids
        WHERE last_seen < %d
    ",
				$cleanup_cutoff
			)
		);

		update_option( 'burst_last_known_uids_sync', time(), false );
	}

	/**
	 * Recalculate bounces using until last non-bounce
	 */
	public function recalculate_bounces(): void {
		$last_update    = get_option( 'burst_last_bounces_update', time() - 15 * MINUTE_IN_SECONDS );
		$default_cutoff = time() - apply_filters( 'burst_cron_update_range_seconds', 15 * MINUTE_IN_SECONDS );
		$time_cutoff    = ( $last_update < $default_cutoff ) ? $last_update : $default_cutoff;
		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}burst_statistics bs
        INNER JOIN (
            SELECT session_id
            FROM {$wpdb->prefix}burst_statistics
            WHERE time > %d
            GROUP BY session_id
            HAVING COUNT(*) > 1
                OR MAX(time_on_page) > 5000 -- long page time means engaged
        ) nb ON bs.session_id = nb.session_id
        SET bs.bounce = 0
        WHERE bs.bounce = 1",
				$time_cutoff
			)
		);
		update_option( 'burst_last_bounces_update', time(), false );
	}

	/**
	 * Add ecommerce menu item to the admin menu
	 *
	 * @param array $menu_items The existing menu items.
	 * @return array The modified menu items including the ecommerce menu item.
	 */
	public function add_ecommerce_menu_item( array $menu_items ): array {
		$should_load_ecommerce = \Burst\burst_loader()->integrations->should_load_ecommerce();

		if ( ! $should_load_ecommerce || ! $this->has_admin_access() || ! $this->user_can_view_sales() ) {
			return $menu_items;
		}

		$ecommerce_menu_item = [
			'id'             => 'sales',
			'title'          => __( 'Sales', 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items'     => [],
			'capabilities'   => 'view_sales_burst_statistics',
			'menu_slug'      => 'burst#/sales',
			'show_in_admin'  => true,
			'pro'            => true,
			'shareable'      => true,
		];

		// Put ecommerce menu item before the id: settings menu item.
		$settings_index = null;
		foreach ( $menu_items as $index => $item ) {
			if ( isset( $item['id'] ) && 'settings' === $item['id'] ) {
				$settings_index = $index;
				break;
			}
		}

		if ( null !== $settings_index ) {
			array_splice( $menu_items, $settings_index, 0, [ $ecommerce_menu_item ] );
		} else {
			$menu_items[] = $ecommerce_menu_item;
		}

		return $menu_items;
	}

	/**
	 * Remove CM and BF tasks from the permanently dismissed array if it is february.
	 */
	public function cleanup_bf_dismissed_tasks(): void {
		if ( (int) gmdate( 'n' ) === 2 ) {
			\Burst\burst_loader()->admin->tasks->undismiss_task( 'bf_notice' );
			\Burst\burst_loader()->admin->tasks->undismiss_task( 'cm_notice' );
		}
	}

	/**
	 * Run a daily check if all database tables exist.
	 */
	public function test_database_tables(): void {
		// do not run if the plugin is just activated.
		$plugin_activated_time = get_option( 'burst_activation_time', 0 );
		$one_hour_ago          = time() - HOUR_IN_SECONDS;
		if ( $plugin_activated_time === 0 || $one_hour_ago < $plugin_activated_time ) {
			return;
		}

		$table_names    = $this->get_table_list();
		$missing_tables = [];
		foreach ( $table_names as $table_name ) {
			if ( ! $this->table_exists( $table_name ) ) {
				$missing_tables[] = $table_name;
			}
		}

		if ( ! empty( $missing_tables ) ) {
			$first_attempt = ! get_option( 'burst_attempt_database_fix' );
			if ( $first_attempt ) {
				// first, try installing them.
				$this->run_table_init_hook();
				update_option( 'burst_attempt_database_fix', true, false );
				wp_schedule_single_event( time() + 10, 'burst_attempt_database_fix' );
			} else {
				update_option( 'burst_missing_tables', implode( ',', $missing_tables ), false );
			}
		} else {
			delete_option( 'burst_missing_tables' );
			delete_option( 'burst_attempt_database_fix' );
		}
	}

	/**
	 * Users who are using the plugin for at least a year get a one time trial offer.
	 */
	public function long_term_user_deal(): void {
		if ( ! defined( 'BURST_FREE' ) ) {
			return;
		}

		$activated = get_option( 'burst_activation_time', 0 );
		if ( $activated === 0 ) {
			return;
		}

		$one_year_ago = time() - YEAR_IN_SECONDS;
		if ( $activated > $one_year_ago && ! get_option( 'burst_trial_offered' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'trial_offer_loyal_users' );
			update_option( 'burst_trial_offered', true, false );
		}
	}

	/**
	 * Initialize WP CLI
	 *
	 * @throws \Exception //exception.
	 */
	public function init_wpcli(): void {
		if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
			return;
		}

		// Register the command.
		\WP_CLI::add_command( 'burst', Burst_Wp_Cli::class );
	}

	/**
	 * Check if there is anomalous data in the past 24 hours, over 1000 requests from one visitor.
	 */
	public function detect_malicious_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		$interval_days = (int) apply_filters( 'burst_data_cleanup_interval_days', 1 );
		$data_treshold = (int) apply_filters( 'burst_data_cleanup_treshold', 1000 );
		global $wpdb;
		$uids = $wpdb->get_results(
			$wpdb->prepare(
				"
            SELECT uid, COUNT(*) as record_count
            FROM {$wpdb->prefix}burst_statistics
            WHERE time > UNIX_TIMESTAMP(NOW() - INTERVAL %d DAY)
            GROUP BY uid
            HAVING COUNT(*) > %d LIMIT 1;
        ",
				$interval_days,
				$data_treshold
			),
			ARRAY_A
		);

		if ( ! empty( $uids ) ) {

			$uids = array_map(
				function ( $item ) {
					return $item['uid'];
				},
				$uids
			);
			// get first $uid.
			$uid = reset( $uids );
			update_option( 'burst_cleanup_uid', $uid, false );
			$total_hits   = array_sum( wp_list_pluck( $uids, 'record_count' ) );
			$average_hits = round( $total_hits / count( $uids ) );
			update_option( 'burst_cleanup_uid_visits', $average_hits, false );
			update_option( 'burst_cleanup_data_detected_time', time(), false );
		} else {
			// if this notice is over two weeks old, clear it.
			$detected_time     = (int) get_option( 'burst_cleanup_data_detected_time', time() );
			$max_age_threshold = time() - ( 14 * DAY_IN_SECONDS );
			if ( $detected_time < $max_age_threshold ) {
				delete_option( 'burst_cleanup_data_detected_time' );
				delete_option( 'burst_clean_data' );
				delete_option( 'burst_cleanup_uid' );
				delete_option( 'burst_cleanup_uid_visits' );
			}
		}
	}

	/**
	 * Clean up the notification data when the task has been dismissed instead of fixed.
	 */
	public function dismiss_malicious_data_notice( string $task_id ): void {
		if ( $task_id === 'malicious_data_removal' ) {
			delete_option( 'burst_cleanup_data_detected_time' );
			delete_option( 'burst_clean_data' );
			delete_option( 'burst_cleanup_uid' );
			delete_option( 'burst_cleanup_uid_visits' );
		}
	}

	/**
	 * On a daily basis, cleanup suspiciously high amounts of data.
	 *
	 * @hooked burst_daily
	 */
	public function clean_malicious_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		// only when explicitly triggerred.
		if ( ! get_option( 'burst_clean_data' ) ) {
			return;
		}

		$uid = get_option( 'burst_cleanup_uid' );
		if ( strlen( $uid ) < 10 ) {
			self::error_log( 'Suspicious UID format, cleanup aborted: ' . $uid );
			return;
		}

		$detected_time     = (int) get_option( 'burst_cleanup_data_detected_time', time() );
		$max_age_threshold = time() - ( 14 * DAY_IN_SECONDS );

		delete_option( 'burst_cleanup_data_detected_time' );
		delete_option( 'burst_clean_data' );
		delete_option( 'burst_cleanup_uid' );
		delete_option( 'burst_cleanup_uid_visits' );

		if ( $detected_time < $max_age_threshold ) {
			return;
		}

		if ( empty( $uid ) ) {
			return;
		}

		$interval_days     = (int) apply_filters( 'burst_data_cleanup_interval_days', 1 );
		$cleanup_threshold = $detected_time - ( $interval_days * DAY_IN_SECONDS );

		global $wpdb;
		$wpdb->query( 'START TRANSACTION' );

		try {
			// 1. Get statistic IDs first.
			$statistic_ids = $wpdb->get_col(
				$wpdb->prepare(
					"
            SELECT ID
            FROM {$wpdb->prefix}burst_statistics
            WHERE uid = %s
            AND time >= %d
        ",
					$uid,
					$cleanup_threshold
				)
			);

			// 2. Delete goal statistics.
			if ( ! empty( $statistic_ids ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $statistic_ids ), '%d' ) );
				$sql          = "DELETE FROM {$wpdb->prefix}burst_goal_statistics WHERE statistic_id IN ($placeholders)";
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- values are prepared above.
				$wpdb->query( $wpdb->prepare( $sql, ...$statistic_ids ) );
			}

			// 3. Get session IDs first.
			$session_ids = $wpdb->get_col(
				$wpdb->prepare(
					"
            SELECT DISTINCT session_id
            FROM {$wpdb->prefix}burst_statistics
            WHERE uid = %s
            AND time >= %d
            AND session_id IS NOT NULL
        ",
					$uid,
					$cleanup_threshold
				)
			);

			// 4. Delete sessions.
			if ( ! empty( $session_ids ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $session_ids ), '%d' ) );
				$sql          = "DELETE FROM {$wpdb->prefix}burst_sessions WHERE ID IN ($placeholders)";
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- values are prepared above.
				$wpdb->query( $wpdb->prepare( $sql, ...$session_ids ) );
			}

			// 5. Delete statistics.
			$wpdb->query(
				$wpdb->prepare(
					"
            DELETE FROM {$wpdb->prefix}burst_statistics
            WHERE uid = %s
            AND time >= %d
        ",
					$uid,
					$cleanup_threshold
				)
			);

			$wpdb->query( 'COMMIT' );

		} catch ( \Exception $e ) {
			$wpdb->query( 'ROLLBACK' );
			self::error_log( 'Rolled back data cleanup: ' . $e->getMessage() );
		}
	}

	/**
	 * Once a day, check if any tasks need to be added again
	 */
	public function validate_tasks(): void {
		$this->tasks->validate_tasks();
	}

	/**
	 * Insert row in a table
	 */
	private function insert_row( string $table, array $rows ): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		global $wpdb;
		$table = "{$wpdb->prefix}burst_$table";
		foreach ( $rows as $row ) {
			$wpdb->insert(
				$table,
				$row
			);
		}
	}

	/**
	 * Clean up errors after some time, to prevent them hanging around indefinitely.
	 */
	public function cleanup_php_error_notices(): void {
		$last_detected = get_option( 'burst_php_error_time', time() );
		if ( ! $last_detected ) {
			return;
		}

		$x_days_ago = time() - 7 * DAY_IN_SECONDS;
		if ( $last_detected < $x_days_ago ) {
			delete_option( 'burst_php_error_time' );
			delete_option( 'burst_php_error_detected' );
			delete_option( 'burst_php_error_count' );
		}
	}

	/**
	 * Clean up the notification data when the task has been dismissed instead of fixed.
	 */
	public function dismiss_php_error_notice( string $task_id ): void {
		if ( $task_id === 'php_error_detected' ) {
			delete_option( 'burst_php_error_time' );
			delete_option( 'burst_php_error_detected' );
			delete_option( 'burst_php_error_count' );
		}
	}

	/**
	 * Get a random referrer for the demo data setup
	 */
	private function get_random_referrer(): string {
		$referrers = [
			'https://www.google.com',
			'https://duckduckgo.com',
			'https://bing.com',
			'https://burst-statistics.com',
		];
		return $referrers[ array_rand( $referrers ) ];
	}

	/**
	 * Install demo data in Burst if blueprint.json is active
	 */
	public function install_demo_data(): void {
		// check if database installed.
		if ( ! $this->table_exists( 'burst_statistics' ) ) {
			return;
		}

		global $wpdb;

		$data = [
			[
				'name' => 'Chrome',
			],
			[
				'name' => 'Safari',
			],
			[
				'name' => 'Firefox',
			],
		];
		$this->insert_row( 'browsers', $data );

		$data = [
			[
				'name' => 'desktop',
			],
			[
				'name' => 'mobile',
			],
			[
				'name' => 'tablet',
			],
		];
		$this->insert_row( 'devices', $data );

		$data = [
			[
				'name' => 'Windows',
			],
			[
				'name' => 'MacOS',
			],
			[
				'name' => 'Linux',
			],
		];
		$this->insert_row( 'platforms', $data );
		// get all demo pages.
		$posts           = get_posts(
			[
				'post_type'      => [ 'page', 'post' ],
				'post_status'    => 'publish',
				'posts_per_page' => -1,
			]
		);
		$start_date_unix = time();
		$total_days      = 30;
		// we're walking back in time, so to get an increasing nr of pageviews, we decrease the max views each day.
		$max_views = 500;
		for ( $i = 0; $i < $total_days; $i++ ) {
			$stats_date_unix = $start_date_unix - ( $i * DAY_IN_SECONDS );
			$max_views      -= $i * 2;
			$min_views       = 10;
			if ( $max_views <= $min_views ) {
				$max_views = $min_views + 5;
			}
			foreach ( $posts as $post ) {
				$post_id = $post->ID;

				$page_url     = str_replace( home_url(), '', get_permalink( $post_id ) );
				$visitors     = random_int( $min_views, $max_views );
				$values       = [];
				$placeholders = [];

				for ( $j = 0; $j < $visitors; $j++ ) {
					$uid          = random_int( 1, 1000 );
					$bounce       = random_int( 0, 1 );
					$browser_id   = random_int( 1, 3 );
					$device_id    = random_int( 1, 3 );
					$platform_id  = random_int( 1, 3 );
					$time_on_page = wp_rand( 20, 3 * MINUTE_IN_SECONDS );
					$referrer     = $this->get_random_referrer();

					$wpdb->insert(
						"{$wpdb->prefix}burst_sessions",
						[
							'referrer'          => $referrer,
							'first_visited_url' => '/',
							'last_visited_url'  => '/',
						],
						[ '%s', '%s', '%s' ]
					);

					$session_id = $wpdb->insert_id;

					$placeholders[] = '(%d, %s, %d, %d, %d, %d, %d, %d, %d, %d)';
					$values         = array_merge(
						$values,
						[
							$stats_date_unix,
							$page_url,
							$uid,
							1,
							$bounce,
							$browser_id,
							$device_id,
							$platform_id,
							$time_on_page,
							$session_id,
						]
					);
				}

				$query = "
                    INSERT INTO {$wpdb->prefix}burst_statistics
                    (time, page_url, uid, first_time_visit, bounce, browser_id, device_id, platform_id, time_on_page, session_id)
                    VALUES " . implode( ', ', $placeholders );
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- values are prepared.
				$wpdb->query( $wpdb->prepare( $query, ...$values ) );
			}
		}
	}

	/**
	 * Activation processing
	 */
	public function activation(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		if ( get_option( 'burst_run_activation' ) ) {
			Capability::add_capability( 'view', [ 'administrator', 'editor' ] );
			Capability::add_capability( 'manage' );
			do_action( 'burst_activation' );
			update_option( 'burst_run_activation', false );
		}
	}

	/**
	 * Compile js file from settings and javascript so we can prevent inline variables
	 */
	public function create_js_file(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$cookieless      = $this->get_option_bool( 'enable_cookieless_tracking' );
		$cookieless_text = $cookieless ? '-cookieless' : '';
		$localize_args   = \Burst\burst_loader()->frontend->tracking->get_options();

		$js = 'let burst = ' . wp_json_encode( $localize_args ) . ';';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$js                .= file_get_contents( BURST_PATH . "assets/js/build/burst$cookieless_text.min.js" );
		$filename           = $this->get_frontend_js_filename();
		$ghost_mode_enabled = apply_filters( 'burst_obfuscate_filename', $this->get_option_bool( 'ghost_mode' ) );
		$upload_dir         = $this->upload_dir( 'js', $ghost_mode_enabled );
		$file               = $upload_dir . $filename;

		// copy timeme script to uploads dir if ghost mode is enabled.
		if ( $ghost_mode_enabled ) {
			$js                      = $this->strip_window_exports( $js );
			$timeme_original_file    = BURST_PATH . 'assets/js/timeme/timeme.min.js';
			$timeme_obfustcated_file = $upload_dir . 'timeme.min.js';
			if ( ! file_exists( $timeme_obfustcated_file ) ) {
				copy( $timeme_original_file, $timeme_obfustcated_file );
			}
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		global $wp_filesystem;
		if ( WP_Filesystem() ) {
			if ( $wp_filesystem->is_dir( $upload_dir ) && $wp_filesystem->is_writable( $upload_dir ) ) {
				delete_option( 'burst_js_write_error' );
				$wp_filesystem->put_contents( $file, $js, FS_CHMOD_FILE );
			} else {
				update_option( 'burst_js_write_error', true, false );
			}
		}
	}

	/**
	 * Strip window export statements from JavaScript file.
	 *
	 * @param string $js_content The JavaScript content.
	 * @return string The processed JavaScript content.
	 */
	private function strip_window_exports( string $js_content ): string {
		$pattern    = '/,window\.burst_uid\s*=\s*burst_uid\s*,\s*window\.burst_use_cookies\s*=\s*burst_use_cookies\s*,\s*window\.burst_fingerprint\s*=\s*burst_fingerprint\s*,\s*window\.burst_update_hit\s*=\s*burst_update_hit\s*;?/';
		$js_content = preg_replace( $pattern, '', $js_content );
		return preg_replace( '/\n{3,}/', "\n\n", $js_content );
	}

	/**
	 * On Multisite site creation, run table init hook as well.
	 */
	public function run_table_init_hook(): void {
		// if already running, exit.
		if ( defined( 'BURST_INSTALL_TABLES_RUNNING' ) ) {
			return;
		}

		define( 'BURST_INSTALL_TABLES_RUNNING', true );

		if ( get_transient( 'burst_running_upgrade_process' ) ) {
			return;
		}

		// don't run on uninstall.
		if ( defined( 'BURST_UNINSTALLING' ) ) {
			return;
		}
		set_transient( 'burst_running_upgrade_process', true, 30 );
		do_action( 'burst_install_tables' );
		// we need to run table creation across subsites as well.
		if ( is_multisite() ) {
			$sites = get_sites();
			if ( count( $sites ) > 0 ) {
				foreach ( $sites as $site ) {
					switch_to_blog( (int) $site->blog_id );
					do_action( 'burst_install_tables' );
					restore_current_blog();
				}
			}
		}
		delete_transient( 'burst_running_upgrade_process' );
	}

	/**
	 * Add some privacy info.
	 */
	public function add_privacy_info(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$content = sprintf(
		// translators: 1: opening anchor tag to the privacy statement, 2: closing anchor tag.
			__( 'This website uses Burst Statistics, a Privacy-Friendly Statistics Tool to analyze visitor behavior. For this functionality we (this website) collect anonymized data, stored locally without sharing it with other parties. For more information, please read the %1$s Privacy Statement %2$s from Burst.', 'burst-statistics' ),
			'<a href="https://burst-statistics.com/legal/privacy-statement/" target="_blank">',
			'</a>'
		);
		wp_add_privacy_policy_content(
			'Burst Statistics',
			wp_kses_post( wpautop( $content, false ) )
		);
	}

	/**
	 * Setup default settings used for tracking
	 */
	public function setup_defaults(): void {
		if ( get_option( 'burst_set_defaults' ) ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_activation_time', time(), false );
			update_option( 'burst_last_cron_hit', time(), false );
			$this->update_option( 'combine_vars_and_script', true );
			$this->create_js_file();

			$this->tasks->add_initial_tasks();
			flush_rewrite_rules();
			if ( ! $this->table_exists( 'burst_goals' ) ) {
				return;
			}

			// set default goal.
			// if there is no default goal, then insert one.
			$goals = ( new Goals() )->get_goals();
			$count = count( $goals );
			if ( $count === 0 ) {
				$goal        = new Goal();
				$goal->title = __( 'Default goal', 'burst-statistics' );
				$goal->save();
			}
			delete_option( 'burst_set_defaults' );
		}
	}

	/**
	 * Add custom links (Settings, Support, Upgrade) to the plugin actions row on the Plugins page.
	 *
	 * @hook plugin_action_links_$plugin
	 * @param array<int, string> $links An array of existing plugin action links.
	 * @return array<int, string> Modified array with additional plugin links.
	 */
	public function plugin_settings_link( array $links ): array {
		// Add "Upgrade to Pro" link at the start if not Pro version.
		if ( ! defined( 'BURST_PRO' ) ) {
			$upgrade_link
				= '<a style="color:#2e8a37;font-weight:bold" target="_blank" href="' . $this->get_website_url( 'pricing', [ 'utm_source' => 'plugin-overview' ] ) . '">'
					. __( 'Upgrade to Pro', 'burst-statistics' ) . '</a>';
			array_unshift( $links, $upgrade_link );
		}

		// Get menu links from configuration and add them after upgrade.
		$menu_links = $this->get_menu_links_from_config();
		foreach ( array_reverse( $menu_links ) as $menu_link ) {
			array_unshift( $links, $menu_link );
		}

		// Add support link at the end.
		$support_link = defined( 'BURST_FREE' )
			? 'https://wordpress.org/support/plugin/burst-statistics'
			: $this->get_website_url(
				'support',
				[
					'utm_source'  => 'plugin-overview',
					'utm_content' => 'support-link',
				]
			);
		$faq_link     = '<a target="_blank" href="' . $support_link . '">'
						. __( 'Support', 'burst-statistics' ) . '</a>';
		array_push( $links, $faq_link );

		return $links;
	}

	/**
	 * Get menu links from menu configuration for plugin action links
	 *
	 * @return array<int, string> Array of menu links HTML
	 */
	private function get_menu_links_from_config(): array {
		$menu_config = $this->get_menu_config();
		$menu_links  = [];

		foreach ( $menu_config as $menu_item ) {
			// Skip items that shouldn't appear in WordPress admin menu.
			if ( ! isset( $menu_item['show_in_plugin_overview'] ) || ! $menu_item['show_in_plugin_overview'] ) {
				continue;
			}

			// Check user capabilities.
			$capability = $menu_item['capabilities'] ?? 'view_burst_statistics';
			if ( ! current_user_can( $capability ) ) {
				continue;
			}

			$title     = $menu_item['title'] ?? '';
			$menu_slug = $menu_item['menu_slug'] ?? 'burst';
			$css_class = 'burst-' . ( $menu_item['id'] ?? 'menu' ) . '-link';

			$menu_links[] = '<a href="'
							. admin_url( 'admin.php?page=' . $menu_slug )
							. '" class="' . esc_attr( $css_class ) . '">'
							. esc_html( $title ) . '</a>';
		}

		return $menu_links;
	}

	/**
	 * Get menu configuration from config file
	 *
	 * @return array<int, array<string, mixed>> Menu configuration array
	 */
	private function get_menu_config(): array {
		return $this->app->menu->get();
	}

	/**
	 * Check if the current day falls within the Black Friday week.
	 */
	public static function is_bf(): bool {
		// Use current GMT timestamp.
		$now = time();
		// Get current year.
		$year = gmdate( 'Y' );

		// Calculate Thanksgiving.
		$thanksgiving = strtotime( "fourth thursday of november $year" );
		// Black Friday is the day after Thanksgiving.
		$black_friday = strtotime( '+1 day', $thanksgiving );

		// Monday before Black Friday.
		$start = strtotime( '-4 days', $black_friday );
		// Saturday after Black Friday, end of day.
		$end = strtotime( '+1 day 23:59:59', $black_friday );

		return ( $now >= $start && $now <= $end );
	}

	/**
	 * Check if this is the Cyber Monday period.
	 */
	public static function is_cm(): bool {
		// Use current GMT timestamp.
		$now = time();
		// Get current year.
		$year = gmdate( 'Y' );

		// Calculate Thanksgiving.
		$thanksgiving = strtotime( "fourth thursday of november $year" );
		// Black Friday is the day after Thanksgiving.
		$black_friday = strtotime( '+1 day', $thanksgiving );

		// Sunday after Black Friday.
		$start = strtotime( '+2 days', $black_friday );
		// Cyber Monday, end of day.
		$end = strtotime( '+3 days 23:59:59', $black_friday );

		return ( $now >= $start && $now <= $end );
	}

	/**
	 * Add a button and thickbox to deactivate the plugin
	 *
	 * @since  1.0
	 * @access public
	 */
	public function deactivate_popup(): void {
		// only on plugins page.
		$screen = get_current_screen();
		if ( empty( $screen ) || ( $screen->base !== 'plugins' && $screen->base !== 'plugins-network' ) ) {
			return;
		}
		$networkwide = $screen->base === 'plugins-network';
		$slug        = sanitize_title( BURST_PLUGIN_NAME );
		?>
		<?php add_thickbox(); ?>
		<style>

			#TB_ajaxContent.burst-deactivation-popup {
				text-align: center !important;
			}

			#TB_window.burst-deactivation-popup {
				height: min-content !important;
				margin-top: initial !important;
				margin-left: initial !important;
				display: flex;
				flex-direction: column;
				top: 50% !important;
				left: 50%;
				transform: translate(-50%, -50%);
				width: 500px !important;
				border-radius: 12px !important;
				min-width: min-content;
			}

			.burst-deactivation-popup #TB_title {
				padding-bottom: 20px;
				border-radius: 12px;
				border-bottom: none !important;
				background: #fff !important;
			}

			.burst-deactivation-popup #TB_ajaxWindowTitle {
				font-weight: bold;
				font-size: 20px;
				padding: 20px;
				background: #fff !important;
				border-radius: 12px 12px 0 0;
				width: calc(100% - 40px);
			}

			.burst-deactivation-popup .tb-close-icon {
				color: #333;
				width: 25px;
				height: 25px;
				top: 12px;
				right: 20px;
			}

			.burst-deactivation-popup .tb-close-icon:before {
				font: normal 25px/25px dashicons;
			}

			.burst-deactivation-popup #TB_closeWindowButton:focus .tb-close-icon {
				outline: 0;
				color: #666;
			}

			.burst-deactivation-popup #TB_closeWindowButton .tb-close-icon:hover {
				color: #666;
			}

			.burst-deactivation-popup #TB_closeWindowButton:focus {
				outline: 0;
			}

			.burst-deactivation-popup #TB_ajaxContent {
				width: 90% !important;
				height: initial !important;
				padding-left: 20px !important;
			}

			.burst-deactivation-popup .button-burst-tertiary.button {
				background-color: #D7263D !important;
				color: white !important;
				border-color: #D7263D;
			}

			.burst-deactivation-popup .button-burst-tertiary.button:hover {
				background-color: #f1f1f1 !important;
				color: #d7263d !important;
			}

			.burst-deactivate-notice-content h3, .burst-deactivate-notice-content ul {
			}

			.burst-deactivate-notice-footer {
				display: flex;
				gap: 10px;
				padding: 15px 10px 0 10px;
			}

			.burst-deactivation-popup ul {
				list-style: disc;
				padding-left: 20px;
			}

			.burst-deactivate-notice-footer .button {
				min-width: fit-content;
				white-space: nowrap;
				cursor: pointer;
				text-decoration: none;
				text-align: center;
			}
		</style>
		<script>
			jQuery(document).ready(function($) {
				$('#burst_close_tb_window').click(tb_remove);
				<?php //phpcs:ignore ?>
				$(document).on('click', '#deactivate-<?php echo $slug; ?>', function(e) {
					e.preventDefault();
					tb_show('', '#TB_inline?height=420&inlineId=deactivate_and_delete_data', 'null');
					$('#TB_window').addClass('burst-deactivation-popup');

				});
				<?php //phpcs:ignore ?>
				if ($('#deactivate-<?php echo $slug; ?>').length) {
					<?php //phpcs:ignore ?>
					$('.burst-button-deactivate').attr('href', $('#deactivate-<?php echo $slug; ?>').attr('href'));
				}

			});
		</script>

		<div id="deactivate_and_delete_data" style="display: none;">
			<div class="burst-deactivate-notice-content">
				<h4 style="margin:0 0 20px 0; text-align: left; font-size: 1.1em;">
					<?php esc_html_e( 'Are you sure? With Burst Statistics active:', 'burst-statistics' ); ?></h4>
				<ul style="text-align: left;">
					<li><?php esc_html_e( 'You have access to your analytical data', 'burst-statistics' ); ?></li>
					<li><?php esc_html_e( 'Asking consent for statistics often not required.', 'burst-statistics' ); ?></li>
					<li><?php esc_html_e( 'Your data securely on your own server.', 'burst-statistics' ); ?></li>
				</ul>
			</div>

			<?php
			$token                              = wp_create_nonce( 'burst_deactivate_plugin' );
			$deactivate_and_remove_all_data_url = add_query_arg(
				[
					'action'      => 'uninstall_delete_all_data',
					'networkwide' => $networkwide ? '1' : '0',
					'token'       => $token,
				],
				admin_url( 'plugins.php' )
			);
			?>
			<div class="burst-deactivate-notice-footer">
				<a class="button button-default" href="#"
					id="burst_close_tb_window"><?php esc_html_e( 'Cancel', 'burst-statistics' ); ?></a>
				<a class="button button-primary burst-button-deactivate"
					href="#"><?php esc_html_e( 'Deactivate', 'burst-statistics' ); ?></a>
				<a class="button burst-button-deactivate-delete button-burst-tertiary"
					href="<?php echo esc_url( $deactivate_and_remove_all_data_url ); ?>"><?php esc_html_e( 'Deactivate and delete all data', 'burst-statistics' ); ?></a>
			</div>
		</div>
		<?php
	}

	/**
	 * Deactivate the plugin, based on made choice regarding data
	 */
	public function listen_for_deactivation(): void {
		// check user role.
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		// check nonce. ignore phpcs: no data is stored here. only verified.
		//phpcs:ignore
		if ( ! isset( $_GET['token'] ) || ( ! $this->verify_nonce( $_GET['token'], 'burst_deactivate_plugin' ) ) ) {
			return;
		}

		// check for action.
		//phpcs:ignore
		if ( isset( $_GET['action'] ) && $_GET['action'] === 'uninstall_delete_all_data' ) {
			define( 'BURST_NO_UPGRADE', true );
			define( 'BURST_UNINSTALLING', true );
			\Burst\burst_clear_scheduled_hooks();

			//phpcs:ignore
			$networkwide = isset( $_GET['networkwide'] ) && $_GET['networkwide'] === '1';
			if ( $networkwide && is_multisite() ) {
				$sites = get_sites();
				if ( count( $sites ) > 0 ) {
					foreach ( $sites as $site ) {
						switch_to_blog( (int) $site->blog_id );
						$this->delete_all_burst_data();
						$this->delete_all_burst_configuration();
						restore_current_blog();
					}
				}
			}
			$this->delete_all_burst_data();
			$this->delete_all_burst_configuration();
			\Burst\burst_clear_scheduled_hooks();
			$this->delete_all_burst_cron_events();

			deactivate_plugins( BURST_PLUGIN, false, $networkwide );
			$redirect_slug = $networkwide ? 'network/plugins.php' : 'plugins.php';

			wp_safe_redirect( admin_url( $redirect_slug ) );
			exit;
		}
	}

	/**
	 * Delete all scheduled cron events related to Burst, including single events.
	 */
	private function delete_all_burst_cron_events(): void {
		$crons = _get_cron_array();

		if ( empty( $crons ) ) {
			return;
		}

		foreach ( $crons as $timestamp => $cron ) {
			foreach ( $cron as $hook => $events ) {
				if ( str_starts_with( $hook, 'burst_' ) ) {
					foreach ( $events as $event ) {
						wp_unschedule_event( $timestamp, $hook, $event['args'] );
					}
				}
			}
		}
	}

	/**
	 * Clear all data from the reset button in the settings.
	 *
	 * @param array  $output The initial output array.
	 * @param string $action The action to perform.
	 * @param ?array $data   Additional data for processing.
	 * @return array<string, mixed> The modified output array.
	 */
	public function maybe_delete_all_data( array $output, string $action, ?array $data ): array {
		// fix phpcs warning.
		unset( $data );
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		if ( $action === 'reset' ) {
			$this->reset();
			$output = [
				'success' => true,
				'message' => __( 'Successfully cleared data.', 'burst-statistics' ),
			];
		}

		return $output;
	}

	/**
	 * Reset data. Used by the WP CLI command and react reset button
	 */
	public function reset(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		// delete everything.
		$this->delete_all_burst_data();

		// immediately run setup defaults, so db tables get made.
		$this->setup_defaults();

		// ensure the tables are created.
		delete_transient( 'burst_running_upgrade' );
		$this->run_table_init_hook();
	}

	/**
	 * Get array of Burst Tables.
	 */
	private function get_table_list(): array {
		return apply_filters(
			'burst_all_tables',
			[
				'burst_statistics',
				'burst_sessions',
				'burst_goals',
				'burst_goal_statistics',
				'burst_browsers',
				'burst_browser_versions',
				'burst_platforms',
				'burst_devices',
				'burst_referrers',
				'burst_known_uids',
			],
		);
	}

	/**
	 * Clear plugin data
	 */
	public function delete_all_burst_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		global $wpdb;

		// tables to delete.
		$table_names = $this->get_table_list();

		// delete tables.
		foreach ( $table_names as $table_name ) {
			$sql = "DROP TABLE IF EXISTS {$wpdb->prefix}$table_name";
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- table name is from a predefined list.
			$wpdb->query( $sql );
		}
	}

	/**
	 * Delete all options and capabilities
	 */
	public function delete_all_burst_configuration(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		global $wp_roles;
		global $wpdb;

		// capabilities to delete.
		$roles        = $wp_roles->roles;
		$capabilities = [
			'manage_burst_statistics',
			'view_burst_statistics',
		];

		// delete user capabilities from all user roles.
		foreach ( $roles as $role_name => $role_info ) {
			foreach ( $capabilities as $capability ) {
				$wp_roles->remove_cap( $role_name, $capability );
			}
		}

		// delete all burst options.
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'burst\_%'" );
		if ( is_multisite() ) {
			$wpdb->query( "DELETE FROM {$wpdb->sitemeta} WHERE meta_key LIKE 'burst\_%'" );
			$sites = get_sites( [ 'fields' => 'ids' ] );
			foreach ( $sites as $site_id ) {
				switch_to_blog( $site_id );
				$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'burst\_%'" );
				restore_current_blog();
			}
		}

		// get all burst transients.
		$results = $wpdb->get_results(
			"SELECT `option_name` AS `name`, `option_value` AS `value`
                                FROM  $wpdb->options
                                WHERE `option_name` LIKE '%transient_burst%'
                                ORDER BY `option_name`",
			'ARRAY_A'
		);
		// loop through all burst transients and delete.
		foreach ( $results as $key => $value ) {
			$transient_name = substr( $value['name'], 11 );
			delete_transient( $transient_name );
		}
	}

	/**
	 * Drop tables during the site deletion.
	 *
	 * @param array $tables  The tables to drop.
	 * @param int   $blog_id The site ID.
	 * @return array<int, string> The modified list of tables to drop.
	 */
	public function ms_remove_tables(
		array $tables,
		int $blog_id
	): array {
		global $wpdb;

		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_sessions';
		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_statistics';
		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_goals';
		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_archived_months';
		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_goal_statistics';
		$tables[] = $wpdb->get_blog_prefix( $blog_id ) . 'burst_summary';

		return $tables;
	}
}