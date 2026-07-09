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
	 * Option holding the auto debug window state: remaining budget, collected
	 * browser errors and the arm timestamp. A window collects for
	 * DEBUG_WINDOW_COLLECT_SECONDS after arming; its errors are retained for
	 * DEBUG_WINDOW_RETENTION, after which a new incident can open a fresh one.
	 *
	 * Deliberately autoloaded (an empty array when idle): debug_window_active()
	 * runs on every front-end pageload, so the state must ride along with
	 * alloptions instead of costing a DB query per pageload like a transient.
	 * Expiry is enforced inline and the option is reset on `burst_daily`.
	 *
	 * @var string
	 */
	private const DEBUG_WINDOW_OPTION = 'burst_debug_tracking_errors';

	/**
	 * How long an armed debug window collects browser errors. Kept short on
	 * purpose: while collecting, every pageload injects the debug flag and
	 * failing visitors POST error reports to admin-ajax, so the extra server
	 * load must last no longer than needed to capture a handful of samples.
	 *
	 * @var int
	 */
	private const DEBUG_WINDOW_COLLECT_SECONDS = DAY_IN_SECONDS;

	/**
	 * How long the collected errors are retained after arming. The floor is the
	 * weekly diagnostic e-mail throttle: the follow-up e-mail a week after
	 * arming must still find the collected errors, so an earlier daily check
	 * must not re-arm (and thereby empty) the window. The extra days are slack
	 * for incidents that flap around the throttle boundary and for skipped
	 * cron days — each day of slack tolerates one such day.
	 *
	 * @var int
	 */
	private const DEBUG_WINDOW_RETENTION = WEEK_IN_SECONDS + 3 * DAY_IN_SECONDS;

	/**
	 * Number of browser error reports collected per debug window.
	 *
	 * @var int
	 */
	private const DEBUG_WINDOW_BUDGET = 10;

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'admin_init', [ $this, 'maybe_redirect_to_settings_page' ], 1 );

		add_action( 'init', [ $this, 'register_pageviews_block' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_time_tracking_script' ], 0 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_tracking_script' ], 0 );
		add_filter( 'script_loader_tag', [ $this, 'defer_burst_tracking_script' ], 10, 3 );
		add_action( 'init', [ $this, 'use_logged_out_state_for_tests' ] );
		add_action( 'wp_ajax_burst_tracking_error', [ $this, 'log_tracking_error' ] );
		add_action( 'wp_ajax_nopriv_burst_tracking_error', [ $this, 'log_tracking_error' ] );
		// Priority 20: both callbacks discard collected errors (re-arm wipes them,
		// reset clears an expired window), so they must run after the priority-10
		// health check → diagnostics → summary email chain has read those errors.
		add_action( 'burst_tracking_health_checked', [ $this, 'maybe_arm_debug_window' ], 20 );
		add_action( 'burst_daily', [ $this, 'reset_expired_debug_window' ], 20 );
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
	 * Log payload of 400 response errors on tracking requests if BURST_DEBUG or the auto debug window is enabled
	 */
	public function log_tracking_error(): void {
		$debug_constant = defined( 'BURST_DEBUG' ) && BURST_DEBUG;
		if ( ! $debug_constant && ! $this->debug_window_active() ) {
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

		if ( $debug_constant ) {
			// usage of print_r is intentional here, as this is a debug log.
			// phpcs:ignore
			$this::error_log( "Burst tracking error: status=$status, error=$error, data=" . print_r( $data, true ) );
		}

		$this->record_debug_window_error( $status, $error, $data );
	}

	/**
	 * Open the auto debug window when the tracking health check reports an issue.
	 *
	 * Browser-side tracking errors are only reported when debug mode is enabled,
	 * so on a suspected drop we temporarily enable error reporting with a small
	 * budget. An existing window — even one that stopped collecting — is never
	 * re-armed until its retention (DEBUG_WINDOW_RETENTION) has passed, so the
	 * collected errors survive until the follow-up e-mail has been sent.
	 *
	 * @param array $health_result The result fired by Tracking_Health.
	 */
	public function maybe_arm_debug_window( array $health_result ): void {
		$status = $health_result['status'] ?? 'ok';
		if ( ! in_array( $status, [ 'suspect', 'down' ], true ) ) {
			return;
		}

		$window = get_option( self::DEBUG_WINDOW_OPTION );
		if ( is_array( $window ) && isset( $window['armed_at'] ) && ! $this->debug_window_expired( $window ) ) {
			return;
		}

		update_option(
			self::DEBUG_WINDOW_OPTION,
			[
				'budget'   => self::DEBUG_WINDOW_BUDGET,
				'errors'   => [],
				'armed_at' => time(),
			],
			true
		);
	}

	/**
	 * Whether the auto debug window is collecting errors: armed, budget left and
	 * the collection period has not closed yet.
	 */
	private function debug_window_active(): bool {
		$window = get_option( self::DEBUG_WINDOW_OPTION );
		return is_array( $window ) && ( $window['budget'] ?? 0 ) > 0 && ! $this->debug_window_collection_closed( $window );
	}

	/**
	 * Whether a debug window is past its collection period: the debug flag is
	 * no longer injected and reported errors are no longer stored.
	 *
	 * @param array $window The stored debug window state.
	 */
	private function debug_window_collection_closed( array $window ): bool {
		return (int) ( $window['armed_at'] ?? 0 ) + self::DEBUG_WINDOW_COLLECT_SECONDS < time();
	}

	/**
	 * Whether a debug window is past its retention after arming: the collected
	 * errors are no longer needed and the window may be cleared or re-armed.
	 *
	 * @param array $window The stored debug window state.
	 */
	private function debug_window_expired( array $window ): bool {
		return (int) ( $window['armed_at'] ?? 0 ) + self::DEBUG_WINDOW_RETENTION < time();
	}

	/**
	 * Keep the debug window option autoloaded and current: seed the idle state
	 * when the option does not exist yet — a missing option would cost a DB
	 * query on every pageload — and clear an expired window so its collected
	 * errors do not stay in alloptions forever. Runs on `burst_daily`.
	 */
	public function reset_expired_debug_window(): void {
		$window = get_option( self::DEBUG_WINDOW_OPTION );
		if ( ! is_array( $window ) || $this->debug_window_expired( $window ) ) {
			update_option( self::DEBUG_WINDOW_OPTION, [], true );
		}
	}

	/**
	 * Store a reported tracking error in the debug window and decrement its budget.
	 *
	 * At budget zero or after the collection period closes the window stops
	 * collecting; the window is kept until its retention passes, storing the
	 * collected errors for the summary email.
	 *
	 * @param int    $status HTTP status reported by the browser.
	 * @param string $error  Error message reported by the browser.
	 * @param array  $data   Sanitized tracking payload.
	 */
	private function record_debug_window_error( int $status, string $error, array $data ): void {
		$window = get_option( self::DEBUG_WINDOW_OPTION );
		if ( ! is_array( $window ) || ( $window['budget'] ?? 0 ) <= 0 || $this->debug_window_collection_closed( $window ) ) {
			return;
		}

		--$window['budget'];
		// Cap field lengths: the endpoint is unauthenticated and sanitize_text_field /
		// esc_url_raw do not limit length, so without a cap a handful of multi-MB
		// reports would bloat the option that is loaded on every pageview while
		// the window is active.
		$window['errors'][] = [
			'time'       => time(),
			'status'     => $status,
			'error'      => mb_substr( $error, 0, 500 ),
			'url'        => mb_substr( $data['url'] ?? '', 0, 500 ),
			'user_agent' => mb_substr( $data['user_agent'] ?? '', 0, 300 ),
		];

		update_option( self::DEBUG_WINDOW_OPTION, $window, true );
	}

	/**
	 * The browser errors collected by the auto debug window, for the diagnostics summary.
	 *
	 * @return array<int, array{time: int, status: int, error: string, url: string, user_agent: string}>
	 */
	public function get_debug_window_errors(): array {
		$window = get_option( self::DEBUG_WINDOW_OPTION );
		if ( ! is_array( $window ) || ! isset( $window['errors'] ) || ! is_array( $window['errors'] ) ) {
			return [];
		}
		return $window['errors'];
	}

	/**
	 * Enqueue some assets
	 */
	public function enqueue_burst_time_tracking_script( string $hook ): void {
		// fix phpcs warning.
		unset( $hook );
		$file               = 'assets/js/timeme/timeme.min.js';
		$src                = BURST_URL . $file;
		$path               = BURST_PATH . $file;
		$prefix             = 'burst';
		$ghost_mode_enabled = apply_filters( 'burst_obfuscate_filename', $this->get_option_bool( 'ghost_mode' ) );
		if ( $ghost_mode_enabled ) {
			$prefix      = 'b';
			$upload_url  = $this->upload_url( 'js', true );
			$upload_path = $this->upload_dir( 'js', true );
			$src         = $upload_url . 'timeme.min.js';
			$path        = $upload_path . 'timeme.min.js';
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
			$cookieless              = $this->get_option_bool( 'enable_cookieless_tracking' );
			$cookieless_text         = $cookieless ? '-cookieless' : '';
			$prefix                  = 'burst';
			$in_footer               = $this->get_option_bool( 'enable_turbo_mode' );
			$combine_vars_and_script = $this->get_option_bool( 'combine_vars_and_script', true );
			$file_url                = BURST_URL . "assets/js/build/burst$cookieless_text.min.js";
			$file_path               = BURST_PATH . "assets/js/build/burst$cookieless_text.min.js";
			$add_localize_script     = true;
			if ( $combine_vars_and_script ) {
				$ghost_mode_enabled = (bool) apply_filters( 'burst_obfuscate_filename', $this->get_option_bool( 'ghost_mode' ) );
				$filename           = $this->get_frontend_js_filename();
				$root               = apply_filters( 'burst_obfuscate_filename', $ghost_mode_enabled );
				$upload_url         = $this->upload_url( 'js', $root );
				$upload_path        = $this->upload_dir( 'js', $root );

				// Only use the written file if it exists.
				if ( file_exists( $upload_path . $filename ) ) {
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

			if ( $this->debug_window_active() ) {
				// The debug flag must be injected inline on every request.
				// Localized script data gets baked into the combined script file when in ghost mode,
				// so a flag passed that way is frozen at file generation time and cannot be toggled at runtime.
				wp_add_inline_script( $prefix, 'window.burst_debug = 1;', 'before' );
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
			[ 'wp-blocks', 'wp-element', 'wp-editor' ],
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
}
