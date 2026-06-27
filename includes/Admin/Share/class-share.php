<?php

namespace Burst\Admin\Share;

use Burst\Admin\Share\Services\Share_Tokens;
use Burst\Admin\Share\Services\Share_Routing;
use Burst\Admin\Share\Services\Share_Auth;
use Burst\Admin\Share\Services\Share_UI;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Main Share Class (Container)
 */
class Share {

	public Share_Tokens $tokens;
	public Share_Routing $routing;
	public Share_Auth $auth;
	public Share_UI $ui;
	public array $shareable_tabs_ids = [];

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->tokens  = new Share_Tokens( $this );
		$this->routing = new Share_Routing( $this );
		$this->auth    = new Share_Auth( $this );
		$this->ui      = new Share_UI( $this );

		$this->shareable_tabs_ids = [ 'statistics', 'sources', 'sales', 'story', 'engagement' ];
	}

	/**
	 * Initialize the Share class.
	 */
	public function init(): void {
		add_action( 'burst_do_action', [ $this->tokens, 'do_rest_action' ], 10, 3 );
		add_action( 'template_redirect', [ $this->ui, 'maybe_load_shared_dashboard' ] );
		add_action( 'init', [ $this->routing, 'add_rewrite_rules' ] );
		add_action( 'admin_init', [ $this->auth, 'lock_viewer_user_capabilities' ] );
		add_filter( 'query_vars', [ $this->routing, 'add_query_vars' ] );
		add_filter( 'burst_verify_nonce', [ $this->tokens, 'verify_nonce_for_shared_links' ], 10, 3 );
		add_filter( 'burst_share_link_permissions', [ $this->tokens, 'filter_share_link_permissions' ], 10, 0 );
		// Enforce share-link date/filter restrictions on incoming request args before
		// any data class (sales, quick-wins, funnel) reads $args['date_start'] for
		// raw JOIN ON date guards. Priority 5 so ecommerce date filter (10) sees enforced values.
		add_filter( 'burst_get_data_request_args', [ $this->routing, 'apply_share_link_restrictions_filter' ], 5, 3 );
		// Execute our burst_menu, to remove any menu items that shared viewer does not have access to.
		add_filter( 'burst_menu', [ $this->ui, 'allowed_tabs_for_current_shared_view' ], PHP_INT_MAX );
		add_action( 'admin_init', [ $this->routing, 'maybe_flush_rewrite_rules' ] );
		add_action( 'burst_daily', [ $this->auth, 'cleanup_viewer_sessions' ] );
	}

	/**
	 * Disable Application Passwords for the burst_viewer role.
	 *
	 * Share-link recipients are temporarily authenticated as the burst_statistics_viewer
	 * user. Without this filter, a recipient could call the WP core endpoint
	 * POST /wp-json/wp/v2/users/me/application-passwords using the cookie + nonce from
	 * the shared dashboard page and create a credential that survives share-token
	 * revocation or expiry, providing persistent Basic-Auth access to the same data
	 * the share originally exposed.
	 *
	 * @param bool     $available Whether Application Passwords are available for the user.
	 * @param \WP_User $user      The user being checked.
	 */
	public function disable_app_passwords_for_viewer( bool $available, \WP_User $user ): bool {
		if ( in_array( 'burst_viewer', $user->roles, true ) ) {
			return false;
		}
		return $available;
	}

	/**
	 * Sanitize a single tab value against the whitelist of allowed shareable tabs.
	 * Returns an empty string when the tab is not allowed.
	 *
	 * @param mixed $tab tab value to be sanitized.
	 *
	 * Mixed $tab: untrusted value from request/token storage that may not be a string; the is_string guard rejects anything else.
	 */
	public function sanitize_tab( mixed $tab ): string {
		if ( ! is_string( $tab ) ) {
			return '';
		}

		$tab = sanitize_key( trim( $tab ) );
		return in_array( $tab, $this->shareable_tabs_ids, true ) ? $tab : '';
	}

	/**
	 * Sanitize an array (or single value) of tabs against the whitelist.
	 * Accepts a string or array and returns a unique array of valid tab ids.
	 *
	 * @param mixed $tabs tabs to be sanitized.
	 * @return string[]
	 *
	 * Mixed $tabs: untrusted value from request/token storage — accepts a single string or an array of tabs and rejects anything else via the guards below.
	 */
	public function sanitize_tabs( mixed $tabs ): array {
		if ( is_string( $tabs ) ) {
			$tabs = [ $tabs ];
		}

		if ( ! is_array( $tabs ) ) {
			return [];
		}

		$sanitized = [];
		foreach ( $tabs as $t ) {
			$t = $this->sanitize_tab( $t );
			if ( $t !== '' ) {
				$sanitized[] = $t;
			}
		}

		return array_values( array_unique( $sanitized ) );
	}
}
