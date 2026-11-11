<?php
/**
 * Visitor opt-out block and shortcode.
 *
 * @package Burst\Frontend
 */
namespace Burst\Frontend;

defined( 'ABSPATH' ) || die();

/**
 * Shows a button that lets a visitor opt out of Burst tracking, and back in.
 *
 * The button carries no state from the server: its label and status line are
 * set in the browser, so a cached page still shows the visitor's own choice.
 * The click is handled by assets/js/opt-out.js, which writes the WP Consent
 * API decision when that API is active and the burst_consent cookie otherwise.
 * Script and stylesheet are enqueued from the render, so they only load on
 * pages that actually show the button.
 */
class Opt_Out_Block {

	public const SHORTCODE = 'burst_opt_out';

	/**
	 * Register the block, the shortcode and their assets.
	 */
	public function init(): void {
		add_action( 'init', [ $this, 'register_block' ] );
		add_shortcode( self::SHORTCODE, [ $this, 'render' ] );
	}

	/**
	 * Register the block with its editor script and server-side render.
	 */
	public function register_block(): void {
		// On init, not on wp_enqueue_scripts: that hook does not fire for the
		// REST request the editor renders the block through, and the handles
		// have to exist by the time block.json is read below, since it refers
		// to both of them by name.
		$this->register_assets();

		wp_register_script(
			'burst-opt-out-block-editor',
			plugins_url( 'blocks/opt-out/index.js', __FILE__ ),
			[ 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-block-editor', 'wp-components', 'wp-server-side-render' ],
			BURST_VERSION,
			true
		);
		wp_set_script_translations( 'burst-opt-out-block-editor', 'burst-statistics', BURST_PATH . '/languages' );

		// Everything static comes from blocks/opt-out/block.json: the name, the
		// editor metadata and the two label attributes. Only the render callback
		// is passed here, because it is a method this class shares with the
		// shortcode and JSON cannot name one.
		register_block_type(
			__DIR__ . '/blocks/opt-out',
			[
				'render_callback' => [ $this, 'render' ],
			]
		);
	}

	/**
	 * Register the button's script and stylesheet without enqueueing them.
	 *
	 * The render enqueues them, which keeps them off every other page.
	 */
	private function register_assets(): void {
		// No wp-i18n dependency: every string the script shows is translated in
		// PHP and passed in on the button, so no translation runtime is loaded.
		wp_register_script(
			'burst-opt-out',
			BURST_URL . 'assets/js/opt-out.js',
			[],
			BURST_VERSION,
			true
		);

		// block.json names this handle as the editorStyle, because the editor
		// renders the block over REST and that response carries only the
		// markup: a stylesheet enqueued from render() never reaches the editor.
		// As an editor style it does, while staying off every frontend page
		// that has no button on it, which a 'style' handle would not.
		wp_register_style(
			'burst-opt-out',
			BURST_URL . 'assets/css/opt-out.css',
			[],
			BURST_VERSION
		);
	}

	/**
	 * Render the opt-out button.
	 *
	 * Shared by the block and the shortcode. The label shown before the script
	 * runs is the opt-out one, because a visitor who has not chosen is tracked.
	 *
	 * The button carries the `wp-element-button` class, so it picks up the
	 * theme's button styling from theme.json on both paths.
	 *
	 * @param array<string,string>|string $atts    Block attributes or shortcode attributes.
	 * @param string|null                 $content Inner content; this block has none.
	 * @param \WP_Block|string|null       $block   A WP_Block on the block path, the shortcode
	 *                                             tag (a string) on the shortcode path. Used
	 *                                             only to tell the two apart, because
	 *                                             get_block_wrapper_attributes() has nothing
	 *                                             to read outside a block render.
	 * @return string The button markup.
	 */
	public function render( array|string $atts = [], ?string $content = null, \WP_Block|string|null $block = null ): string {
		wp_enqueue_script( 'burst-opt-out' );
		wp_enqueue_style( 'burst-opt-out' );

		// The block attributes in block.json carry these same snake_case names,
		// so both paths pass through this one shortcode_atts call.
		$atts = shortcode_atts(
			[
				'opt_out_label' => '',
				'opt_in_label'  => '',
			],
			is_array( $atts ) ? $atts : [],
			self::SHORTCODE
		);

		// "Allow tracking" rather than "opt back in": with a Consent API in an
		// opt-in regime a visitor who has not answered the banner yet is not
		// tracked either, and has nothing to opt back in to.
		$opt_out_label = '' !== $atts['opt_out_label']
			? $atts['opt_out_label']
			: __( 'Opt out of tracking', 'burst-statistics' );
		$opt_in_label  = '' !== $atts['opt_in_label']
			? $atts['opt_in_label']
			: __( 'Allow tracking', 'burst-statistics' );

		$is_block = $block instanceof \WP_Block;

		// The wrapper is the block's root element, so it is what carries the
		// block wrapper attributes. Already escaped by core, which is why
		// core's own blocks print it as is.
		$wrapper_attributes = $is_block
			? get_block_wrapper_attributes( [ 'class' => 'burst-opt-out' ] )
			: 'class="' . esc_attr( 'burst-opt-out' ) . '"';

		$inner = sprintf(
			'<button type="button" class="burst-opt-out__button wp-element-button"'
			. ' data-opt-out-label="%1$s" data-opt-in-label="%2$s"'
			. ' data-opted-out-status="%3$s" data-opted-in-status="%4$s">%5$s</button>'
			. '<span class="burst-opt-out__status" role="status" aria-live="polite"></span>',
			esc_attr( $opt_out_label ),
			esc_attr( $opt_in_label ),
			// Neither message promises a visit is counted: that also depends on
			// Do Not Track, a blocked user role and bot filtering.
			esc_attr__( 'You are opted out. Your visits are not counted.', 'burst-statistics' ),
			esc_attr__( 'Your opt-out has been removed.', 'burst-statistics' ),
			esc_html( $opt_out_label )
		);

		// The editor builds the root element itself, around what this returns,
		// so sending the wrapper too would nest a second one inside it.
		if ( $is_block && $this->is_block_renderer_request() ) {
			return $inner;
		}

		return sprintf( '<span %1$s>%2$s</span>', $wrapper_attributes, $inner );
	}

	/**
	 * Whether this render is the editor asking for a preview over REST.
	 *
	 * The editor wraps the response in the element useBlockProps() builds, and
	 * that element is the block's root there, carrying the same generated class
	 * the wrapper carries on the frontend. Leaving the wrapper out of this one
	 * response is what makes the two environments render the same markup.
	 *
	 * @return bool True during a /wp/v2/block-renderer/ request.
	 */
	private function is_block_renderer_request(): bool {
		if ( ! wp_is_serving_rest_request() ) {
			return false;
		}

		global $wp;
		$route = isset( $wp->query_vars['rest_route'] ) ? (string) $wp->query_vars['rest_route'] : '';

		return str_starts_with( $route, '/wp/v2/block-renderer/' );
	}
}
