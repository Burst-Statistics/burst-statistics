<?php
namespace Burst\Frontend;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class loads on the front-end (!is_admin()) for logged in users with Burst capability.
 */
class Frontend_Admin {
	use Admin_Helper;
	use Helper;

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'admin_bar_menu', [ $this, 'add_to_admin_bar_menu' ], 35 );
		add_action( 'admin_bar_menu', [ $this, 'add_top_bar_menu' ], 400 );
	}


	/**
	 * Add admin bar menu
	 */
	public function add_to_admin_bar_menu( \WP_Admin_Bar $wp_admin_bar ): void {
		if ( ! $this->user_can_view() || is_admin() ) {
			return;
		}

		// don't show on subsites if networkwide activated, and this is not the main site.
		if ( self::is_networkwide_active() && ! is_main_site() ) {
			return;
		}

		$wp_admin_bar->add_node(
			[
				'parent' => 'site-name',
				'id'     => 'burst-statistics',
				'title'  => __( 'Statistics', 'burst-statistics' ),
				'href'   => BURST_DASHBOARD_URL,
			]
		);
	}

	/**
	 * Add top bar menu for page views
	 */
	public function add_top_bar_menu( \WP_Admin_Bar $wp_admin_bar ): void {
		global $wp_admin_bar;
		if ( is_admin() ) {
			return;
		}

		if ( ! $this->user_can_view() ) {
			return;
		}

		global $post;
		if ( $post && is_object( $post ) ) {
			if ( ! in_array( $post->post_type, [ 'post', 'page' ], true ) ) {
				return;
			}
			$statistics = new Frontend_Statistics();
			$count      = $statistics->get_post_views( $post->ID, 0, time() );
			$count      = $this->format_number_short( $count );
		} else {
			return;
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
				'href'   => BURST_DASHBOARD_URL,
			]
		);
	}
}
