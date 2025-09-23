<?php
namespace Burst\Frontend;

use Burst\Frontend\Goals\Goals;
use Burst\Frontend\Goals\Goals_Tracker;
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
	 * Constructor
	 */
	public function init(): void {

		add_action( 'init', [ $this, 'register_pageviews_block' ] );
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
		// Lazy load shortcodes only when needed.
		$this->tracking = new Tracking();
		$this->tracking->init();
		$goals = new Goals();
		$goals->init();
		$goals_tracker = new Goals_Tracker();
		$goals_tracker->init();
		// Check if shortcodes option is enabled.
		if ( $this->get_option_bool( 'enable_shortcodes' ) ) {
			$shortcodes = new Shortcodes();
			$shortcodes->init();
		}
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

		$identifier = $this->get_current_page_identifier();
		$id         = (int) $identifier['ID'];
		$type       = (string) $identifier['type'];
		if ( $id > -1 && strpos( $html, '<body' ) !== false ) {
			$data_attr = 'data-burst_id="' . esc_attr( (string) $id ) . '" data-burst_type="' . esc_attr( $type ) . '"';
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
			return [
				'ID'   => get_the_ID(),
				'type' => get_post_type( get_the_ID() ),
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
	 * Enqueue some assets
	 */
	public function enqueue_burst_time_tracking_script( string $hook ): void {
		// fix phpcs warning.
		unset( $hook );
		$minified = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
		if ( ! $this->exclude_from_tracking() ) {
			wp_enqueue_script(
				'burst-timeme',
				BURST_URL . "helpers/timeme/timeme$minified.js",
				[],
				filemtime( BURST_PATH . "helpers/timeme/timeme$minified.js" ),
				false
			);
		}
	}

	/**
	 * When a tracking test is running, we don't want to show the logged in state, as caching plugins often show uncached content to logged in users.
	 * Also handles the force logged out functionality for previewing click goals.
	 */
	public function use_logged_out_state_for_tests(): void {
		// No form data processed, no action connected, only not showing logged in state for testing purposes.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['burst_test_hit'] ) || isset( $_GET['burst_nextpage'] ) || ( isset( $_GET['burst_force_logged_out'] ) && $_GET['burst_force_logged_out'] === '1' ) ) {
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
		if ( defined( 'BURST_HEADLESS' ) || $this->get_option_bool( 'headless' ) ) {
			return;
		}

		if ( ! $this->exclude_from_tracking() ) {
			$in_footer               = $this->get_option_bool( 'enable_turbo_mode' );
			$deps                    = $this->tracking->beacon_enabled() ? [ 'burst-timeme' ] : [ 'burst-timeme', 'wp-api-fetch' ];
			$combine_vars_and_script = $this->get_option_bool( 'combine_vars_and_script' );
			if ( $combine_vars_and_script ) {
				$upload_url  = $this->upload_url( 'js' );
				$upload_path = $this->upload_dir( 'js' );
				wp_enqueue_script(
					'burst',
					$upload_url . 'burst.min.js',
					apply_filters( 'burst_script_dependencies', $deps ),
					filemtime( $upload_path . 'burst.min.js' ),
					$in_footer
				);
			} else {
				$minified        = '.min';
				$cookieless      = $this->get_option_bool( 'enable_cookieless_tracking' );
				$cookieless_text = $cookieless ? '-cookieless' : '';
				$localize_args   = $this->tracking->get_options();
				wp_enqueue_script(
					'burst',
					BURST_URL . "assets/js/build/burst$cookieless_text$minified.js",
					apply_filters( 'burst_script_dependencies', $deps ),
					filemtime( BURST_PATH . "assets/js/build/burst$cookieless_text$minified.js" ),
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
	 * Add defer or async to the script tag
	 */
	public function defer_burst_tracking_script( string $tag, string $handle, string $src ): string {
		// fix phpcs warning.
		unset( $src );
		// time me load asap but async to avoid blocking the page load.
		if ( 'burst-timeme' === $handle ) {
			return str_replace( ' src', ' async src', $tag );
		}

		$turbo = $this->get_option_bool( 'enable_turbo_mode' );
		if ( $turbo ) {
			if ( 'burst' === $handle ) {
				return str_replace( ' src', ' defer src', $tag );
			}
		}

		if ( 'burst' === $handle ) {
			return str_replace( ' src', ' async src', $tag );
		}

		return $tag;
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
	public function get_post_pageviews( int $post_id ): int {
		$cache_key    = 'burst_post_views_' . $post_id;
		$cached_views = wp_cache_get( $cache_key, 'burst' );

		if ( $cached_views !== false ) {
			return (int) $cached_views;
		}

		global $wpdb;
		$sql = $wpdb->prepare(
			"SELECT COUNT(*) as total_views
         FROM {$wpdb->prefix}burst_statistics
         WHERE page_id = %d",
			$post_id
		);

		$views = (int) $wpdb->get_var( $sql );
		wp_cache_set( $cache_key, $views, 'burst' );

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

		return '<p class="burst-pageviews">' . $text . '</p>';
	}
}
