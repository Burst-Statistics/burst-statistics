<?php
namespace Burst\Admin;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Review {
	use Admin_Helper;
	use Helper;

	private $visitors     = 0;
	private $min_visitors = 20;
	/**
	 * Constructor
	 */
	public function __construct() {
		if ( ! defined( 'BURST_PRO' ) || self::is_test() ) {
			add_action( 'admin_init', [ $this, 'show_review_notice' ] );
			add_action( 'admin_init', [ $this, 'process_get_review_dismiss' ] );
			add_action( 'wp_ajax_dismiss_review_notice', [ $this, 'dismiss_review_notice_callback' ] );
			add_action( 'admin_print_footer_scripts', [ $this, 'insert_dismiss_review' ] );
		}
	}

	/**
	 * Check if the conditions apply, and show the review notice
	 */
	public function show_review_notice(): void {
		// uncomment for testing.
		// update_option( 'burst_review_notice_shown', false );.
		// update_option( 'burst_activation_time', strtotime( "-5 weeks" ) );.
		// show review notice, but only on single site installs.
		if ( is_multisite() ) {
			return;
		}

		// set a time for users who didn't have it set yet.
		if ( ! get_option( 'burst_activation_time' ) ) {
			update_option( 'burst_activation_time', time(), false );
			return;
		}

		if ( get_option( 'burst_review_notice_shown' ) ) {
			return;
		}

		$activation_time = get_option( 'burst_activation_time' );
		$four_weeks_ago  = strtotime( '-4 weeks' );
		$five_weeks_ago  = strtotime( '-5 weeks' );
		// between 4 and 6 weeks ago, check if we reached 200 visitors. If so show the notice. If longer than 6 weeks, always show the notice.
		if ( $activation_time < $four_weeks_ago ) {
			$this->visitors = get_transient( 'burst_review_visitors' );

			if ( ! $this->visitors ) {
				$data           = \Burst\burst_loader()->admin->statistics->get_data( [ 'visitors' ], 0, time(), [] );
				$this->visitors = $data['visitors'];
				set_transient( 'burst_review_visitors', $this->visitors, DAY_IN_SECONDS );
			}
			if ( $this->visitors > $this->min_visitors ) {
				add_action( 'admin_notices', [ $this, 'review_notice_html' ] );
			}
			// always show the notice after 6 weeks have gone by.
			if ( $activation_time < $five_weeks_ago ) {
				add_action( 'admin_notices', [ $this, 'review_notice_html' ] );
			}
		}
	}

	/**
	 * Show the review notice HTML
	 */
	public function review_notice_html(): void {
		// not using the form data.
        //phpcs:ignore
		if ( isset( $_GET['burst_dismiss_review'] ) ) {
			return;
		}
		?>
		<style>
			.burst.wrap .notice.burst-review {
				margin: var(--rsp-spacing-l, 30px);
			}

			.burst-container {
				display: flex;
				padding: 12px;
			}

			.burst-container .dashicons {
				margin-left: 10px;
				margin-right: 5px;
			}

			.burst-review-image img {
				margin-top: 0.5em;
			}

			.burst-buttons-row {
				margin-top: 10px;
				display: flex;
				align-items: center;
			}
		</style>
		<div id="message"
			class="updated fade notice is-dismissible burst-review really-simple-plugins"
			style="border-left:4px solid var(--rsp-green, #2e8a37)">
			<div class="burst-container">
				<div class="burst-review-image"><img width="80px"
													src="<?php echo esc_url_raw( BURST_URL ); ?>/assets/img/burst-logo.svg"
													alt="review-logo">
				</div>
				<div style="margin-left:30px">
					<p>
						<b>
							<?php
							if ( $this->visitors > $this->min_visitors ) {
								// translators: %s is the number of visitors tracked by Burst Statistics.
								$this->printf( __( 'Hi there! Your site is doing awesome! Burst Statistics has tracked %s visitors for you!', 'burst-statistics' ), $this->visitors );
							} else {
								esc_html_e( 'Hi, you have been using Burst for more than a month now, awesome!', 'burst-statistics' );
							}
							?>
						</b>
						<?php
						$this->printf(
						// translators: 1: opening anchor tag to the support message form, 2: closing anchor tag.
							__( 'If you have any questions or feedback, leave us a %smessage%s.', 'burst-statistics' ),
							'<a href="' . $this->get_website_url(
								'support',
								[
									'burst_source' => 'review_notice',
								]
							) . '" target="_blank">',
							'</a>'
						);
						?>
					</p>
					<p>
						<?php esc_html_e( 'If you have a moment, please consider leaving a review on WordPress.org to spread the word. We greatly appreciate it!', 'burst-statistics' ); ?>
					</p>
					<i>- Hessel</i>
					<div class="burst-buttons-row">
						<a class="button button-primary" target="_blank"
							href="https://wordpress.org/support/plugin/burst-statistics/reviews/#new-post">
							<?php
							esc_html_e(
								'Leave a review',
								'burst-statistics'
							);
							?>
								</a>

						<div class="dashicons dashicons-calendar"></div>
						<a href="#"
							id="burst-maybe-later">
							<?php
							esc_html_e(
								'Maybe later',
								'burst-statistics'
							);
							?>
								</a>

						<div class="dashicons dashicons-no-alt"></div>
						<a id="burst-dismiss-review" href="
						<?php
						echo esc_url(
							add_query_arg(
								[
									'page'                 => 'burst',
									'burst_dismiss_review' => 1,
								],
								admin_url( 'admin.php' )
							)
						)
						?>
						">
						<?php
						esc_html_e(
							'Don\'t show again',
							'burst-statistics'
						);
						?>
							</a>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Insert some ajax script to dismiss the review notice, and stop nagging about it
	 *
	 * @since  2.0
	 * @access public
	 *
	 * type: dismiss, later
	 */
	public function insert_dismiss_review(): void {
		$ajax_nonce = wp_create_nonce( 'burst_dismiss_review' );
		?>
		<script type='text/javascript'>
			jQuery(document).ready(function($) {
			$('.burst-review.notice.is-dismissible').on('click', '.notice-dismiss', function(event) {
				burst_dismiss_review('dismiss');
			});
			$('.burst-review.notice.is-dismissible').on('click', '#burst-maybe-later', function(event) {
				burst_dismiss_review('later');
				$(this).closest('.burst-review').remove();
			});

			function burst_dismiss_review(type) {
				var data = {
				'action': 'dismiss_review_notice',
				'type': type,
				'token': '<?php echo esc_attr( $ajax_nonce ); ?>',
				};
				$.post(ajaxurl, data, function(response) {});
			}
			});
		</script>
		<?php
	}

	/**
	 * Process the ajax dismissal of the review message.
	 *
	 * @since  2.1
	 * @access public
	 */
	public function dismiss_review_notice_callback(): void {
		$type  = isset( $_POST['type'] ) ? sanitize_title( $_POST['type'] ) : false;
		$token = isset( $_POST['token'] ) ? sanitize_title( $_POST['token'] ) : false;
		if ( ! wp_verify_nonce( $token, 'burst_dismiss_review' ) ) {
			wp_die();
		}
		if ( $type === 'dismiss' ) {
			update_option( 'burst_review_notice_shown', true, false );
		}
		if ( $type === 'later' ) {
			update_option( 'burst_activation_time', time(), false );
		}

		// this is required to terminate immediately and return a proper response.
		wp_die();
	}

	/**
	 * Dismiss review notice with get, which is more stable
	 */
	public function process_get_review_dismiss(): void {
        //phpcs:ignore
		if ( isset( $_GET['burst_dismiss_review'] ) ) {
			update_option( 'burst_review_notice_shown', true, false );
		}
	}
}

