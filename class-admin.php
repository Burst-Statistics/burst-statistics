<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );
if ( ! class_exists( 'burst_admin' ) ) {
	class burst_admin {
		private static $_this;
		function __construct() {
			if ( isset( self::$_this ) ) {
				wp_die();
			}

			self::$_this = $this;
			add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

			$plugin = burst_plugin;
			add_filter( "plugin_action_links_$plugin", array( $this, 'plugin_settings_link' ) );

			// multisite
			add_filter( "network_admin_plugin_action_links_$plugin", [ $this, 'plugin_settings_link' ] );

			// column
			add_action( 'admin_init', array( $this, 'add_burst_admin_columns' ), 1 );
			add_action( 'pre_get_posts', array( $this, 'posts_orderby_total_pageviews' ), 1 );
			// deactivating
			add_action( 'admin_footer', array( $this, 'deactivate_popup' ), 40 );
			add_action( 'admin_init', array( $this, 'listen_for_deactivation' ), 40 );
			add_action( 'admin_init', array( $this, 'add_privacy_info' ), 10 );

			// remove tables on multisite uninstall
			add_filter( 'wpmu_drop_tables', [ $this, 'ms_remove_tables' ], 10, 2 );

			add_filter( 'burst_do_action', array( $this, 'maybe_delete_all_data' ), 10, 3 );

			add_filter( 'burst_after_saved_fields', [ $this, 'create_js_file' ], 10, 1 );
			add_action( 'upgrader_process_complete', [ $this, 'create_js_file' ], 10, 1 );
			add_action( 'wp_initialize_site', [ $this, 'create_js_file' ], 10, 1 );
			add_action( 'admin_init', [ $this, 'activation' ] );

			add_action( 'admin_bar_menu', array( $this, 'add_to_admin_bar_menu' ), 35 );
			add_action( 'admin_bar_menu', array( $this, 'add_top_bar_menu' ), 400 );
      add_action( 'burst_activation', [ $this, 'run_table_init_hook' ], 10, 1 );
      add_action( 'burst_activation', array( $this, 'setup_defaults' ), 20, 1 );

			add_action( 'upgrader_process_complete', [ $this, 'run_table_init_hook' ], 10, 1 );
			add_action( 'wp_initialize_site', [ $this, 'run_table_init_hook' ], 10, 1 );
			add_action( 'burst_upgrade', [ $this, 'run_table_init_hook' ], 10, 1 );
            add_action( 'burst_daily', array( $this, 'validate_tasks' ) );
            add_action( 'burst_validate_tasks', array( $this, 'validate_tasks' ) );

            if ( defined('BURST_BLUEPRINT') ) {
                add_action( 'init', [ $this, 'install_demo_data' ] );
            }

            add_action('burst_daily', [ $this, 'update_page_visit_counts' ] );
            add_action('burst_upgrade_post_meta', [ $this, 'update_page_visit_counts' ] );
		}

        public function update_page_visit_counts(): void
        {
            $offset = (int) get_option('burst_post_meta_offset', 0);
            $chunk = 100;
            $today = BURST()->statistics->convert_unix_to_date( strtotime( 'today' ) );
            // deduct days offset in days
            $yesterday = BURST()->statistics->convert_unix_to_date( strtotime( $today . ' - 1 days' ) );

            // get start of $yesterday in unix
            $date_start = BURST()->statistics->convert_date_to_unix( $yesterday . ' 00:00:00' );
            // get end of $yesterday in unix
            $date_end = BURST()->statistics->convert_date_to_unix( $yesterday . ' 23:59:59' );

            $sql = BURST()->statistics->get_sql_table($date_start, $date_end, ['page_url', 'pageviews'], [], 'page_url', 'pageviews DESC' );
            //add offset
            $sql .= " LIMIT $chunk OFFSET $offset";

            global $wpdb;
            $rows = $wpdb->get_results( $sql, ARRAY_A );

            if ( count ( $rows ) === 0 ) {
                delete_option('burst_post_meta_offset');
                wp_clear_scheduled_hook("burst_upgrade_post_meta");
            } else {
                update_option('burst_post_meta_offset', $offset, false);
                wp_schedule_single_event(time() + MINUTE_IN_SECONDS , 'burst_upgrade_post_meta' );
                foreach ( $rows  as $row ) {
                    $post_id = url_to_postid($row['page_url']);
                    if ( !$post_id ) {
                        continue;
                    }
                    $pageviews = BURST()->statistics->get_post_views($post_id, 0, time() );
                    update_post_meta($post_id, 'burst_total_pageviews_count', $pageviews );
                }
            }
        }

        /**
         * Once a day, check if any tasks need to be added again
         *
         * @return void
         */
        public function validate_tasks(){
            BURST()->tasks->validate_tasks();
        }

		public static function this() {
			return self::$_this;
		}

        private function insert_row($table, $rows){
            global $wpdb;
            $table = "{$wpdb->prefix}burst_$table";
            foreach ( $rows as $row ) {
	            $wpdb->insert(
		            $table,
		            $row
	            );
            }
        }

        private function get_random_referrer(){
            $referrers = [
                    'https://www.google.com',
                    'https://duckduckgo.com',
                    'https://bing.com',
                    'https://burst-statistics.com',
            ];
	        return $referrers[array_rand($referrers)];
        }

        /**
         * Check if table exists
         *
         * @param string $table
         * @return bool
         */
        private function table_exists(string $table ): bool
        {
            global $wpdb;
            return (bool) $wpdb->query( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->prefix . sanitize_title($table) ) );
        }

		/**
         * Install demo data in Burst if blueprint.json is active
         *
		 * @return void
		 */
        public function install_demo_data(): void
        {
            if ( !$this->table_exists('burst_statistics') ) {
                return;
            }

            if ( !get_option( 'burst_demo_data_installed' ) ){
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
	            $this->insert_row('browsers', $data);

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
	            $this->insert_row('platforms', $data);

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
                $this->insert_row('platforms', $data);
                //get all demo pages
                $posts = get_posts( array(
                    'post_type' => ['page', 'post'],
                    'post_status' => 'publish',
                    'posts_per_page' => -1,
                ) );
	            $start_date_unix = time();
	            $total_days = 30;
                //we're walking back in time, so to get an increasing nr of pageviews, we decrease the max views each day.
                $max_views = 200;
	            for ( $i = 0; $i < $total_days; $i++ ) {
		            $stats_date_unix = $start_date_unix - ( $i * DAY_IN_SECONDS );
		            $stats_date = BURST()->statistics->convert_unix_to_date( $stats_date_unix ); // 2022-02-07
                    $total_entry_added = false;
		            $max_views -= $i * 5;
                    $min_views = 5;
                    if ( $max_views <= $min_views ) {
                        $max_views = $min_views+5;
                    }
                    foreach ( $posts as $post ) {
                        $post_id = $post->ID;

                        $page_url = str_replace(home_url(), '', get_permalink( $post_id ) );
                        $visitors = random_int( $min_views, $max_views );
                        $page_views = 2 * $visitors;
                        $sessions = Round(0.5 * $visitors, 0 );
                        $first_time_visitors = Round(0.1 * $visitors, 0 );
                        $bounces = Round(0.03 * $visitors, 0 );
                        $wpdb->insert(
                            "{$wpdb->prefix}burst_summary",
                            [
                                'date' => $stats_date,
                                'page_url' => $page_url,
                                'sessions' => $sessions,
                                'pageviews' => $page_views,
                                'visitors' => $first_time_visitors,
                                'first_time_visitors' => $first_time_visitors,
                                'bounces' => $bounces,
                                'avg_time_on_page' => rand(20, 3 * MINUTE_IN_SECONDS ),
                                'completed' => 1,
                            ]
                        );

	                    $wpdb->insert(
		                    "{$wpdb->prefix}burst_statistics",
		                    [
			                    'time' => $stats_date_unix,
			                    'page_url' => $page_url,
			                    'uid' => random_int( 1, 1000 ),
			                    'first_time_visit' => 1,
			                    'bounce' => random_int(0,1),
			                    'browser_id' => random_int( 1, 3 ),
			                    'device_id' => random_int( 1, 3 ),
			                    'platform_id' => random_int( 1, 3 ),
			                    'time_on_page' => rand(20, 3 * MINUTE_IN_SECONDS ),
                                'referrer'  => $this->get_random_referrer(),
		                    ]
	                    );

                        $post_hit_count = get_post_meta( $post_id, 'burst_total_pageviews_count', true );
	                    $post_hit_count = $post_hit_count ?: 0;
	                    $post_hit_count += $page_views;
                        update_post_meta( $post_id, 'burst_total_pageviews_count', $post_hit_count );
                        if ( !$total_entry_added ) {
                            $wpdb->insert(
                                "{$wpdb->prefix}burst_summary",
                                [
                                    'date' => $stats_date,
                                    'page_url' => 'burst_day_total',
                                    'sessions' => $sessions,
                                    'pageviews' => $page_views,
                                    'visitors' => $first_time_visitors,
                                    'first_time_visitors' => $first_time_visitors,
                                    'bounces' => $bounces,
                                    'avg_time_on_page' => rand(20, 3 * MINUTE_IN_SECONDS ),
                                    'completed' => 1,
                                ]
                            );
                            $total_entry_added = true;
                        }
                    }
                }

                update_option( 'burst_demo_data_installed', true );
            }
        }

		public function add_to_admin_bar_menu( $wp_admin_bar ) {
			if ( ! burst_user_can_view() || is_admin() ) {
				return;
			}

			// don't show on subsites if networkwide activated, and this is not the main site.
			if ( burst_is_networkwide_active() && ! is_main_site() ) {
				return;
			}

			$wp_admin_bar->add_node(
				[
					'parent' => 'site-name',
					'id'     => 'burst-statistics',
					'title'  => __( 'Statistics', 'burst-statistics' ),
					'href'   => burst_dashboard_url,
				]
			);
		}

		/**
		 * Add top bar menu for page views
		 *
		 * @param $wp_admin_bar
		 *
		 * @return void
		 */
		public function add_top_bar_menu( $wp_admin_bar ) {
			global $wp_admin_bar;
			if ( is_admin() ) {
				return;
			}

			if ( ! burst_user_can_view() ) {
				return;
			}

			global $post;
			if ( $post && is_object( $post ) ) {
				$count = (int) get_post_meta( $post->ID, 'burst_total_pageviews_count', true );
			} else {
				$count = 0;
			}
			$wp_admin_bar->add_menu(
				[
					'id'    => 'burst-front-end',
					'title' => $count . ' ' . __( 'Pageviews', 'burst-statistics' ),
				]
			);
			$wp_admin_bar->add_menu(
				[
					'parent' => 'burst-front-end',
					'id'     => 'burst-statistics-link',
					'title'  => __( 'Go to dashboard', 'burst-statistics' ),
					'href'   => burst_dashboard_url,
				]
			);
		}

		public function activation() {
			if ( ! burst_admin_logged_in() ) {
				return;
			}

			if ( get_option( 'burst_run_activation' ) ) {
                do_action('burst_activation');
                delete_option( 'burst_run_activation' );
                BURST()->tasks->add_initial_tasks();
            }
		}

		/**
         * Compile js file from settings and javascript so we can prevent inline variables
         *
		 * @return void
		 */
		public function create_js_file() {
			if ( ! burst_user_can_manage() ) {
				return;
			}

			$cookieless      = burst_get_option( 'enable_cookieless_tracking' );
			$cookieless_text = $cookieless == '1' ? '-cookieless' : '';
			$localize_args = apply_filters(
				'burst_tracking_options',
				BURST()->frontend->get_tracking_options()
			);

			$js = '';
			$js .= 'let burst = ' . json_encode( $localize_args ) . ';';
			$js .= file_get_contents( burst_path . "assets/js/build/burst$cookieless_text.min.js" );

			$upload_dir = burst_upload_dir( 'js' );
			$file       = $upload_dir . 'burst.min.js';
			if ( file_exists( $upload_dir ) && is_writable( $upload_dir ) ) {
				$handle = fopen( $file, 'wb' );
				fwrite( $handle, $js );
				fclose( $handle );
			}
		}

		/**
		 * On Multisite site creation, run table init hook as well.
		 *
		 * @return void
		 */
		public function run_table_init_hook() {
			// if already running, exit
			if ( defined( 'BURST_INSTALL_TABLES_RUNNING' ) ) {
				return;
			}

			define( 'BURST_INSTALL_TABLES_RUNNING', true );

			if ( get_transient( 'burst_running_upgrade' ) ) {
				return;
			}


			//don't run on uninstall
            if (defined('BURST_UNINSTALLING')) {
                return;
            }

			set_transient( 'burst_running_upgrade', true, 30 );
			do_action( 'burst_install_tables' );
			// we need to run table creation across subsites as well.
			if ( is_multisite() ) {
				$sites = get_sites();
				if ( count( $sites ) > 0 ) {
					foreach ( $sites as $site ) {
						switch_to_blog( $site->blog_id );
						do_action( 'burst_install_tables' );
						restore_current_blog();
					}
				}
			}
		}

		/**
		 * Add some privacy info
		 */
		public function add_privacy_info() {
			if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
				return;
			}

			$content = sprintf(
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
		 * enqueue some assets
		 *
		 * @param $hook
		 */
		public function enqueue_assets( $hook ) {
			if ( $hook === 'toplevel_page_burst' ) {
				$min  = ! is_rtl() && ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
				$rtl  = is_rtl() ? 'rtl/' : '';
				$url  = trailingslashit( burst_url ) . "assets/css/{$rtl}admin{$min}.css";
				$path = trailingslashit( burst_path ) . "assets/css/{$rtl}admin{$min}.css";
				wp_enqueue_style( 'burst-admin', $url, [ 'wp-components' ], filemtime( $path ) );
			}
		}

		/**
		 * Setup default settings used for tracking
		 *
		 * @return void
		 */
		public function setup_defaults(): void {
			if ( get_option( 'burst_set_defaults' ) ) {
				update_option( 'burst_activation_time', time(), false );
				update_option( 'burst_last_cron_hit', time(), false );
				$this->run_table_init_hook();
				// tables installed, now set defaults
				$exclude_roles = burst_get_option( 'user_role_blocklist' );
				if ( ! $exclude_roles ) {
					$defaults = array( 'administrator' );
					burst_update_option( 'user_role_blocklist', $defaults );
				}

				$mailinglist = burst_get_option( 'email_reports_mailinglist' );
				if ( ! $mailinglist ) {
					$defaults = array( array( 'email' => get_option( 'admin_email' ), 'frequency' => 'monthly' ) );
					burst_update_option( 'email_reports_mailinglist', $defaults );
				}

                if ( !$this->table_exists('burst_goals') ) {
                    return;
                }

				// set default goal
				// if there is no default goal, then insert one
				$goals = BURST()->goals->get_goals();
				$count = count( $goals );
				if ( $count === 0 ) {
					require_once burst_path . 'goals/class-goal.php';
					$goal        = new burst_goal();
					$goal->title = __( 'Default goal', 'burst-statistics' );
					$goal->save();
				}
				delete_option( 'burst_set_defaults' );
			}
		}

		/**
		 * Add custom link to plugins overview page
		 *
		 * @hooked plugin_action_links_$plugin
		 *
		 * @param array $links
		 *
		 * @return array $links
		 */
		public function plugin_settings_link( $links ) {
			$settings_link = '<a href="'
			                 . admin_url( 'admin.php?page=burst#settings' )
			                 . '" class="burst-settings-link">'
			                 . __( 'Settings', 'burst-statistics' ) . '</a>';
			array_unshift( $links, $settings_link );

			$support_link = defined( 'burst_free' )
				? 'https://wordpress.org/support/plugin/burst-statistics'
				: burst_get_website_url( 'support', [
					'burst_source'  => 'plugin-overview',
					'burst_content' => 'support-link',
				] );
			$faq_link     = '<a target="_blank" href="' . $support_link . '">'
			                . __( 'Support', 'burst-statistics' ) . '</a>';
			array_unshift( $links, $faq_link );

			if ( ! defined( 'burst_pro' ) ) {
				$upgrade_link
					= '<a style="color:#2e8a37;font-weight:bold" target="_blank" href="' . burst_get_website_url( 'pricing', [ 'burst_source' => 'plugin-overview' ] ) . '">'
					  . __( 'Upgrade to Pro', 'burst-statistics' ) . '</a>';
				array_unshift( $links, $upgrade_link );
			}

			return $links;
		}

		/**
		 * Add counts column
		 *
		 * @param $column_title
		 * @param $post_type
		 * @param $cb
		 *
		 * @return void
		 * @since 1.1
		 */
		public function add_admin_column( $column_name, $column_title, $post_type, $sortable, $cb ) {
			// Add column
			add_filter(
				'manage_' . $post_type . '_posts_columns',
				function( $columns ) use ( $column_name, $column_title ) {
					$columns[ $column_name ] = $column_title;

					return $columns;
				}
			);

			// Add column content
			add_action(
				'manage_' . $post_type . '_posts_custom_column',
				function( $column, $post_id ) use ( $column_name, $column_title, $cb ) {
					if ( $column_name === $column ) {
						$cb( $post_id );
					}
				},
				10,
				2
			);

			// Add sortable column
			if ( $sortable ) {
				add_filter(
					'manage_edit-' . $post_type . '_sortable_columns',
					function( $columns ) use ( $column_name, $column_title ) {
						$columns[ $column_name ] = $column_name;

						return $columns;
					}
				);
			}
		}

		/**
		 * Function to add pageviews column to post table
		 *
		 * @return void
		 * @since 1.1
		 */
		public function add_burst_admin_columns() {
			if ( ! burst_user_can_view() ) {
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
					function( $post_id ) {
						echo (int) get_post_meta( $post_id, 'burst_total_pageviews_count', true );
					}
				);
			}
		}

		public function posts_orderby_total_pageviews( $query ) {
			if ( ! is_admin() || ! $query->is_main_query() || ! burst_user_can_view() ) {
				return;
			}

			if ( 'pageviews' === $query->get( 'orderby' ) ) {
				$query->set( 'orderby', 'meta_value_num title' );
				$query->set( 'meta_key', 'burst_total_pageviews_count' );
                // Ensure posts with meta_value = 0 or no meta_value are included
                add_filter( 'get_meta_sql', array($this, 'filter_get_meta_sql') );
			}
		}

        /**
         * because WordPress by default excludes 0 value post meta's, we need to change the inner join to a left join
         * to include posts with 0 pageviews.
         * Might be included in core later
         * https://core.trac.wordpress.org/ticket/19653
         *
         * @param array $clauses
         * @return array
         */
        public function filter_get_meta_sql( array $clauses ) : array  {
            remove_filter( 'get_meta_sql', 'filter_get_meta_sql_19653' );

            // Change the inner join to a left join,
            // and change the where so it is applied to the join, not the results of the query.
            $clauses['join']  = str_replace( 'INNER JOIN', 'LEFT JOIN', $clauses['join'] ) . $clauses['where'];
            $clauses['where'] = '';

            return $clauses;
        }

		/**
		 * Check if the current day falls within the required date range (November 25, 00:00 to December 2, 23:59) based on GMT.
		 *
		 * @return bool
		 */
		public function is_bf() {
            // Get current date and time in GMT as timestamp
			$current_date = strtotime(gmdate('Y-m-d H:i:s'));

			// Define the start and end dates for the range in GMT (including specific times)
			$start_date = strtotime('November 25 2024 00:00:00 GMT');
			$end_date   = strtotime('November 29 2024 23:59:59 GMT');

			// Check if the current date and time falls within the date range
			if ( $current_date >= $start_date && $current_date <= $end_date ) {
				return true;
			}

			return false;
		}


        public function is_cm() {
	        // Get current date and time in GMT as timestamp
	        $current_date = strtotime(gmdate('Y-m-d H:i:s'));

	        // Define the start and end dates for the range in GMT (including specific times)
	        $start_date = strtotime('November 30 00:00:00 GMT');
	        $end_date   = strtotime('December 2 23:59:59 GMT');

	        // Check if the current date and time falls within the date range
	        if ( $current_date >= $start_date && $current_date <= $end_date ) {
		        return true;
	        }

	        return false;
        }


		/**
		 *
		 * Add a button and thickbox to deactivate the plugin
		 *
		 * @since  1.0
		 *
		 * @access public
		 */
		public function deactivate_popup() {
			// only on plugins page
			$screen = get_current_screen();
			if ( ! $screen || ($screen->base !== 'plugins' && $screen->base !== 'plugins-network') ) {
				return;
			}
			$networkwide = $screen->base === 'plugins-network';
			$slug = sanitize_title( burst_plugin_name );

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

                $(document).on('click', '#deactivate-<?php echo $slug; ?>', function(e) {
                  e.preventDefault();
                  tb_show('', '#TB_inline?height=420&inlineId=deactivate_and_delete_data', 'null');
                  $('#TB_window').addClass('burst-deactivation-popup');

                });
                if ($('#deactivate-<?php echo $slug; ?>').length) {
                  $('.burst-button-deactivate').attr('href', $('#deactivate-<?php echo $slug; ?>').attr('href'));
                }

              });
            </script>

            <div id="deactivate_and_delete_data" style="display: none;">
                <div class="burst-deactivate-notice-content">
                    <h4 style="margin:0 0 20px 0; text-align: left; font-size: 1.1em;">
						<?php _e( 'To deactivate the plugin correctly, please select if you want to:', 'burst-statistics' ); ?></h4>
                    <ul style="text-align: left;">

                        <li><?php _e( 'Deactivate', 'burst-statistics' ); ?></li>
                        <li>
							<?php _e( 'Deactivate, and remove all statistics, experiments and settings.', 'burst-statistics' ); ?>
							<?php _e( 'The data will be gone forever.', 'burst-statistics' ); ?>
                            <?php if ($networkwide) {
                                _e( 'As you are deactivating networkwide, this will also remove all data from all subsites.', 'burst-statistics' );
                            }?>
                        </li>
                    </ul>
                </div>

				<?php
				$token                              = wp_create_nonce( 'burst_deactivate_plugin' );
				$deactivate_and_remove_all_data_url = add_query_arg(
					array(
						'action' => 'uninstall_delete_all_data',
						'networkwide' => $networkwide ? '1' : '0',
						'token'  => $token,
					),
					admin_url( 'plugins.php' )
				);
				?>
                <div class="burst-deactivate-notice-footer">
                    <a class="button button-default" href="#"
                       id="burst_close_tb_window"><?php _e( 'Cancel', 'burst-statistics' ); ?></a>
                    <a class="button button-primary burst-button-deactivate"
                       href="#"><?php _e( 'Deactivate', 'burst-statistics' ); ?></a>
                    <a class="button button-burst-tertiary"
                       href="<?php echo esc_url( $deactivate_and_remove_all_data_url ); ?>"><?php _e( 'Deactivate and delete all data', 'burst-statistics' ); ?></a>
                </div>
            </div>
			<?php
		}

		/**
		 * Deactivate the plugin, based on made choice regarding data
		 */
		public function listen_for_deactivation(): void {
			// check user role
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return;
			}

			// check nonce
			if ( ! isset( $_GET['token'] ) || ( ! burst_verify_nonce( $_GET['token'], 'burst_deactivate_plugin' ) ) ) {
				return;
			}

			// check for action
			if ( isset( $_GET['action'] ) && $_GET['action'] === 'uninstall_delete_all_data' ) {
				define( 'BURST_NO_UPGRADE', true );
                define( 'BURST_UNINSTALLING', true );
				burst_clear_scheduled_hooks();

				$networkwide = isset( $_GET['networkwide'] ) && $_GET['networkwide'] === '1';
				if ( $networkwide && is_multisite() ) {
					$sites = get_sites();
					if ( count( $sites ) > 0 ) {
						foreach ( $sites as $site ) {
							switch_to_blog( $site->blog_id );
							$this->delete_all_burst_data();
							$this->delete_all_burst_configuration();
							restore_current_blog();
						}
					}
				}
				$this->delete_all_burst_data();
				$this->delete_all_burst_configuration();
				burst_clear_scheduled_hooks();
				deactivate_plugins( burst_plugin, false, $networkwide );
				$redirect_slug = $networkwide ? 'network/plugins.php' : 'plugins.php';

				wp_redirect( admin_url($redirect_slug ) );
				exit;
			}
		}

		/**
		 * Clear all data from the reset button in the settings
		 *
		 * @param array  $output
		 * @param string $action
		 * @param        $data
		 *
		 * @return array
		 */
		public function maybe_delete_all_data( array $output, string $action, $data ): array
        {
			if ( ! burst_user_can_manage() ) {
				return $output;
			}
            
			if ( $action === 'reset' ) {
				// delete everything
				$this->delete_all_burst_data();

				// immediately run setup defaults, so db tables get made
				$this->setup_defaults();
                $this->run_table_init_hook();

                $output = [
					'success' => true,
					'message' => __( 'Successfully cleared data.', 'burst-statistics' ),
				];
			}

			return $output;
		}

		/**
		 * Clear plugin data
		 */
		public function delete_all_burst_data() {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return;
			}

			global $wpdb;

			// post meta to delete
			$post_meta = array(
				'burst_total_pageviews_count',
			);

			if ( ! function_exists( 'delete_post_meta_by_key' ) ) {
				require_once ABSPATH . WPINC . '/post.php';
			}
			foreach ( $post_meta as $post_meta_key ) {
				delete_post_meta_by_key( $post_meta_key );
			}

			// tables to delete
			$table_names = apply_filters(
				'burst_all_tables',
				[
					'burst_statistics',
					'burst_campaigns',
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
					'burst_summary',
				]
			);

			// delete tables
			foreach ( $table_names as $table_name ) {
				$sql = "DROP TABLE IF EXISTS $wpdb->prefix$table_name";
				$wpdb->query( $sql );
			}

			// options to delete
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
                    'burst_tasks'
				]
			);

			// delete options
			foreach ( $options as $option_name ) {
				delete_option( $option_name );
				delete_site_option( $option_name );
			}

		}

		public function delete_all_burst_configuration() {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return;
			}

			global $wp_roles;
			global $wpdb;

			// capabilities to delete
			$roles        = $wp_roles->roles;
			$capabilities = [
				'manage_burst_statistics',
				'view_burst_statistics',
			];

			// delete user capabilities from all user roles
			foreach ( $roles as $role_name => $role_info ) {
				foreach ( $capabilities as $capability ) {
					$wp_roles->remove_cap( $role_name, $capability );
				}
			}


			// options to delete
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
				'burst_tour_shown_once',
				'burst_options_settings',
				'burst-current-version',
                'burst_tasks'
			];
			// delete options
			foreach ( $options as $option_name ) {
				delete_option( $option_name );
				delete_site_option( $option_name );
			}

			// get all burst transients
			$results = $wpdb->get_results(
				"SELECT `option_name` AS `name`, `option_value` AS `value`
                                FROM  $wpdb->options
                                WHERE `option_name` LIKE '%transient_burst%'
                                ORDER BY `option_name`",
				'ARRAY_A'
			);
			// loop through all burst transients and delete
			foreach ( $results as $key => $value ) {
				$transient_name = substr( $value['name'], 11 );
				delete_transient( $transient_name );
			}

		}

		/**
		 * Drop tables during the site deletion
		 *
		 * @param array $tables  The tables to drop.
		 * @param int   $blog_id The site ID.
		 *
		 * @return array
		 */
		public
		function ms_remove_tables(
			$tables, $blog_id
		) {
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
} //class closure
