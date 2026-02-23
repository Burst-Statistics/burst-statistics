<?php
namespace Burst\Frontend\Share;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Share_Expired {

	/**
	 * Initialize the Share class.
	 */
	public function init(): void {
		add_action( 'template_redirect', [ $this, 'check_for_share_token' ] );
		add_action( 'init', [ $this, 'add_rewrite_rules' ] );
		add_filter( 'query_vars', [ $this, 'add_query_vars' ] );
	}

	/**
	 * Add custom query var.
	 *
	 * @param array $vars Query vars.
	 * @return array Modified query vars.
	 */
	public function add_query_vars( array $vars ): array {
		$vars[] = 'burst_share_page';
		$vars[] = 'burst_share_token';
		return $vars;
	}

	/**
	 * Add custom rewrite rule for /burst/dashboard.
	 */
	public function add_rewrite_rules(): void {
		add_rewrite_rule(
			'^burst-dashboard/?$',
			'index.php?burst_share_page=1',
			'top'
		);
	}

	/**
	 * Check for share token in URL and log in viewer user if valid.
	 */
	public function check_for_share_token(): void {
		if ( ! get_query_var( 'burst_share_page' ) &&
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Not using the value, just an exists check.
			( ! isset( $_SERVER['REQUEST_URI'] ) || strpos( wp_unslash( $_SERVER['REQUEST_URI'] ), '/burst-dashboard' ) === false ) ) {
			return;
		}

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['burst_share_token'] ) ) {
			return;
		}

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		wp_die( esc_html__( 'This share link has expired or is invalid.', 'burst-statistics' ) );
	}
}
