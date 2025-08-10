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
	 *
	 * @var Frontend_Statistics
	 */
	public Frontend_Statistics $statistics;

	/**
	 * Constructor
	 */
	public function init(): void {

		add_action( 'init', [ $this, 'register_pageviews_block' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_time_tracking_script' ], 0 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_tracking_script' ], 0 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_shortcodes_styles' ] );
		add_filter( 'script_loader_tag', [ $this, 'defer_burst_tracking_script' ], 10, 3 );
		add_action( 'burst_every_hour', [ $this, 'maybe_update_total_pageviews_count' ] );
		add_action( 'init', [ $this, 'use_logged_out_state_for_tests' ] );
		add_action( 'wp_ajax_burst_tracking_error', [ $this, 'log_tracking_error' ] );
		add_action( 'wp_ajax_nopriv_burst_tracking_error', [ $this, 'log_tracking_error' ] );

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
	 * Log payload of 400 response errors on tracking requests if BURST_DEBUG is enabled
	 *
	 * @return void
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
	 * Conditionally update total pageviews count on cron
	 */
	public function maybe_update_total_pageviews_count(): void {
		// we don't do this on high traffic sites.
		if ( get_option( 'burst_is_high_traffic_site' ) ) {
			return;
		}
		$page_views_to_update = get_option( 'burst_pageviews_to_update', [] );
		if ( empty( $page_views_to_update ) ) {
			return;
		}

		// clean up first.
		update_option( 'burst_pageviews_to_update', [] );
		foreach ( $page_views_to_update as $page_url => $added_count ) {
			$page_id = url_to_postid( $page_url );
			unset( $page_views_to_update[ $page_url ] );
			if ( $page_id > 0 ) {
				$count = (int) get_post_meta( $page_id, 'burst_total_pageviews_count', true );
				update_post_meta( $page_id, 'burst_total_pageviews_count', $count + $added_count );
			}
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
	 * Render the pageviews on the front-end
	 */
	public function render_burst_pageviews(): string {
		global $post;
		$burst_total_pageviews_count = get_post_meta( $post->ID, 'burst_total_pageviews_count', true );
		$count                       = (int) $burst_total_pageviews_count ?: 0;
		// translators: %d is the number of times the page has been viewed.
		$text = sprintf( _n( 'This page has been viewed %d time.', 'This page has been viewed %d times.', $count, 'burst-statistics' ), $count );

		return '<p class="burst-pageviews">' . $text . '</p>';
	}

	/**
	 * Register the shortcodes stylesheet and enqueue it when needed
	 */
	public function enqueue_burst_shortcodes_styles(): void {
		// Register the stylesheet but don't enqueue it yet.
		wp_register_style(
			'burst-statistics-shortcodes',
			BURST_URL . 'assets/css/burst-statistics-shortcodes.css',
			[],
			filemtime( BURST_PATH . 'assets/css/burst-statistics-shortcodes.css' )
		);

		// Add filters to detect our shortcodes and enqueue the style when needed.
		add_filter( 'the_content', [ $this, 'check_for_burst_shortcodes' ], 10, 1 );

		// Also check in widgets, Gutenberg blocks, etc.
		add_action( 'wp_footer', [ $this, 'maybe_enqueue_shortcode_styles' ], 10 );
	}

	/**
	 * Check content for Burst shortcodes
	 *
	 * @param string $content The post content.
	 * @return string The unmodified content
	 */
	public function check_for_burst_shortcodes( string $content ): string {
		if ( ! is_admin() &&
			(
				has_shortcode( $content, 'burst-most-visited' ) ||
				has_shortcode( $content, 'burst_statistics' )
			)
		) {
			$this->enqueue_shortcode_styles();
		}

		return $content;
	}

	/**
	 * Fallback check for shortcodes in widgets or other areas
	 */
	public function maybe_enqueue_shortcode_styles(): void {
		global $wp_query;

		// Check if we're on a singular post or page.
		if ( is_singular() ) {
			$post = $wp_query->get_queried_object();

			// Check post content for shortcodes.
			if ( $post && isset( $post->post_content ) && (
				has_shortcode( $post->post_content, 'burst-most-visited' ) ||
				has_shortcode( $post->post_content, 'burst_statistics' )
			) ) {
				$this->enqueue_shortcode_styles();
				return;
			}
		}

		// Check active widgets for shortcodes.
		$active_widgets = wp_get_sidebars_widgets();
		if ( is_array( $active_widgets ) ) {
			foreach ( $active_widgets as $sidebar_widgets ) {
				if ( ! is_array( $sidebar_widgets ) ) {
					continue;
				}

				foreach ( $sidebar_widgets as $widget ) {
					if ( strpos( $widget, 'text' ) !== false ) {
						// This is a text widget that might contain shortcodes.
						$this->enqueue_shortcode_styles();
						return;
					}
				}
			}
		}
	}

	/**
	 * Actually enqueue the shortcode styles
	 */
	private function enqueue_shortcode_styles(): void {
		wp_enqueue_style( 'burst-statistics-shortcodes' );
	}
}
