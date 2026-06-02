<?php

namespace Burst\Admin\Share\Services;

use Burst\Admin\App\App;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;
use Burst\Admin\Share\Share;

use function Burst\burst_loader;

class Share_UI {
	use Admin_Helper;
	use Save;
	use Sanitize;

	public Share $share;

	/**
	 * Constructor.
	 *
	 * @param Share $share The main Share class instance.
	 */
	public function __construct( Share $share ) {
		$this->share = $share;
	}

	/**
	 * Filter menu items to only include shareable items for share link viewers.
	 *
	 * @param array $menu_items The original menu items.
	 * @return array The filtered menu items.
	 */
	public function allowed_tabs_for_current_shared_view( array $menu_items ): array {

		$user_has_burst_viewer_role = self::is_shareable_link_viewer();
		if ( ! $user_has_burst_viewer_role ) {
			return $menu_items;
		}

		$shared_tab_slugs = $this->share->tokens->get_current_share_link_allowed_tabs();
		// remove items where capabilities are not met.
		foreach ( $menu_items as $key => $menu_item ) {
			// remove any menu items that are not shareable.
			if ( ! isset( $menu_item['shareable'] ) || ! $menu_item['shareable'] ) {
				unset( $menu_items[ $key ] );
				continue;
			}

			// remove any menu items not in the allowed tabs.
			if ( ! in_array( $menu_item['id'], $shared_tab_slugs, true ) ) {
				unset( $menu_items[ $key ] );
			}
		}

		return $menu_items;
	}

	/**
	 * Get the requested shared dashboard tab from the routed path query var.
	 *
	 * Falls back to parsing the request URI for backward compatibility.
	 *
	 * @return string The requested tab slug, or 'dashboard' if none is present.
	 */
	private function get_requested_shared_dashboard_tab(): string {
		$requested_tab = get_query_var( 'burst_share_path' );
		if ( is_string( $requested_tab ) && '' !== $requested_tab ) {
			return $this->share->sanitize_tab( $requested_tab );
		}

		// Fallback: rewrite rules may not be flushed yet (e.g. when the first
		// token was auto-generated through a report rather than the share UI),
		// so resolve the tab from the request URI directly.
		return $this->share->routing->get_current_shared_request_tab();
	}

	/**
	 * Check for a share token and load the shared dashboard.
	 */
	public function maybe_load_shared_dashboard(): void {
		if (
			! get_query_var( 'burst_share_page' ) &&
			( ! isset( $_SERVER['REQUEST_URI'] ) || ! str_contains( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ), '/burst-dashboard' ) )
		) {
			return;
		}

		$token = $this->share->tokens->get_current_token();

		if ( empty( $token ) ) {
			return;
		}

		// This is a "just in case" check, if the token is invalid, we should never end up here anyway. It's already validated by this point.
		if ( ! self::validate_share_token( $token ) ) {
			wp_die( esc_html__( 'This share link has expired or is invalid.', 'burst-statistics' ) );
		}

		// Old shared links used /burst-dashboard/?token=...#/statistics, so when.
		// The routed tab is missing we serve a tiny upgrader page instead of the app.
		if ( '' === $this->get_requested_shared_dashboard_tab() ) {
			$this->load_legacy_share_redirect_template();
		}

		$share_links = $this->share->tokens->get_share_links( 'all', $token );
		if ( ! empty( $share_links ) ) {
			$share_link   = $share_links[0];
			$allowed_tabs = $share_link['shared_tabs'] ?? [];
			$report_id    = (int) ( $share_link['report_id'] ?? 0 );

			if ( 0 === $report_id && ! empty( $allowed_tabs ) ) {
				$requested_tab = $this->get_requested_shared_dashboard_tab();
				if ( ! in_array( $requested_tab, $allowed_tabs, true ) ) {
					wp_die( esc_html__( 'This share link does not allow access to this tab.', 'burst-statistics' ) );
				}
			}
		}

		// Only log in if user is not already logged in.
		if ( ! is_user_logged_in() ) {
			$viewer_user_id = $this->share->auth->get_viewer_user();
			wp_set_current_user( $viewer_user_id );
			wp_set_auth_cookie( $viewer_user_id, false );

			// Clear cached capabilities so subsequent checks aren't incorrectly returning 'false'
			// based on the anonymous state before they were logged in.
			$loader = burst_loader();
			unset( $loader->is_shareable_link_viewer );
			unset( $loader->user_can_view );
			unset( $loader->user_can_view_sales );
		}

		if ( ! self::is_shareable_link_viewer() && ! $this->user_can_view() ) {
			wp_die( esc_html__( 'You are already logged in, but with a user account with insufficient permissions to view this page. Log out first, or use this link in a private window.', 'burst-statistics' ) );
		}

		$this->load_statistics_template();
		exit;
	}

	/**
	 * Load a minimal redirect page for legacy hash-only share URLs.
	 *
	 * The browser is the only place where the hash fragment is available, so this
	 * page upgrades old URLs like /burst-dashboard/?token=...#/story to the
	 * path-based format before the app template is loaded.
	 */
	private function load_legacy_share_redirect_template(): void {
		status_header( 200 );
		nocache_headers();

		$denied_message = __( 'This share link does not allow access to this tab.', 'burst-statistics' );
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?>>
			<head>
				<meta charset="<?php bloginfo( 'charset' ); ?>">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title><?php esc_html_e( 'WordPress › Error', 'burst-statistics' ); ?></title>
				<style>
					html {
						background: #f1f1f1;
					}
					body {
						background: #fff;
						border: 1px solid #ccd0d4;
						color: #444;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
						margin: 2em auto;
						padding: 1em 2em;
						max-width: 700px;
						-webkit-box-shadow: 0 1px 1px rgba(0, 0, 0, .04);
						box-shadow: 0 1px 1px rgba(0, 0, 0, .04);
					}
					h1 {
						border-bottom: 1px solid #dadada;
						clear: both;
						color: #666;
						font-size: 24px;
						margin: 30px 0 0 0;
						padding: 0 0 7px;
					}
					#error-page {
						margin-top: 50px;
					}
					#error-page p,
					#error-page .wp-die-message {
						font-size: 14px;
						line-height: 1.5;
						margin: 25px 0 20px;
					}
				</style>
				<script>
					(function() {
						const currentPath = window.location.pathname || '';
						const hash = window.location.hash || '';
						const searchParams = new URLSearchParams( window.location.search || '' );
						const deniedMessage = <?php echo wp_json_encode( $denied_message ); ?>;
						const allowedTabs = <?php echo wp_json_encode( $this->share->shareable_tabs_ids ); ?>;

						const showMessage = ( text ) => {
							const message = document.getElementById( 'burst-legacy-share-message-text' );
							if ( message ) {
								message.textContent = text;
							} else {
								window.burstLegacyShareMessage = text;
							}
						};

						if ( ! currentPath.endsWith( '/burst-dashboard/' ) || ! hash.startsWith( '#/' ) ) {
							showMessage( deniedMessage );
							return;
						}

						const hashRoute = hash.slice( 1 );
						const [ routePath = '', routeSearch = '' ] = hashRoute.split( '?' );
						// Strip any leading slashes from the legacy hash route.
						// Regex: `/^\/+/` matches 1+ slashes at the start of the string.
						// Example: `/statistics` -> `statistics`, `//story` -> `story`.
						const normalizedRoutePath = routePath.replace( /^\/+/, '' );
						if ( ! normalizedRoutePath ) {
							showMessage( deniedMessage );
							return;
						}

						// Legacy routes should be a single tab slug (no nested path segments).
						const tab = normalizedRoutePath.split( '/' )[0] || '';
						if ( tab !== normalizedRoutePath || ! allowedTabs.includes( tab ) ) {
							showMessage( deniedMessage );
							return;
						}

						// Query state used to live after the hash, e.g. #/statistics?range=custom.
						// Move it into the real query string so the browser-history router can
						// consume it on the upgraded URL.
						const routeSearchParams = new URLSearchParams( routeSearch );
						routeSearchParams.forEach( ( value, key ) => {
							searchParams.set( key, value );
						} );

						const queryString = searchParams.toString();
						// Ensure we only replace the trailing `/burst-dashboard/` segment.
						// Regex: `/\/burst-dashboard\/$/` matches `/burst-dashboard/` at end-of-string.
						// Example: `/burst-dashboard/` -> `/burst-dashboard/statistics/`.
						//
						// Ensure the target route ends with exactly one trailing slash.
						// Regex: `/\/?$/` matches an optional trailing slash at end-of-string.
						// Example: `statistics` -> `statistics/`, `statistics/` -> `statistics/`.
						const newPath = currentPath.replace( /\/burst-dashboard\/$/, `/burst-dashboard/${normalizedRoutePath.replace( /\/?$/, '/' )}` );
						window.location.replace( `${newPath}${queryString ? `?${queryString}` : ''}` );
					})();
				</script>
			</head>
			<body id="error-page">
				<div class="wp-die-message" id="burst-legacy-share-message-text"><?php esc_html_e( 'Please wait while this shared link is upgraded.', 'burst-statistics' ); ?></div>
				<script>
					(function() {
						if ( window.burstLegacyShareMessage ) {
							const message = document.getElementById( 'burst-legacy-share-message-text' );
							if ( message ) {
								message.textContent = window.burstLegacyShareMessage;
							}
						}
					})();
				</script>
			</body>
			</html>
		<?php
		exit;
	}

	/**
	 * Load the shared statistics template.
	 */
	private function load_statistics_template(): void {
		// Set query var so WordPress doesn't try to load theme.
		global $wp_query;
		$wp_query->is_404 = false;
		status_header( 200 );

		$app = new App();
		$app->init();
		$app->plugin_admin_scripts();
		$user_lang = get_user_locale();
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?> lang="<?php echo esc_attr( $user_lang ); ?>">
			<head>
				<meta charset="<?php bloginfo( 'charset' ); ?>">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title><?php esc_html_e( 'Burst Statistics', 'burst-statistics' ); ?></title>
				<style>
					body.burst-shared-view {
						background-color:#f0f0f1;
					}
					#burst-statistics {
						padding-left:23px;
					}
				</style>
			</head>
			<body class="burst-shared-view">
			<?php
			$app->dashboard();
			wp_print_footer_scripts();
			?>
			</body>
			</html>
		<?php
		exit;
	}
}
