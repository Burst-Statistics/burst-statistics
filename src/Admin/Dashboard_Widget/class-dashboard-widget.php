<?php
namespace Burst\Admin\Dashboard_Widget;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Class Dashboard_Widget
 */
class Dashboard_Widget {
	use Helper;
	use Admin_Helper;

	public $error_message = '';

	/**
	 * Dashboard_Widget constructor.
	 */
	public function __construct() {
		add_action( 'wp_dashboard_setup', [ $this, 'add_burst_dashboard_widget' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	/**
	 * Add a dashboard widget
	 */
	public function add_burst_dashboard_widget(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}

		wp_add_dashboard_widget(
			'dashboard_widget_burst',
			'Burst Statistics',
			[
				$this,
				'render_dashboard_widget',
			]
		);
	}

	/**
	 * Enqueue the dashboard widget scripts and styles
	 */
	public function enqueue( string $hook ): void {

		if ( $hook !== 'index.php' ) {
			return;
		}

		if ( ! $this->user_can_view() ) {
			return;
		}

		$js_data = $this->get_chunk_translations( 'src/Admin/Dashboard_Widget/build' );
		if ( empty( $js_data ) ) {
			return;
		}

		wp_enqueue_style( 'wp-components' );
		$handle = 'burst-settings';
		wp_enqueue_script(
			$handle,
			plugins_url( 'build/' . $js_data['js_file'], __FILE__ ),
			$js_data['dependencies'],
			$js_data['version'],
			true
		);
		wp_enqueue_style(
			$handle,
			plugins_url( 'build/index.css', __FILE__ ),
			[],
			$js_data['version']
		);
		wp_set_script_translations( $handle, 'burst-statistics' );
		wp_localize_script(
			$handle,
			'burst_settings',
			$this->localized_settings( $js_data )
		);
	}

	/**
	 * Renders the dashboard widget
	 */
	public function render_dashboard_widget(): void {
		echo '<div id="burst-widget-root"></div>';
	}
}
