<?php
namespace Burst\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\App\App;
use Burst\Admin\Burst_Wp_Cli\Burst_Wp_Cli;
use Burst\Admin\Cron\Cron;
use Burst\Admin\Dashboard_Widget\Dashboard_Widget;
use Burst\Admin\DB_Upgrade\DB_Upgrade;
use Burst\Admin\Mailer\Mail_Reports;
use Burst\Admin\Statistics\Goal_Statistics;
use Burst\Admin\Statistics\Statistics;
use Burst\Admin\Statistics\Summary;
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
	public Summary $summary;
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
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );

		add_action( 'admin_init', [ $this, 'add_burst_admin_columns' ], 1 );
		add_action( 'pre_get_posts', [ $this, 'posts_orderby_total_pageviews' ], 1 );
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
		add_action( 'wp_initialize_site', [ $this, 'create_js_file' ], 10, 1 );
		add_action( 'admin_init', [ $this, 'activation' ] );
		add_action( 'burst_activation', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_activation', [ $this, 'setup_defaults' ], 20, 1 );
		add_action( 'after_reset_stats', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'upgrader_process_complete', [ $this, 'after_plugin_upgrade' ], 10, 2 );
		add_action( 'wp_initialize_site', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_upgrade_before', [ $this, 'run_table_init_hook' ], 10, 1 );
		add_action( 'burst_daily', [ $this, 'validate_tasks' ] );
		add_action( 'burst_validate_tasks', [ $this, 'validate_tasks' ] );
		add_action( 'plugins_loaded', [ $this, 'init_wpcli' ] );
		add_action( 'burst_daily', [ $this, 'clean_malicious_data' ] );

		$upgrade = new Upgrade();
		$upgrade->init();
		$db_upgrade = new DB_Upgrade();
		$db_upgrade->init();
		$cron = new Cron();
		$cron->init();

		$goal_statistics = new Goal_Statistics();
		$goal_statistics->init();
		$this->statistics = new Statistics();
		$this->statistics->init();
		$reports = new Mail_Reports();
		$reports->init();
		$this->summary = new Summary();
		$this->summary->init();
		$this->app = new App();
		$this->app->init();

		$review = new Review();
		$review->init();
		$this->tasks = new Tasks();
		$widget      = new Dashboard_Widget();
		$widget->init();

		if ( defined( 'BURST_BLUEPRINT' ) && ! get_option( 'burst_demo_data_installed' ) ) {
			add_action( 'init', [ $this, 'install_demo_data' ] );
			update_option( 'burst_demo_data_installed', true, false );
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
	 * On a daily basis, cleanup suspiciously high amounts of data.
	 *
	 * @hooked burst_daily
	 * @return void
	 */
	public function clean_malicious_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$interval_days = (int) apply_filters( 'burst_data_cleanup_interval_days', 1 );
		$data_treshold = (int) apply_filters( 'burst_data_cleanup_treshold', 1000 );

		global $wpdb;

		$sql = "
        DELETE FROM {$wpdb->prefix}burst_goal_statistics
        WHERE statistic_id IN (
            SELECT s.ID
            FROM {$wpdb->prefix}burst_statistics s
            JOIN (
                SELECT uid
                FROM {$wpdb->prefix}burst_statistics
                WHERE time > UNIX_TIMESTAMP(NOW() - INTERVAL {$interval_days} DAY)
                GROUP BY uid
                HAVING COUNT(*) > {$data_treshold}
            ) AS filtered_uids ON s.uid = filtered_uids.uid
        )
    ";
		$wpdb->query( $sql );

		$sql = "
        DELETE FROM {$wpdb->prefix}burst_sessions
        WHERE ID IN (
            SELECT DISTINCT s.session_id
            FROM {$wpdb->prefix}burst_statistics s
            JOIN (
                SELECT uid
                FROM {$wpdb->prefix}burst_statistics
                WHERE time > UNIX_TIMESTAMP(NOW() - INTERVAL {$interval_days} DAY)
                GROUP BY uid
                HAVING COUNT(*) > {$data_treshold}
            ) AS filtered_uids ON s.uid = filtered_uids.uid
            WHERE s.session_id IS NOT NULL
        )
    ";
		$wpdb->query( $sql );

		$sql           = "
        DELETE FROM {$wpdb->prefix}burst_statistics
        WHERE uid IN (
            SELECT uid FROM (
                SELECT uid
                FROM {$wpdb->prefix}burst_statistics
                WHERE time > UNIX_TIMESTAMP(NOW() - INTERVAL {$interval_days} DAY)
                GROUP BY uid
                HAVING COUNT(*) > {$data_treshold}
            ) AS filtered_uids
        )
    ";
		$removed_count = $wpdb->query( $sql );

		if ( $removed_count > 0 ) {
			update_option( 'burst_removed_malicious_data_count', $removed_count );
		} else {
			delete_option( 'burst_removed_malicious_data_count' );
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
		$this->insert_row( 'platforms', $data );

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
			// 2022-02-07.
			$stats_date        = Statistics::convert_unix_to_date( $stats_date_unix );
			$total_entry_added = false;
			$max_views        -= $i * 2;
			$min_views         = 10;
			if ( $max_views <= $min_views ) {
				$max_views = $min_views + 5;
			}
			foreach ( $posts as $post ) {
				$post_id = $post->ID;

				$page_url            = str_replace( home_url(), '', get_permalink( $post_id ) );
				$visitors            = random_int( $min_views, $max_views );
				$page_views          = 2 * $visitors;
				$sessions            = round( 0.5 * $visitors, 0 );
				$first_time_visitors = round( 0.1 * $visitors, 0 );
				$bounces             = round( 0.03 * $visitors, 0 );
				$values              = [];
				$placeholders        = [];

				for ( $j = 0; $j < $visitors; $j++ ) {
					$uid          = random_int( 1, 1000 );
					$bounce       = random_int( 0, 1 );
					$browser_id   = random_int( 1, 3 );
					$device_id    = random_int( 1, 3 );
					$platform_id  = random_int( 1, 3 );
					$time_on_page = wp_rand( 20, 3 * MINUTE_IN_SECONDS );
					$referrer     = $this->get_random_referrer();

					$placeholders[] = '(%d, %s, %d, %d, %d, %d, %d, %d, %d, %s)';
					$values         = array_merge(
						$values,
						[
							$stats_date_unix,
							$page_url,
							$uid,
							// first_time_visit.
							1,
							$bounce,
							$browser_id,
							$device_id,
							$platform_id,
							$time_on_page,
							$referrer,
						]
					);
				}

				$query = "
                    INSERT INTO {$wpdb->prefix}burst_statistics
                    (time, page_url, uid, first_time_visit, bounce, browser_id, device_id, platform_id, time_on_page, referrer)
                    VALUES " . implode( ', ', $placeholders );
				$wpdb->query( $wpdb->prepare( $query, ...$values ) );

				$post_hit_count  = get_post_meta( $post_id, 'burst_total_pageviews_count', true );
				$post_hit_count  = $post_hit_count ?: 0;
				$post_hit_count += $page_views;
				update_post_meta( $post_id, 'burst_total_pageviews_count', $post_hit_count );
				if ( ! $total_entry_added ) {
					$wpdb->insert(
						"{$wpdb->prefix}burst_summary",
						[
							'date'                => $stats_date,
							'page_url'            => 'burst_day_total',
							'sessions'            => $sessions,
							'pageviews'           => $page_views,
							'visitors'            => $first_time_visitors,
							'first_time_visitors' => $first_time_visitors,
							'bounces'             => $bounces,
							'avg_time_on_page'    => wp_rand( 20, 3 * MINUTE_IN_SECONDS ),
							'completed'           => 1,
						]
					);
					$total_entry_added = true;
				}
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
			delete_option( 'burst_run_activation' );
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
		$js .= file_get_contents( BURST_PATH . "assets/js/build/burst$cookieless_text.min.js" );

		$upload_dir = $this->upload_dir( 'js' );
		$file       = $upload_dir . 'burst.min.js';

		require_once ABSPATH . 'wp-admin/includes/file.php';
		global $wp_filesystem;
		if ( ! WP_Filesystem() ) {
			return;
		}

		if ( $wp_filesystem->is_dir( $upload_dir ) && $wp_filesystem->is_writable( $upload_dir ) ) {
			$wp_filesystem->put_contents( $file, $js, FS_CHMOD_FILE );
		}
	}

	/**
	 * If this is a plugin upgrade or installation, check if this is coming from Burst.
	 * If so, run some updates within the plugin.
	 */
	public function after_plugin_upgrade( ?object $upgrader_object = null, array $options = [] ): void {
		// only if regarding plugins, install or update.
		if ( isset( $options['type'] ) && $options['type'] !== 'plugin'
		) {
			return;
		}

		if ( $options['action'] !== 'install' && $options['action'] !== 'update' ) {
			return;
		}

		if ( ! isset( $upgrader_object->new_plugin_data ) || $upgrader_object->new_plugin_data['TextDomain'] !== 'burst-statistics' ) {
			return;
		}

		$this->run_table_init_hook();
		$this->create_js_file();
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

		if ( get_transient( 'burst_running_upgrade' ) ) {
			return;
		}

		// don't run on uninstall.
		if ( defined( 'BURST_UNINSTALLING' ) ) {
			return;
		}

		set_transient( 'burst_running_upgrade', true, 30 );
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
			__( 'This website uses Burst Statistics, a Privacy-Friendly Statistics Tool to analyze visitor behavior. For this functionality we (this website) collect anonymized data, stored locally without sharing it with other parties. For more information, please read the %s Privacy Statement %s from Burst.', 'burst-statistics' ),
			'<a href="https://burst-statistics.com/legal/privacy-statement/" target="_blank">',
			'</a>'
		);
		wp_add_privacy_policy_content(
			'Burst Statistics',
			wp_kses_post( wpautop( $content, false ) )
		);
	}

	/**
	 * Enqueue some assets
	 */
	public function enqueue_assets( ?string $hook ): void {
		if ( $hook === 'toplevel_page_burst' ) {
			$min  = ! is_rtl() && ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
			$rtl  = is_rtl() ? 'rtl/' : '';
			$url  = trailingslashit( BURST_URL ) . "assets/css/{$rtl}admin{$min}.css";
			$path = trailingslashit( BURST_PATH ) . "assets/css/{$rtl}admin{$min}.css";
			wp_enqueue_style( 'burst-admin', $url, [ 'wp-components' ], filemtime( $path ) );
		}
	}

	/**
	 * Setup default settings used for tracking
	 */
	public function setup_defaults(): void {
		if ( get_option( 'burst_set_defaults' ) ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_activation_time', time(), false );
			update_option( 'burst_last_cron_hit', time(), false );
			$this->tasks->add_initial_tasks();
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
		$config_file = BURST_PATH . 'src/Admin/App/config/menu.php';
		if ( ! file_exists( $config_file ) ) {
			return [];
		}

		$menu_config = include $config_file;
		return is_array( $menu_config ) ? $menu_config : [];
	}

	/**
	 * Add counts column
	 *
	 * @since 1.1
	 */
	public function add_admin_column( string $column_name, string $column_title, string $post_type, bool $sortable, callable $cb ): void {
		// Add column.
		add_filter(
			'manage_' . $post_type . '_posts_columns',
			function ( $columns ) use ( $column_name, $column_title ) {
				$columns[ $column_name ] = $column_title;

				return $columns;
			}
		);

		// Add column content.
		add_action(
			'manage_' . $post_type . '_posts_custom_column',
			function ( $column, $post_id ) use ( $column_name, $cb ): void {
				if ( $column_name === $column ) {
					$cb( $post_id );
				}
			},
			10,
			2
		);

		// Add sortable column.
		if ( $sortable ) {
			add_filter(
				'manage_edit-' . $post_type . '_sortable_columns',
				function ( $columns ) use ( $column_name ) {
					$columns[ $column_name ] = $column_name;

					return $columns;
				}
			);
		}
	}

	/**
	 * Function to add pageviews column to post table
	 *
	 * @since 1.1
	 */
	public function add_burst_admin_columns(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}
		$burst_column_post_types = apply_filters(
			'burst_column_post_types',
			[ 'post', 'page' ]
		);
		foreach ( $burst_column_post_types as $post_type ) {
			$this->add_admin_column(
				'pageviews',
				__( 'Pageviews', 'burst-statistics' ),
				$post_type,
				true,
				function ( $post_id ): void {
					echo (int) get_post_meta( $post_id, 'burst_total_pageviews_count', true );
				}
			);
		}
	}

	/**
	 * Function to order posts by pageviews
	 */
	public function posts_orderby_total_pageviews( \WP_Query $query ): void {
		if ( ! is_admin() || ! $query->is_main_query() || ! $this->user_can_view() ) {
			return;
		}

		if ( 'pageviews' === $query->get( 'orderby' ) ) {
			$query->set( 'orderby', 'meta_value_num title' );
			$query->set( 'meta_key', 'burst_total_pageviews_count' );
			// Ensure posts with meta_value = 0 or no meta_value are included.
			add_filter( 'get_meta_sql', [ $this, 'filter_get_meta_sql' ] );
		}
	}

	/**
	 * Because WordPress by default excludes 0-value post meta, we need to change the inner join to a left join
	 * to include posts with 0 pageviews.
	 * Might be included in core later.
	 *
	 * @link https://core.trac.wordpress.org/ticket/19653
	 * @param array<string, string> $clauses An array of SQL clauses for the meta query.
	 * @return array<string, string> Modified SQL clauses.
	 */
	public function filter_get_meta_sql( array $clauses ): array {
		// Change the inner join to a left join.
		// And change the where so it is applied to the join, not the results of the query.
		$clauses['join']  = str_replace( 'INNER JOIN', 'LEFT JOIN', $clauses['join'] ) . $clauses['where'];
		$clauses['where'] = '';

		return $clauses;
	}

	/**
	 * Check if the current day falls within the required date range (November 25, 00:00 to December 2, 23:59) based on GMT.
	 */
	public static function is_bf(): bool {
		// Get current date and time in GMT as timestamp.
		$current_date = strtotime( gmdate( 'Y-m-d H:i:s' ) );

		// Define the start and end dates for the range in GMT (including specific times).
		$start_date = strtotime( 'November 25 2024 00:00:00 GMT' );
		$end_date   = strtotime( 'November 29 2024 23:59:59 GMT' );

		// Check if the current date and time falls within the date range.
		if ( $current_date >= $start_date && $current_date <= $end_date ) {
			return true;
		}

		return false;
	}

	/**
	 * If is Cyber Monday
	 */
	public static function is_cm(): bool {
		// Get current date and time in GMT as timestamp.
		$current_date = strtotime( gmdate( 'Y-m-d H:i:s' ) );

		// Define the start and end dates for the range in GMT (including specific times).
		$start_date = strtotime( 'November 30 00:00:00 GMT' );
		$end_date   = strtotime( 'December 2 23:59:59 GMT' );

		// Check if the current date and time falls within the date range.
		if ( $current_date >= $start_date && $current_date <= $end_date ) {
			return true;
		}

		return false;
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
			deactivate_plugins( BURST_PLUGIN, false, $networkwide );
			$redirect_slug = $networkwide ? 'network/plugins.php' : 'plugins.php';

			wp_safe_redirect( admin_url( $redirect_slug ) );
			exit;
		}
	}

	/**
	 * Clear all data from the reset button in the settings.
	 *
	 * @param array  $output The initial output array.
	 * @param string $action The action to perform.
	 * @param array  $data   Additional data for processing.
	 * @return array<string, mixed> The modified output array.
	 */
	public function maybe_delete_all_data( array $output, string $action, array $data ): array {
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
	 * Clear plugin data
	 */
	public function delete_all_burst_data(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		global $wpdb;

		// post meta to delete.
		$post_meta = [
			'burst_total_pageviews_count',
		];

		if ( ! function_exists( 'delete_post_meta_by_key' ) ) {
			require_once ABSPATH . WPINC . '/post.php';
		}
		foreach ( $post_meta as $post_meta_key ) {
			delete_post_meta_by_key( $post_meta_key );
		}

		// tables to delete.
		$table_names = apply_filters(
			'burst_all_tables',
			[
				'burst_statistics',
				'burst_campaigns',
				'burst_locations',
				'burst_sessions',
				'burst_goals',
				'burst_goal_statistics',
				'burst_summary',
				'burst_archived_months',
				'burst_parameters',
				'burst_browsers',
				'burst_browser_versions',
				'burst_platforms',
				'burst_devices',
				'burst_referrers',
			],
		);

		// delete tables.
		foreach ( $table_names as $table_name ) {
			$sql = "DROP TABLE IF EXISTS {$wpdb->prefix}$table_name";
			$wpdb->query( $sql );
		}

		// options to delete.
		$options = apply_filters(
			'burst_table_db_options',
			[
				'burst_parameters_db_version',
				'burst_campaigns_db_version',
				'burst_stats_db_version',
				'burst_sessions_db_version',
				'burst_goals_db_version',
				'burst_goal_stats_db_version',
				'burst_archive_db_version',
				'burst_tasks',
				'burst_onboarding_free_completed',
			],
		);

		// delete options.
		foreach ( $options as $option_name ) {
			delete_option( $option_name );
			delete_site_option( $option_name );
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

		// options to delete.
		$options = [
			'burst_activation_time',
			'burst_set_defaults',
			'burst_review_notice_shown',
			'burst_run_premium_upgrade',
			'burst_tracking_status',
			'burst_table_size',
			'burst_import_geo_ip_on_activation',
			'burst_geo_ip_import_error',
			'burst_archive_dir',
			'burst_geo_ip_file',
			'burst_last_update_geo_ip',
			'burst_license_attempts',
			'burst_ajax_fallback_active',
			'burst_ajax_fallback_active_timestamp',
			'burst_tour_shown_once',
			'burst_options_settings',
			'burst-current-version',
			'burst_tasks',
			'burst_demo_data_installed',
		];
		// delete options.
		foreach ( $options as $option_name ) {
			delete_option( $option_name );
			delete_site_option( $option_name );
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