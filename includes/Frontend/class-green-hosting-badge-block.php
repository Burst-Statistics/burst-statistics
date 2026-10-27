<?php
/**
 * Green hosting badge block and shortcode.
 *
 * @package Burst\Frontend
 */
namespace Burst\Frontend;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Shows the Green Web Badge on the site when its hosting is verified green.
 *
 * Without a current verification the block and the shortcode output nothing:
 * no "not green" or "expired" notice reaches visitors.
 *
 * Rendering reads one autoloaded option and nothing else. The option is
 * written by Admin\Statistics\Green_Hosting_Badge, which also removes it from
 * cron once the verification expires or the host changes.
 */
class Green_Hosting_Badge_Block {
	use Helper;

	public const BLOCK_NAME = 'burst/green-hosting-badge';
	public const SHORTCODE  = 'burst_green_hosting_badge';
	public const OPTION     = 'burst_green_hosting_badge';

	private const WIDTH  = 200;
	private const HEIGHT = 95;

	/**
	 * Register the block and the shortcode.
	 */
	public function init(): void {
		add_action( 'init', [ $this, 'register_block' ] );
		add_shortcode( self::SHORTCODE, [ $this, 'render' ] );
	}

	/**
	 * Register the block with its editor script and server-side render.
	 */
	public function register_block(): void {
		wp_register_script(
			'burst-green-hosting-badge-block-editor',
			plugins_url( 'blocks/green-hosting-badge.js', __FILE__ ),
			[ 'wp-blocks', 'wp-element', 'wp-i18n', 'wp-block-editor', 'wp-server-side-render' ],
			BURST_VERSION,
			true
		);
		wp_set_script_translations( 'burst-green-hosting-badge-block-editor', 'burst-statistics', BURST_PATH . '/languages' );

		register_block_type(
			self::BLOCK_NAME,
			[
				'editor_script'   => 'burst-green-hosting-badge-block-editor',
				'render_callback' => [ $this, 'render' ],
			]
		);
	}

	/**
	 * Render the badge, or nothing when the hosting is not currently verified.
	 *
	 * Shared by the block and the shortcode, which both pass arguments this
	 * badge does not use.
	 *
	 * @return string The badge markup, or an empty string.
	 */
	public function render(): string {
		if ( ! $this->is_feature_enabled( 'co2' ) ) {
			return '';
		}

		$badge = get_option( self::OPTION, [] );
		if ( ! is_array( $badge ) || empty( $badge['host'] ) || empty( $badge['url'] ) ) {
			return '';
		}

		return sprintf(
			'<a class="burst-green-hosting-badge" href="%1$s" target="_blank" rel="noopener"><img src="%2$s" alt="%3$s" width="%4$d" height="%5$d" loading="lazy" /></a>',
			esc_url( 'https://www.thegreenwebfoundation.org/green-web-check/?url=' . rawurlencode( (string) $badge['host'] ) ),
			esc_url( (string) $badge['url'] ),
			esc_attr__( 'This website uses green hosting, verified by the Green Web Foundation', 'burst-statistics' ),
			self::WIDTH,
			self::HEIGHT
		);
	}
}
