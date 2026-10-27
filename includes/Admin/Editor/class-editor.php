<?php
namespace Burst\Admin\Editor;

use Burst\Traits\Admin_Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueues per-page analytics inside the WordPress block editor (Gutenberg).
 */
class Editor {
	use Admin_Helper;

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue_block_editor_assets' ] );
	}

	/**
	 * Enqueue editor assets for viewable post types.
	 */
	public function enqueue_block_editor_assets(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}

		$post = get_post();
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		if ( ! is_post_type_viewable( $post->post_type ) ) {
			return;
		}

		$js_data = $this->get_chunk_translations( 'includes/Admin/App/build', 'editor' );
		if ( empty( $js_data['js_file'] ) ) {
			return;
		}

		$handle  = 'burst-editor';
		$version = $js_data['version'];

		wp_enqueue_style(
			'burst-tailwind',
			BURST_URL . 'includes/Admin/App/build/tailwind.generated.css',
			[],
			$version
		);

		wp_enqueue_script(
			$handle,
			BURST_URL . 'includes/Admin/App/build/' . $js_data['js_file'],
			$js_data['dependencies'],
			$version,
			true
		);

		wp_set_script_translations( $handle, 'burst-statistics' );

		wp_localize_script(
			$handle,
			'burst_settings',
			$this->localized_settings( $js_data )
		);
	}
}
