<?php
defined( 'ABSPATH' ) or die();
if ( ! class_exists( "burst_notices" ) ) {
	class burst_notices {
		private static $_this;

		public $notices;

		function __construct( $args = array() ) {
			if ( isset( self::$_this ) ) {
				wp_die( burst_sprintf( '%s is a singleton class and you cannot create a second instance.',
					get_class( $this ) ) );
			}
			add_action( 'wp_ajax_burst_dismiss_notice', array( $this, 'dismiss_notice' ) );

		}
		static function this() {
			return self::$_this;
		}

		public function get() {
			return [
				'notices' => $this->notices(),
			];
		}

		public function notices(){
			$notices = BURST()->notices->get_notices_list(array( 'status' => 'all' ));
			$out = [];
			foreach ($notices as $id => $notice ) {
				$notice['id'] = $id;
				$out[] =  $notice;
			}
			return $out;
		}

		/**
		 * Process the react dismissal of a task
		 *
		 * Since 3.1
		 *
		 * @access public
		 *
		 */

		public function dismiss_notice($data)
		{
			if ( isset($data['id']) ) {
				$id = sanitize_title( $data['id'] );
				update_option( "burst_".$id."_dismissed", true, false );
				delete_transient( 'burst_plusone_count' );
			}

			return true;
		}

		/**
		 * Get array of notices
		 * - condition: function returning boolean, if notice should be shown or not
		 * - callback: function, returning boolean or string, with multiple possible answers, and resulting messages and icons
		 * @param array $args
		 * @return array
		 */

		public function get_notices_list(array $args = array() ): array
        {
			$icon_labels = [
				'completed' => __( "Completed", "burst-statistics" ),
				'new'     => __( "New!", "burst-statistics" ),
				'warning' => __( "Warning", "burst-statistics" ),
				'error' => __( "Error", "burst-statistics" ),
				'open'    => __( "Open", "burst-statistics" ),
				'pro' => __( "Pro", "burst-statistics" ),
				'sale' => __( "Sale", "burst-statistics" ),
			];

			$defaults = array(
				'admin_notices'      => false,
				'pro_only'       => false,
				'dismiss_on_upgrade' => false,
				'status'             => 'open', //status can be "all" (all tasks, regardless of dismissed or open), "open" (not success/completed) or "completed"
			);
			$args = wp_parse_args($args, $defaults);

			$cache_admin_notices = !$this->is_burst_page() && $args['admin_notices'];

			//if we're on the settings page, we need to clear the admin notices transient, because this list never gets requested on the settings page, and won'd get cleared otherwise
			if ( $this->is_burst_page() ) {
				delete_transient('burst_admin_notices');
			}
			if ( $cache_admin_notices) {
				$cached_notices = get_transient('burst_admin_notices');
				if ( $cached_notices ) {
					return $cached_notices;
				}
			}

			$notice_defaults = array(
				'condition' => array(),
				'callback' => false,
			);

			$notices = [
				'ajax_fallback' => array(
					'condition'  => array(
						'wp_option_burst_ajax_fallback_active',
					),
					'callback' => '_true_',
					'output' => array(
						'true' => array(
							'msg' => __( "Please check if your REST API is loading correctly. Your site currently is using the slower Ajax fallback method to load the settings.", 'burst-statistics' ),
							'icon' => 'warning',
							'admin_notice' => false,
							'url' => burst_get_website_url('instructions/rest-api-error/', [
								'burst_source' => 'notices',
								'burst_content' => 'ajax-fallback'
							]),
							'dismissible' => true,
							'plusone' => true,
						),
					),
				),
				'tracking-error' => [
					'callback' => 'burst_tracking_status_error',
					'output' => array(
						'true' => array(
							'msg' => __( "Due to your server or website configuration it is not possible to track statistics.", 'burst-statistics' ),
							'url' => burst_get_website_url('instructions/tracking-error/', [
								'burst_source' => 'notices',
								'burst_content' => 'tracking-error'
							]),
							'icon' => 'error',
							'dismissible' => false,
						),
					),
				],
				'bf_notice2024' => [
					'condition'  => [
						'BURST()->admin->is_bf',
					],
					'callback' => '_true_',
					'output' => [
						'true' => [
							'msg' => __("Black Friday", 'burst-statistics') . ": " . __("Get 40% Off Burst Pro!", 'burst-statistics') . " — " . __("Limited time offer!", 'burst-statistics'),
							'icon' => 'sale',
							'url' => burst_get_website_url('pricing/', [
								'burst_content' => 'black-friday',
								'burst_source' => 'notices',
							]),
							'dismissible' => true,
							'plusone' => true,
						],
					],
				],
				'cm_notice2024' => [
					'condition'  => [
						'BURST()->admin->is_cm'
					],
					'callback' => '_true_',
					'output' => [
						'true' => [
							'msg' => __("Cyber Monday", 'burst-statistics') . ": " . __("Get 40% Off Burst Pro!", 'burst-statistics') . " — " . __("Last chance!", 'burst-statistics'),
							'icon' => 'sale',
							'url' => burst_get_website_url('pricing/', [
								'burst_content' => 'cyber-monday',
								'burst_source' => 'notices',
							]),
							'dismissible' => true,
							'plusone' => true,
						],
					],
				],

				'new_parameters' => [
					'condition' => [
						'burst_is_pro'
					],
					'callback'  => '_true_',
					'output'    => [
						'true' => [
							'msg'         => __( "New! Track your UTM Campaigns and URL Parameters! Click on the 'Pages' dropdown in the Statistics tab.", 'burst-statistics' ),
							'icon'        => 'new',
							'url'         => '#statistics',
							'dismissible' => true,
							'plusone'     => false,
						],
					],
				],
				'new_email_reporting' => [
					'callback'  => '_true_',
					'output'    => [
						'true' => [
							'msg'         => __( "New! Send weekly or monthly email reports to multiple recipients.", 'burst-statistics' ),
							'icon'        => 'new',
							'url'         => '#settings',
							'dismissible' => true,
							'plusone'     => false,
						],
					],
				],
				'leave-feedback' => [
					'callback' => '_true_',
					'status' => 'all',
					'output' => array(
						'true' => array(
							'msg' => burst_sprintf(
								__( 'If you have any suggestions to improve our plugin, feel free to %sopen a support thread%s.', 'burst-statistics' ),
								'<a href="https://wordpress.org/support/plugin/burst-statistics/" target="_blank">',
								'</a>'),
							'icon' => 'completed',
							'dismissible' => false,
						),
					),
				],
			];


			$notices = apply_filters('burst_notices', $notices);
			foreach ($notices as $id => $notice) {
				$notices[$id] = wp_parse_args($notice, $notice_defaults);
			}

			/**
			 * If a list of notices that should be dismissed on upgrade is requested
			 */
			if ( $args['dismiss_on_upgrade'] ) {
				$output = array();
				foreach( $notices as $key => $notice ) {
					if ( isset($notice['dismiss_on_upgrade']) && $notice['dismiss_on_upgrade'] ) {
						$output[] = $key;
					}
				}
				return $output;
			}

			/**
			 * Filter out notice that do not apply, or are dismissed
			 */

			foreach ( $notices as $id => $notice ) {
				$func   = $notice['callback'];
				$output = $this->validate_function($func);

				//check if all notices should be dismissed
				if ( isset( $notice['output'][$output]['dismissible'] )
				     && $notice['output'][$output]['dismissible']
				     && burst_get_option('dismiss_all_notices')
				) {
					unset($notices[$id]);
					continue;
				}

				if ( !isset($notice['output'][ $output ]) ) {
					unset($notices[$id]);
					continue;
				} else {
					$notices[$id]['output'] = $notice['output'][ $output ];
				}

				$notices[$id]['output']['status'] = ( $notices[$id]['output']['icon'] !== 'success') ? 'open' : 'completed';
				if ( $args['status'] === 'open' && ($notices[$id]['output']['status'] === 'completed' ) ){
					unset($notices[$id]);
					continue;
				}
				$condition_functions = $notice['condition'];
				foreach ( $condition_functions as $func ) {
					$condition = $this->validate_function($func, true);
					if ( ! $condition ) {
						unset($notices[$id]);
					}
				}

				if ( isset($notices[$id]) ) {
					$notices[$id]['output']['label'] = $icon_labels[ $notices[$id]['output']['icon'] ];
				}

				//only remove this option if it's both dismissed AND not completed. This way we keep completed notices in the list.
				if ( isset($notices[$id]) && get_option( "burst_" . $id . "_dismissed" ) && $notices[$id]['output']['status'] !== 'completed') {
					unset($notices[$id]);
				}
			}

			//if only admin_notices are required, filter out the rest.
			if ( $args['admin_notices'] ) {
				foreach ( $notices as $id => $notice ) {
					if (!isset($notice['output']['admin_notice']) || !$notice['output']['admin_notice']){
						unset( $notices[$id]);
					}
				}
				//ensure an empty list is also cached
				$cache_notices = empty($notices) ? 'empty' : $notices;
				set_transient('burst_admin_notices', $cache_notices, WEEK_IN_SECONDS );
			}

			//sort so warnings are on top
			$warnings = array();
			$open = array();
			$other = array();
            $dismiss_non_error_notices = burst_get_option( 'dismiss_non_error_notices' );
			foreach ($notices as $key => $notice){
				if (!isset($notice['output']['icon'])) continue;

                if ( $dismiss_non_error_notices && $notice['output']['icon']!=='error' ) {
                    unset($notices[$key]);
                    continue;
                }
                
				if ($notice['output']['icon']==='warning') {
					$warnings[$key] = $notice;
				} else if ($notice['output']['icon']==='open') {
					$open[$key] = $notice;
				} else {
					$other[$key] = $notice;
				}
			}
			$notices = $warnings + $open + $other;

			//if we only want a list of pro notices
			if ( $args['pro_only'] ) {
				foreach ($notices as $key => $notice){
					if ( !isset($notice['output']['icon']) || $notice['output']['icon'] !== 'pro' ) {
						unset($notices[$key]);
					}
				}
			}
			return $notices;
		}

		/**
		 * Count number of pro notices we have in the list.
		 * @return int
		 */
		public function get_lowest_possible_task_count() {
			$pro_notices = $this->get_notices_list(array('pro_only'=>true));
			return count($pro_notices) ;
		}

		/**
		 * Count the plusones
		 *
		 * @return int
		 *
		 * @since 3.2
		 */

		public function count_plusones() {
			if ( ! burst_user_can_manage() ) {
				return 0;
			}

			$cache = !$this->is_burst_page();
			$count = get_transient( 'burst_plusone_count' );
			if ( !$cache || ($count === false) ) {
				$count = 0;
				$notices = $this->get_notices_list();
				foreach ( $notices as $id => $notice ) {
					$success = ( isset( $notice['output']['icon'] ) && ( $notice['output']['icon'] === 'success' ) ) ? true : false;
					if ( ! $success
					     && isset( $notice['output']['plusone'] )
					     && $notice['output']['plusone']
					) {
						$count++;
					}
				}

				if ( $count==0 ) {
					$count = 'empty';
				}
				set_transient( 'burst_plusone_count', $count, DAY_IN_SECONDS );
			}

			if ( $count==='empty' ) {
				return 0;
			}
			return $count;
		}

		public function is_burst_page()
		{
			if ( burst_is_logged_in_rest() ) {
				return true;
			}

			if ( !isset($_SERVER['QUERY_STRING']) ) {
				return false;
			}

			parse_str($_SERVER['QUERY_STRING'], $params);
			if ( array_key_exists("page", $params) && ($params["page"] == "burst") ) {
				return true;
			}

			return false;
		}

		/**
		 * Get output of function, in format 'function', or 'class()->sub()->function'
		 * @param string $func
		 * @param bool $is_condition // if the check is a condition, which should return a boolean
		 * @return string|bool
		 */

		private function validate_function($func, $is_condition = false ){
			$invert = false;
			if (strpos($func, 'NOT ') !== FALSE ) {
				$func = str_replace('NOT ', '', $func);
				$invert = true;
			}

			if ( strpos($func, 'wp_option_')!==false ) {
				$output = get_option(str_replace('wp_option_', '', $func) )!==false;
			} else if ( $func === '_true_') {
				$output = true;
			} else if ( $func === '_false_' ) {
				$output = false;
			} else {
				if ( preg_match( '/(.*)\(\)\-\>(.*)->(.*)/i', $func, $matches)) {
					$base = $matches[1];
					$class = $matches[2];
					$function = $matches[3];
					$output = call_user_func( array( $base()->{$class}, $function ) );
				} else {
					$output = $func();
				}

				if ( $invert ) {
					$output = !$output;
				}
			}

			//stringyfy booleans
			if (!$is_condition) {
				if ( $output === false || $output === 0 ) {
					$output = 'false';
				}
				if ( $output === true || $output === 1 ) {
					$output = 'true';
				}
			}
			return sanitize_text_field($output);
		}

	}
}
