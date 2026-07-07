<?php
namespace Burst\Frontend\Share;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Share_Expired {

	/**
	 * Initialize the Share class.
	 */
	public function init(): void {
		add_action( 'template_redirect', [ $this, 'check_for_share_token' ] );
		add_action( 'template_redirect', [ $this, 'block_viewer_author_archive' ] );
		add_action( 'pre_get_users', [ $this, 'exclude_viewer_from_frontend_user_queries' ] );
		add_action( 'init', [ $this, 'add_rewrite_rules' ] );
		add_filter( 'query_vars', [ $this, 'add_query_vars' ] );
	}

	/**
	 * Exclude the viewer user from public user listings.
	 *
	 * Complements block_viewer_author_archive(): the archive itself is 404'd, but
	 * a theme or plugin can still enumerate the account through author-overview
	 * calls such as wp_list_authors( [ 'hide_empty' => false ] ) or a custom
	 * get_users() loop. Excluding it from every frontend WP_User_Query keeps the
	 * account out of those overviews. Admin/REST-authenticated listings are left
	 * untouched so the account stays manageable in wp-admin.
	 *
	 * @param \WP_User_Query $query The user query being prepared.
	 */
	public function exclude_viewer_from_frontend_user_queries( \WP_User_Query $query ): void {
		if ( is_admin() ) {
			return;
		}

		$viewer = get_user_by( 'login', 'burst_statistics_viewer' );
		if ( ! $viewer ) {
			return;
		}

		$exclude   = (array) $query->get( 'exclude' );
		$exclude[] = $viewer->ID;
		$query->set( 'exclude', $exclude );
	}

	/**
	 * Keep the shared-statistics viewer user off public author archives.
	 *
	 * The burst_statistics_viewer account carries an explanatory bio and website
	 * link so admins understand why it exists, but it authors no content. Without
	 * this, its author archive (and author enumeration via ?author=<id>) would
	 * publicly surface that bio and URL. Serve a 404 for its archive instead.
	 */
	public function block_viewer_author_archive(): void {
		if ( ! is_author() ) {
			return;
		}

		$author = get_queried_object();
		if ( ! $author instanceof \WP_User || ! in_array( 'burst_viewer', (array) $author->roles, true ) ) {
			return;
		}

		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
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
