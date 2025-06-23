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
	 * Constructor
	 */
	public function __construct() {

		add_action( 'init', [ $this, 'register_pageviews_block' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_time_tracking_script' ], 0 );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_tracking_script' ], 0 );
		add_filter( 'script_loader_tag', [ $this, 'defer_burst_tracking_script' ], 10, 3 );
		add_action( 'burst_every_hour', [ $this, 'maybe_update_total_pageviews_count' ] );
		add_shortcode( 'burst-most-visited', [ $this, 'most_visited_posts' ] );

		new Sessions();
		$this->tracking = new Tracking();
		new Goals();
		new Goals_Tracker();
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
			if ( is_preview() || $this->is_pagebuilder_preview() ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Show content conditionally, based on consent
	 */
	public function most_visited_posts(
		array $atts = [],
		?string $content = null,
		string $tag = ''
	): string {
		// normalize attribute keys, lowercase.
		$atts = array_change_key_case( $atts, CASE_LOWER );
		// override default attributes with user attributes.
		$atts = shortcode_atts(
			[
				'count'      => 5,
				'post_type'  => 'post',
				'show_count' => false,
			],
			$atts,
			$tag
		);

		// sanitize post type.
		$post_types = get_post_types();
		if ( ! in_array( $atts['post_type'], $post_types, true ) ) {
			$atts['post_type'] = 'post';
		}

		$count      = (int) $atts['count'];
		$show_count = (bool) $atts['show_count'];
		$post_type  = $atts['post_type'];
		// posts, sorted by post_meta.
		$args  = [
			'post_type'   => $post_type,
			'numberposts' => $count,
			'meta_key'    => 'burst_total_pageviews_count',
			'orderby'     => 'meta_value_num',
			'order'       => 'DESC',
			'meta_query'  => [
				// Same meta key for sorting.
				'key'  => 'burst_total_pageviews_count',
				// Make sure to specify the type as numeric for correct sorting.
				'type' => 'NUMERIC',
			],
		];
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

					<li class="burst-posts-list__item"><a href="<?php echo esc_url_raw( get_the_permalink( $post ) ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?><?php echo wp_kses_post( $count_html ); ?></a></li>
				<?php } ?>
			</ul>
			<?php
		} else {
			?>
			<p class="burst-posts-list__not-found">
				<?php esc_html_e( 'No posts found', 'burst-statistics' ); ?>
			</p>
			<?php
		}
		$output = ob_get_clean();
		return $output ?: '';
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
}