<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );
if ( ! class_exists( 'burst_frontend' ) ) {
	class burst_frontend {
		private static $_this;
		private $look_up_table_ids = array();

		function __construct() {
			if ( isset( self::$_this ) ) {
				wp_die(
					burst_sprintf(
						'%s is a singleton class and you cannot create a second instance.',
						get_class( $this )
					)
				);
			}

			self::$_this = $this;

			add_action( 'admin_bar_menu', array( $this, 'add_to_admin_bar_menu' ), 35 );
			add_action( 'admin_bar_menu', array( $this, 'add_top_bar_menu' ), 400 );
			add_action( 'init', array( $this, 'register_pageviews_block' ) );
			add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_time_tracking_script' ], 0 );
			add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_tracking_script' ], 0 );
			add_filter( 'script_loader_tag', [ $this, 'defer_burst_tracking_script' ], 10, 3 );

			add_shortcode( 'burst-most-visited', [ $this, 'most_visited_posts' ] );
		}


		static function this() {
			return self::$_this;
		}


		/**
		 * Enqueue some assets
		 *
		 * @param $hook
		 */
		public function enqueue_burst_time_tracking_script( $hook ) {
			$minified = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
			if ( ! $this->exclude_from_tracking() ) {
				wp_enqueue_script(
					'burst-timeme',
					burst_url . "helpers/timeme/timeme$minified.js",
					[],
					burst_version,
					false
				);
			}
		}

		/**
		 * Enqueue some assets
		 *
		 * @param $hook
		 */
		public function enqueue_burst_tracking_script( $hook ) {
			// don't enqueue if headless.
			if ( defined( 'BURST_HEADLESS' ) || burst_get_option( 'headless' ) ) {
				return;
			}

			if ( ! $this->exclude_from_tracking() ) {
				$in_footer               = burst_get_option( 'enable_turbo_mode' );
				$beacon_enabled          = (int) burst_tracking_status_beacon();
				$deps                    = $beacon_enabled ? array( 'burst-timeme' ) : array( 'burst-timeme', 'wp-api-fetch' );
				$combine_vars_and_script = burst_get_option( 'combine_vars_and_script' );
				if ( $combine_vars_and_script ) {
					$upload_url  = burst_upload_url( 'js' );
					$upload_path = burst_upload_dir( 'js' );
					wp_enqueue_script(
						'burst',
						$upload_url . 'burst.min.js',
						apply_filters( 'burst_script_dependencies', $deps ),
						filemtime( $upload_path . 'burst.min.js' ),
						$in_footer
					);
				} else {
					$tracking_options = $this->get_tracking_options();
					$minified        = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
					$cookieless      = $tracking_options['options']['cookieless'];
					$cookieless_text = $cookieless == '1' ? '-cookieless' : '';

					$localize_args = apply_filters(
						'burst_tracking_options',
						$tracking_options						
					);
					wp_enqueue_script(
						'burst',
						burst_url . "assets/js/build/burst$cookieless_text$minified.js",
						apply_filters( 'burst_script_dependencies', $deps ),
						burst_version,
						$in_footer
					);
					wp_localize_script(
						'burst',
						'burst',
						$localize_args
					);
				}
			}
		}

		/**
		 * Get tracking options for the localize_script and custom burst.js functions
		 *
		 * @return array
		 */
		public function get_tracking_options(): array {
			return [
				'tracking' => [
					'isInitialHit' => true,
					'lastUpdateTimestamp' => 0,
					'beacon_url' => burst_get_beacon_url()
				],
				'options' => [
					'cookieless' => (int) burst_get_option('enable_cookieless_tracking'),
					'pageUrl' => get_permalink(),
					'beacon_enabled' => (int) burst_tracking_status_beacon(),
					'do_not_track' => (int) burst_get_option('enable_do_not_track'),
					'enable_turbo_mode' => (int) burst_get_option('enable_turbo_mode'),
					'track_url_change' => (int) burst_get_option('track_url_change'),
					'cookie_retention_days' => apply_filters('burst_cookie_retention_days', 30)
				],
				'goals' => [
					'completed' => [],
					'scriptUrl' => burst_get_goals_script_url(),
					'active' => burst_get_active_goals()
				],
				'cache' => [
					'uid' => null,
					'fingerprint' => null,
					'isUserAgent' => null,
					'isDoNotTrack' => null,
					'useCookies' => null
				],
			];
		}

		

		public function defer_burst_tracking_script( $tag, $handle, $src ) {
			// time me load asap but async to avoid blocking the page load
			if ( 'burst-timeme' === $handle ) {
				return str_replace( ' src', ' async src', $tag );
			}

			$turbo = burst_get_option( 'enable_turbo_mode' );
			if ( $turbo ) {
				if ( 'burst' == $handle ) {
					return str_replace( ' src', ' defer src', $tag );
				}
			}

			if ( 'burst' === $handle ) {
				return str_replace( ' src', ' async src', $tag );
			}

			return $tag;
		}

		/**
		 * Get ID from lookup table, cached in class
		 *
		 * @param string $item
		 * @param null | string $value
		 *
		 * @return int
		 */
		public function get_lookup_table_id( string $item, $value):int {
			if ( isset( $this->look_up_table_ids[$item][$value] ) ){
				return $this->look_up_table_ids[$item][$value];
			}

			$ID = burst_get_lookup_table_id($item, $value);
 			$this->look_up_table_ids[$item][$value] = $ID;
			return (int) $ID;
		}

		/**
         * Check if this should be excluded from tracking
         *
		 * @return bool
		 */
		public function exclude_from_tracking() {
			if ( is_user_logged_in() ) {
				$user                = wp_get_current_user();
				$user_role_blocklist = burst_get_option( 'user_role_blocklist' );
				$get_excluded_roles  = is_array( $user_role_blocklist ) ? $user_role_blocklist : [ 'adminstrator' ];
				$excluded_roles      = apply_filters( 'burst_roles_excluded_from_tracking', $get_excluded_roles );
				if ( array_intersect( $excluded_roles, $user->roles ) ) {
					return true;
				}
				if ( is_preview() || burst_is_pagebuilder_preview() ) {
					return true;
				}
			}

			return false;
		}

		/**
		 * Show content conditionally, based on consent
		 *
		 * @param array  $atts
		 * @param string $content
		 * @param string $tag
		 *
		 * @return false|string
		 */
		public function most_visited_posts(
			$atts = [],
			$content = null,
			$tag = ''
		) {
			// normalize attribute keys, lowercase
			$atts = array_change_key_case( (array) $atts, CASE_LOWER );
			// override default attributes with user attributes
			$atts = shortcode_atts(
				[
					'count'      => 5,
					'post_type'  => 'post',
					'show_count' => false,
				],
				$atts,
				$tag
			);

			// sanitize post type
			$post_types = get_post_types();
			if ( ! in_array( $atts['post_type'], $post_types ) ) {
				$atts['post_type'] = 'post';
			}

			$count      = (int) $atts['count'];
			$show_count = (bool) $atts['show_count'];
			$post_type  = (string) $atts['post_type'];
			// posts, sorted by post_meta
			$args  = array(
				'post_type'   => $post_type,
				'numberposts' => $count,
				'meta_key'    => 'burst_total_pageviews_count',
				'orderby'     => 'meta_value_num',
				'order'       => 'DESC',
				'meta_query'  => array(
					'key'  => 'burst_total_pageviews_count', // Same meta key for sorting
					'type' => 'NUMERIC', // Make sure to specify the type as numeric for correct sorting
				),
			);
			$posts = get_posts( $args );
			ob_start();

			if ( count( $posts ) > 0 ) {
				?>
				<ul class="burst-posts-list">
					<?php
					foreach ( $posts as $post ) {
						$count      = (int) get_post_meta( $post->ID, 'burst_total_pageviews_count', true );
						$count_html = '';
						if ( $show_count ) {
							$count_html = '&nbsp;<span class="burst-post-count">(' . apply_filters( 'burst_most_visited_count', $count, $post ) . ')</span>';
						}
						?>

						<li class="burst-posts-list__item"><a href="<?php echo esc_url_raw( get_the_permalink( $post ) ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?><?php echo $count_html; ?></a></li>
					<?php } ?>
				</ul>
				<?php
			} else {
				?>
				<p class="burst-posts-list__not-found">
					<?php _e( 'No posts found', 'burst-statistics' ); ?>
				</p>
				<?php
			}
			return ob_get_clean();
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
			global $wpdb;
			if ( is_admin() ) {
				return;
			}

			if ( ! burst_user_can_view() ) {
				return;
			}
			global $post;
			if ( $post && is_object( $post ) ) {
				$post_id = $post->ID;
				$count   = (int) get_post_meta( $post_id, 'burst_total_pageviews_count', true );
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

		public function register_pageviews_block() {
			wp_register_script(
				'burst-pageviews-block-editor',
				plugins_url( 'blocks/pageviews.js', __FILE__ ), // Adjust the path to your JavaScript file
				[ 'wp-blocks', 'wp-element', 'wp-editor' ],
				filemtime( plugin_dir_path( __FILE__ ) . 'blocks/pageviews.js' )
			);
			wp_set_script_translations( 'burst-pageviews-block-editor', 'burst-statistics', burst_path . '/languages' );

			register_block_type(
				'burst/pageviews-block',
				[
					'editor_script'   => 'burst-pageviews-block-editor',
					'render_callback' => array( $this, 'render_burst_pageviews' ),
				]
			);
		}

		public function render_burst_pageviews() {
			global $post;
			$burst_total_pageviews_count = get_post_meta( $post->ID, 'burst_total_pageviews_count', true );
			$count                       = (int) $burst_total_pageviews_count ?: 0;
			$text                        = sprintf( _n( 'This page has been viewed %d time.', 'This page has been viewed %d times.', $count, 'burst-statistics' ), $count );

			return '<p class="burst-pageviews">' . $text . '</p>';
		}
	}
}