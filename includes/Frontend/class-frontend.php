<?php
namespace Burst\Frontend;

use Burst\Frontend\Goals\Goals;
use Burst\Frontend\Goals\Goals_Tracker;
use Burst\Frontend\Search\Search;
use Burst\Frontend\Share\Share_Expired;
use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;


if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Frontend {
	use Helper;
	use Admin_Helper;

	public Tracking $tracking;

	/**
	 * Frontend statistics instance
	 */
	public Frontend_Statistics $statistics;

	/**
	 * Memoized result of uses_obfuscated_combined_file().
	 */
	private ?bool $uses_obfuscated_combined_file = null;

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'admin_init', [ $this, 'maybe_redirect_to_settings_page' ], 1 );

		add_action( 'init', [ $this, 'register_pageviews_block' ] );
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue_burst_block_editor_assets' ] );
		add_filter( 'render_block', [ $this, 'render_block_filter' ], 10, 2 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_time_tracking_script' ], 0 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_tracking_script' ], 0 );
		add_filter( 'script_loader_tag', [ $this, 'defer_burst_tracking_script' ], 10, 3 );
		add_action( 'init', [ $this, 'use_logged_out_state_for_tests' ] );
		add_action( 'wp_ajax_burst_tracking_error', [ $this, 'log_tracking_error' ] );
		add_action( 'wp_ajax_nopriv_burst_tracking_error', [ $this, 'log_tracking_error' ] );
		add_action( 'template_redirect', [ $this, 'start_buffer' ] );
		add_action( 'shutdown', [ $this, 'end_buffer' ], 999 );
		$sessions = new Sessions();
		$sessions->init();
		$this->tracking = new Tracking();
		$this->tracking->init();
		$goals = new Goals();
		$goals->init();

		// Only init goals tracker on front-end or ajax requests.
		if ( ! is_admin() || wp_doing_ajax() ) {
			$goals_tracker = new Goals_Tracker();
			$goals_tracker->init();

			$search = new Search();
			$search->init();
		}

		// Check if shortcodes option is enabled.
		if ( $this->get_option_bool( 'enable_shortcodes' ) ) {
			$shortcodes = new Shortcodes();
			$shortcodes->init();
		}

		$share = new Share_Expired();
		$share->init();

		// Check if MainWP integration option is enabled.
		if ( $this->get_option_bool( 'enable_mainwp_integration' ) ) {
			$mainwp_proxy = new MainWP_Proxy();
			$mainwp_proxy->init();
		}
	}

	/**
	 * After activation, redirect the user to the settings page.
	 */
	public function maybe_redirect_to_settings_page(): void {
		if ( ! is_admin() || wp_doing_ajax() || wp_doing_cron() || wp_is_serving_rest_request() ) {
			return;
		}

		// not processing form data, only a conditional redirect, which is available only temporarily.
		// phpcs:ignore
		if ( ! get_transient( 'burst_redirect_to_settings_page' ) || ( isset( $_GET['page'] ) && $_GET['page'] === 'burst' ) ) {
			return;
		}

		if ( ! $this->user_can_view() ) {
			return;
		}

		delete_transient( 'burst_redirect_to_settings_page' );

		// we don't redirect when installed through the onboarding of another plugin.
		if ( get_site_option( 'teamupdraft_installation_source_burst-statistics' ) ) {
			return;
		}

		wp_safe_redirect( $this->admin_url( 'burst' ) );
		exit;
	}

	/**
	 * Start buffer
	 */
	public function start_buffer(): void {
		ob_start( [ $this, 'insert_page_identifier' ] );
	}

	/**
	 * Insert the page identifier into the current page.
	 *
	 * @param string $html the page html.
	 * @return string the adjusted html.
	 */
	public function insert_page_identifier( string $html ): string {
		// skip if file is xml.
		if ( strpos( $html, '<?xml' ) === 0 ) {
			return $html;
		}

		$identifier         = $this->get_current_page_identifier();
		$id                 = (int) $identifier['ID'];
		$type               = (string) $identifier['type'];
		$ghost_mode_enabled = (bool) apply_filters( 'burst_obfuscate_filename', $this->get_option_bool( 'ghost_mode' ) );
		$prefix             = $ghost_mode_enabled ? 'b' : 'burst';
		if ( $id > -1 && strpos( $html, '<body' ) !== false ) {
			$data_attr = 'data-' . $prefix . '_id="' . esc_attr( (string) $id ) . '" data-' . $prefix . '_type="' . esc_attr( $type ) . '"';
			$html      = preg_replace( '/(<body[^>]*?)>/i', '$1 ' . $data_attr . '>', $html, 1 );
		}
		return $html;
	}

	/**
	 * Flush the output buffer
	 *
	 * @since  2.0
	 * @access public
	 */
	public function end_buffer(): void {
		if ( ob_get_length() ) {
			ob_end_flush();
		}
	}

	/**
	 * Get an identifier for the current page
	 *
	 * @return array<string, int|string>
	 */
	private function get_current_page_identifier(): array {
		// All post types with ID (posts, pages, custom post types).
		if ( is_singular() || ( is_front_page() && is_page() ) ) {
			$post_id = get_queried_object_id();
			return [
				'ID'   => $post_id,
				'type' => get_post_type( $post_id ),
			];
		}

		// Homepage (posts page, not a static page).
		if ( is_front_page() ) {
			return [
				'ID'   => 0,
				'type' => 'front-page',
			];
		}

		// Blog index page.
		if ( is_home() ) {
			return [
				'ID'   => 0,
				'type' => 'blog-index',
			];
		}

		// Category archives.
		if ( is_category() ) {
			return [
				'ID'   => get_queried_object_id(),
				'type' => 'category',
			];
		}

		// Tag archives.
		if ( is_tag() ) {
			return [
				'ID'   => get_queried_object_id(),
				'type' => 'tag',
			];
		}

		// Custom taxonomy archives.
		if ( is_tax() ) {
			return [
				'ID'   => get_queried_object_id(),
				'type' => 'tax',
			];
		}

		// Author archives.
		if ( is_author() ) {
			return [
				'ID'   => get_queried_object_id(),
				'type' => 'author',
			];
		}

		// Date archives.
		if ( is_date() ) {
			return [
				'ID'   => 0,
				'type' => 'date-archive',
			];
		}

		if ( is_search() ) {
			return [
				'ID'   => 0,
				'type' => 'search',
			];
		}

		if ( is_404() ) {
			return [
				'ID'   => 0,
				'type' => '404',
			];
		}

		if ( is_post_type_archive() ) {
			return [
				'ID'   => get_queried_object_id(),
				'type' => 'archive',
			];
		}

		if ( is_archive() ) {
			return [
				'ID'   => 0,
				'type' => 'archive-generic',
			];
		}

		// WooCommerce.
		if ( function_exists( 'is_woocommerce' ) ) {
			if ( function_exists( 'is_shop' ) && is_shop() && ! is_page() ) {
				return [
					'ID'   => 0,
					'type' => 'wc-shop',
				];
			}
		}

		return [
			'ID'   => -1,
			'type' => '',
		];
	}

	/**
	 * Log payload of 400 response errors on tracking requests if BURST_DEBUG is enabled
	 */
	public function log_tracking_error(): void {
		if ( ! defined( 'BURST_DEBUG' ) || ! BURST_DEBUG ) {
			// If debug mode is not enabled, do not log errors.
			return;
		}

		// No form data processed, only exit if not present.
		// phpcs:ignore
		if ( ! isset( $_POST['status'] ) || ! isset( $_POST['data'] ) || ! isset( $_POST['error'] ) ) {
			$this::error_log( 'Posted log error, but missing required POST parameters.' );
			return;
		}

		// no nonce verification, as we are logging public 400 response errors.
		// phpcs:ignore
		$status = (int) ( $_POST['status'] );
		// phpcs:ignore
		$raw_data = stripslashes( $_POST['data'] );
		$data     = json_decode( $raw_data, true );
		if ( ! is_array( $data ) ) {
			$data = [];
		}

		$data = [
			'uid'               => isset( $data['uid'] ) && is_string( $data['uid'] ) ? sanitize_text_field( $data['uid'] ) : false,
			'fingerprint'       => isset( $data['fingerprint'] ) && is_string( $data['fingerprint'] ) ? sanitize_text_field( $data['fingerprint'] ) : false,
			'url'               => isset( $data['url'] ) ? esc_url_raw( $data['url'] ) : '',
			'referrer_url'      => isset( $data['referrer_url'] ) ? esc_url_raw( $data['referrer_url'] ) : '',
			'user_agent'        => isset( $data['user_agent'] ) ? sanitize_text_field( $data['user_agent'] ) : '',
			'device_resolution' => isset( $data['device_resolution'] ) ? preg_replace( '/[^0-9x]/', '', $data['device_resolution'] ) : '',
			'time_on_page'      => isset( $data['time_on_page'] ) ? (int) $data['time_on_page'] : 0,
			'completed_goals'   => isset( $data['completed_goals'] ) && is_array( $data['completed_goals'] )
				? array_map( 'intval', $data['completed_goals'] )
				: [],
		];
		// no nonce verification, as we are logging public 400 response errors.
		// phpcs:ignore
		$error = sanitize_text_field( $_POST['error'] );
		// usage of print_r is intentional here, as this is a debug log.
		// phpcs:ignore
		$this::error_log( "Burst tracking error: status=$status, error=$error, data=" . print_r( $data, true ) );
	}

	/**
	 * Check if the tracking script is served as the combined file under an obfuscated (ghost mode) name.
	 *
	 * Memoized, so the timeme and tracking script enqueues share one decision and their
	 * handle prefixes can never diverge within a request: the tracking script declares
	 * its timeme dependency as "{prefix}-timeme", so a diverging prefix would point to an
	 * unregistered handle and WordPress would silently drop the tracking script.
	 */
	private function uses_obfuscated_combined_file(): bool {
		if ( $this->uses_obfuscated_combined_file !== null ) {
			return $this->uses_obfuscated_combined_file;
		}

		$ghost_mode_enabled = (bool) apply_filters( 'burst_obfuscate_filename', $this->get_option_bool( 'ghost_mode' ) );
		if ( ! $ghost_mode_enabled || ! $this->get_option_bool( 'combine_vars_and_script', true ) ) {
			$this->uses_obfuscated_combined_file = false;
			return $this->uses_obfuscated_combined_file;
		}

		$file                                = $this->upload_dir( 'js', true ) . $this->get_frontend_js_filename( true );
		$this->uses_obfuscated_combined_file = file_exists( $file );
		return $this->uses_obfuscated_combined_file;
	}

	/**
	 * Enqueue some assets
	 */
	public function enqueue_burst_time_tracking_script( string $hook ): void {
		// fix phpcs warning.
		unset( $hook );
		$file   = 'assets/js/timeme/timeme.min.js';
		$src    = BURST_URL . $file;
		$path   = BURST_PATH . $file;
		$prefix = 'burst';
		if ( $this->uses_obfuscated_combined_file() ) {
			$prefix      = 'b';
			$upload_path = $this->upload_dir( 'js', true );
			// Fall back to the bundled file if the uploads copy is missing, so the src
			// stays loadable while the handle keeps matching the tracking script.
			if ( file_exists( $upload_path . 'timeme.min.js' ) ) {
				$src  = $this->upload_url( 'js', true ) . 'timeme.min.js';
				$path = $upload_path . 'timeme.min.js';
			}
		}
		if ( ! $this->exclude_from_tracking() ) {
			wp_enqueue_script(
				$prefix . '-timeme',
				$src,
				[],
				filemtime( $path ),
				false
			);
		}
	}

	/**
	 * When a tracking test is running, we don't want to show the logged in state, as caching plugins often show uncached content to logged in users.
	 * Also handles the force logged out functionality for previewing click goals.
	 */
	public function use_logged_out_state_for_tests(): void {
		// Verify nonce while user is still authenticated.
		// This is the nonce verification, unslash done in verify_nonce().
        // phpcs:ignore
        if ( ! isset( $_GET['nonce'] ) || ! $this->verify_nonce( $_GET['nonce'], 'burst_nonce' ) ) {
			return;
		}

		// Nonce is verified above.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['burst_test_hit'] ) || ( isset( $_GET['burst_force_logged_out'] ) && $_GET['burst_force_logged_out'] === '1' ) ) {
			add_filter( 'determine_current_user', '__return_null', 100 );
			wp_set_current_user( 0 );
		}
	}

	/**
	 * Enqueue some assets
	 */
	public function enqueue_burst_tracking_script( string $hook ): void {
		// fix phpcs warning.
		unset( $hook );
		// don't enqueue if headless.
		if ( defined( 'BURST_HEADLESS_DOMAIN' ) || $this->get_option_bool( 'headless' ) ) {
			return;
		}

		if ( ! $this->exclude_from_tracking() ) {
			$privacy_level           = $this->get_option( 'privacy_level', 'cookie' );
			$cookieless              = ( $privacy_level === 'fingerprint' );
			$cookieless_text         = $cookieless ? '-cookieless' : '';
			$prefix                  = 'burst';
			$in_footer               = $this->get_option_bool( 'enable_turbo_mode' );
			$combine_vars_and_script = $this->get_option_bool( 'combine_vars_and_script', true );
			$file_url                = BURST_URL . "assets/js/build/burst$cookieless_text.min.js";
			$file_path               = BURST_PATH . "assets/js/build/burst$cookieless_text.min.js";
			$add_localize_script     = true;
			if ( $combine_vars_and_script ) {
				$ghost_mode_enabled = $this->uses_obfuscated_combined_file();
				$filename           = $this->get_frontend_js_filename( $ghost_mode_enabled );
				$upload_url         = $this->upload_url( 'js', $ghost_mode_enabled );
				$upload_path        = $this->upload_dir( 'js', $ghost_mode_enabled );

				// Only use the written file if it exists. For ghost mode the existence check
				// is part of uses_obfuscated_combined_file(), so the prefix always matches
				// the timeme handle registered in enqueue_burst_time_tracking_script().
				if ( $ghost_mode_enabled || file_exists( $upload_path . $filename ) ) {
					$prefix              = $ghost_mode_enabled ? 'b' : 'burst';
					$file_url            = $upload_url . $filename;
					$file_path           = $upload_path . $filename;
					$add_localize_script = false;
				}
			}
			$deps = $this->tracking->beacon_enabled() ? [ $prefix . '-timeme' ] : [ $prefix . '-timeme', 'wp-api-fetch' ];
			wp_enqueue_script(
				$prefix,
				$file_url,
				apply_filters( 'burst_script_dependencies', $deps ),
				filemtime( $file_path ),
				$in_footer
			);

			if ( $add_localize_script ) {
				wp_localize_script(
					$prefix,
					'burst',
					$this->tracking->get_options()
				);
			}
		}
	}

	/**
	 * Add defer or async to the script tag
	 */
	public function defer_burst_tracking_script( string $tag, string $handle, string $src ): string {
		// fix phpcs warning.
		unset( $src );

		// Ghost mode registers the scripts under the obfuscated 'b' prefix instead of 'burst',
		// so we have to match both handle variants here. Otherwise the tracking script loses
		// its defer/async attribute in ghost mode, which changes when it executes.
		$is_timeme   = ( 'burst-timeme' === $handle || 'b-timeme' === $handle );
		$is_tracking = ( 'burst' === $handle || 'b' === $handle );

		// time me load asap but async to avoid blocking the page load.
		if ( $is_timeme ) {
			return str_replace( ' src', ' async src', $tag );
		}

		if ( ! $is_tracking ) {
			return $tag;
		}

		if ( $this->get_option_bool( 'enable_turbo_mode' ) ) {
			return str_replace( ' src', ' defer src', $tag );
		}

		return str_replace( ' src', ' async src', $tag );
	}

	/**
	 * Check if this should be excluded from tracking
	 */
	public function exclude_from_tracking(): bool {
		// no form data processed, only excluding from tracking.
		// phpcs:ignore
		if ( isset( $_GET['burst_force_logged_out'] ) ) {
			return true;
		}

		if ( is_user_logged_in() ) {
			// a track hit is used by the onboarding process.
			// Only an exists check, for the test. Enqueued scripts are public, so no need to check for nonce.
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( isset( $_GET['burst_test_hit'] ) ) {
				return false;
			}

			$user                = wp_get_current_user();
			$user_role_blocklist = $this->get_option( 'user_role_blocklist' );
			$get_excluded_roles  = is_array( $user_role_blocklist ) ? $user_role_blocklist : [];
			$excluded_roles      = apply_filters( 'burst_roles_excluded_from_tracking', $get_excluded_roles );
			if ( count( array_intersect( $excluded_roles, $user->roles ) ) > 0 ) {
				return true;
			}
			if ( is_preview() || $this->is_pagebuilder_preview() || $this->is_plugin_preview() ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Register the pageviews block for the Block Editor
	 */
	public function register_pageviews_block(): void {
		wp_register_script(
			'burst-pageviews-block-editor',
			// Adjust the path to your JavaScript file.
			plugins_url( 'blocks/pageviews.js', __FILE__ ),
			[ 'wp-blocks', 'wp-element', 'wp-block-editor' ],
			filemtime( plugin_dir_path( __FILE__ ) . 'blocks/pageviews.js' ),
			true
		);
		wp_set_script_translations( 'burst-pageviews-block-editor', 'burst-statistics', BURST_PATH . '/languages' );

		register_block_type(
			'burst/pageviews-block',
			[
				'editor_script'   => 'burst-pageviews-block-editor',
				'render_callback' => [ $this, 'render_burst_pageviews' ],
			]
		);
	}

	/**
	 * Enqueue the Burst block-editor integration script.
	 * Adds a "Track clicks with a Burst Goal" inspector panel to supported blocks.
	 */
	public function enqueue_burst_block_editor_assets(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$handle    = 'burst-block-editor';
		$file      = 'blocks/burst-block-editor.js';
		$src       = plugins_url( $file, __FILE__ );
		$file_path = plugin_dir_path( __FILE__ ) . $file;

		if ( ! file_exists( $file_path ) ) {
			return;
		}

		wp_enqueue_script(
			$handle,
			$src,
			[
				'wp-blocks',
				'wp-element',
				'wp-block-editor',
				'wp-hooks',
				'wp-components',
				'wp-compose',
				'wp-i18n',
				'wp-api-fetch',
				'wp-data',
				'wp-plugins',
			],
			filemtime( $file_path ),
			true
		);

		// Localize settings for the block editor script.
		global $wpdb;
		$goal_count         = 0;
		$active_block_goals = [];
		$goals_list         = [];

		$table_name   = $wpdb->prefix . 'burst_goals';
		$table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) === $table_name;
		if ( $table_exists ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$goal_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$raw_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals", ARRAY_A );

			// Batch retrieve goals that have statistics to avoid N+1 queries.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$goals_with_stats = $wpdb->get_col( "SELECT DISTINCT goal_id FROM {$wpdb->prefix}burst_goal_statistics" );
			$goals_with_stats = is_array( $goals_with_stats ) ? array_map( 'intval', $goals_with_stats ) : [];

			if ( is_array( $raw_goals ) ) {
				foreach ( $raw_goals as $g ) {
					$selector = $g['selector'];
					$uid      = str_replace( [ '[data-burst-goal="', '"]' ], '', $selector );
					$goal_id  = (int) $g['ID'];

					$has_data = in_array( $goal_id, $goals_with_stats, true );

					$page_id = isset( $g['page_id'] ) ? (int) $g['page_id'] : 0;
					if ( 0 === $page_id && ! empty( $g['url'] ) && '*' !== $g['url'] ) {
						static $url_to_post_id_cache = [];
						if ( ! isset( $url_to_post_id_cache[ $g['url'] ] ) ) {
							$url_to_post_id_cache[ $g['url'] ] = url_to_postid( home_url( $g['url'] ) );
						}
						$page_id = $url_to_post_id_cache[ $g['url'] ];
					}

					$goals_list[] = [
						'id'                => $goal_id,
						'title'             => $g['title'],
						'type'              => $g['type'],
						'status'            => $g['status'],
						'url'               => $g['url'],
						'conversion_metric' => $g['conversion_metric'],
						'selector'          => $g['selector'],
						'block_goal'        => (int) $g['block_goal'],
						'uid'               => $uid,
						'has_data'          => $has_data ? 1 : 0,
						'page_id'           => $page_id,
						'is_draft'          => ( $page_id > 0 ) ? ( get_post_status( $page_id ) !== 'publish' ) : false,
					];

					if ( (int) $g['block_goal'] === 1 && ! empty( $uid ) ) {
						if ( $g['status'] === 'active' ) {
							$active_block_goals[] = $uid;
						}
					}
				}
			}
		}
		$is_pro_valid = burst_license_is_valid();
		$goal_limit   = $is_pro_valid ? -1 : \Burst\Frontend\Goals\Goal::LIMIT_FREE;

		wp_localize_script(
			$handle,
			'burstBlockEditor',
			[
				'rest_url'               => get_rest_url(),
				'nonce'                  => wp_create_nonce( 'wp_rest' ),
				'burst_nonce'            => wp_create_nonce( 'burst_nonce' ),
				'user_can_manage'        => 1,
				'goal_count'             => $goal_count,
				'goal_limit'             => $goal_limit,
				'is_pro'                 => $is_pro_valid ? 1 : 0,
				'active_block_goal_uids' => $active_block_goals,
				'goals'                  => $goals_list,
			]
		);

		wp_set_script_translations( $handle, 'burst-statistics', BURST_PATH . '/languages' );
	}



	/**
	 * Get the pageviews all time for a post.
	 */
	public function get_post_pageviews( int $post_id, int $start = 0, int $end = 0 ): int {
		$cache_key    = 'burst_post_views_' . $post_id . $start . $end;
		$cached_views = wp_cache_get( $cache_key, 'burst' );

		// Get last midnight (start of today).
		$end_default   = self::convert_date_to_unix( gmdate( 'Y-m-d', strtotime( 'today' ) ) . ' 00:00:00' );
		$start_default = $end_default - 30 * DAY_IN_SECONDS;
		$end           = $end === 0 ? $end_default : $end;
		$start         = $start === 0 ? $start_default : $start;

		if ( $cached_views !== false ) {
			return (int) $cached_views;
		}

		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$views = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) as total_views FROM {$wpdb->prefix}burst_statistics WHERE page_id = %d AND time > %d and time < %d", $post_id, $start, $end ) );
		wp_cache_set( $cache_key, $views, 'burst', HOUR_IN_SECONDS );

		return $views;
	}


	/**
	 * Render the pageviews on the front-end
	 */
	public function render_burst_pageviews(): string {
		global $post;
		$count = $this->get_post_pageviews( $post->ID );
		// translators: %d is the number of times the page has been viewed.
		$text = sprintf( _n( 'This page has been viewed %d time.', 'This page has been viewed %d times.', $count, 'burst-statistics' ), $count );

		return '<p class="burst-pageviews">' . esc_html( $text ) . '</p>';
	}

	/**
	 * Filter to inject data-burst-goal attribute to dynamic blocks.
	 *
	 * @param string $block_content The HTML content of the block.
	 * @param array  $block         The parsed block structure.
	 * @return string The modified block content.
	 */
	public function render_block_filter( string $block_content, array $block ): string {
		if ( empty( $block['attrs']['burstGoalActive'] ) || empty( $block['attrs']['burstGoalUid'] ) ) {
			return $block_content;
		}

		$uid = sanitize_key( $block['attrs']['burstGoalUid'] );

		// Only inject if not already present in the block content.
		if ( strpos( $block_content, 'data-burst-goal' ) !== false ) {
			return $block_content;
		}

		// Inject data-burst-goal attribute into the first HTML tag opening.
		$pattern = '/^<([a-zA-Z0-9\-]+)/';
		if ( preg_match( $pattern, $block_content, $matches ) ) {
			$tag           = $matches[1];
			$replacement   = '<' . $tag . ' data-burst-goal="' . esc_attr( $uid ) . '"';
			$block_content = preg_replace( $pattern, $replacement, $block_content, 1 );
		}

		return $block_content;
	}
}
