<?php
namespace Burst\Frontend\Share;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Keeps the shared-statistics viewer account a session-only account.
 *
 * Share-link recipients are signed in as burst_statistics_viewer through
 * wp_set_auth_cookie() (see Share_UI::maybe_load_shared_dashboard()). That
 * session must never be convertible into a credential that outlives the share
 * token: WordPress core lets every logged-in user edit their own profile
 * (map_meta_cap 'edit_user' on self), so without these filters a token holder
 * could set a password or email on the account through POST /wp/v2/users/me and
 * keep logging in after the token is revoked. Statistics access itself always
 * requires a valid token, but the account must not stay logged in either.
 *
 * Registered on every request (frontend, REST, wp-login.php, XML-RPC), because
 * every one of those paths can authenticate or edit a user.
 */
class Viewer_Lockdown {

	/**
	 * Register the lockdown filters.
	 */
	public function init(): void {
		add_filter( 'wp_is_application_passwords_available_for_user', [ $this, 'disable_app_passwords_for_viewer' ], 10, 2 );
		add_filter( 'map_meta_cap', [ $this, 'block_viewer_self_edit' ], 10, 4 );
		// Priority 30 runs after core's username/email password checks (20), so a
		// correct password for the viewer is still rejected.
		add_filter( 'authenticate', [ $this, 'block_viewer_password_login' ], 30 );
		add_filter( 'allow_password_reset', [ $this, 'block_viewer_password_reset' ], 10, 2 );
	}

	/**
	 * Disable Application Passwords for the viewer account.
	 *
	 * Without this, a recipient could call POST /wp-json/wp/v2/users/me/application-passwords
	 * with the cookie + nonce from the shared dashboard page and create a credential
	 * that survives share-token revocation or expiry.
	 *
	 * @param bool     $available Whether Application Passwords are available for the user.
	 * @param \WP_User $user      The user being checked.
	 * @return bool False for the viewer, the unchanged value otherwise.
	 */
	public function disable_app_passwords_for_viewer( bool $available, \WP_User $user ): bool {
		if ( self::is_viewer( $user ) ) {
			return false;
		}

		return $available;
	}

	/**
	 * Deny the viewer the core "users can edit themselves" rule.
	 *
	 * This closes POST /wp/v2/users/me, XML-RPC wp.editProfile and profile.php for
	 * the viewer (password, email and profile fields). Administrators editing the
	 * viewer account are unaffected, as the rule only applies to editing oneself.
	 *
	 * @param string[] $caps    The primitive capabilities required.
	 * @param string   $cap     The meta capability being checked.
	 * @param int      $user_id The user the capability is checked for.
	 * @param array    $args    Extra arguments; $args[0] is the user being edited.
	 * @return string[] ['do_not_allow'] for the viewer editing itself, $caps otherwise.
	 */
	public function block_viewer_self_edit( array $caps, string $cap, int $user_id, array $args ): array {
		// Cheapest checks first: this filter runs on every capability check.
		if ( 'edit_user' !== $cap || ! isset( $args[0] ) || (int) $args[0] !== $user_id ) {
			return $caps;
		}

		$user = get_userdata( $user_id );
		if ( ! $user instanceof \WP_User || ! self::is_viewer( $user ) ) {
			return $caps;
		}

		return [ 'do_not_allow' ];
	}

	/**
	 * Reject username/password login for the viewer account.
	 *
	 * The account is only ever signed in through a share token, so a password
	 * login is never legitimate. This also neutralises a password that was set
	 * before the self-edit block existed.
	 *
	 * @param mixed $user The result of the earlier authenticate callbacks.
	 * @return mixed A WP_Error for the viewer, the unchanged value otherwise.
	 *
	 * Mixed $user: core passes WP_User|WP_Error|null, but other plugins' authenticate
	 * callbacks may return anything; a strict type would fatal the login request.
	 */
	public function block_viewer_password_login( mixed $user ): mixed {
		if ( ! $user instanceof \WP_User || ! self::is_viewer( $user ) ) {
			return $user;
		}

		return new \WP_Error(
			'burst_viewer_login_disabled',
			__( 'This account can only be used through a shared statistics link.', 'burst-statistics' )
		);
	}

	/**
	 * Disable the password reset flow for the viewer account.
	 *
	 * @param bool $allow   Whether a password reset is allowed.
	 * @param int  $user_id The user requesting the reset.
	 * @return bool False for the viewer, the unchanged value otherwise.
	 */
	public function block_viewer_password_reset( bool $allow, int $user_id ): bool {
		$user = get_userdata( $user_id );
		if ( $user instanceof \WP_User && self::is_viewer( $user ) ) {
			return false;
		}

		return $allow;
	}

	/**
	 * Whether a user is a shared-statistics viewer.
	 *
	 * @param \WP_User $user The user to check.
	 * @return bool True when the user has the burst_viewer role.
	 */
	private static function is_viewer( \WP_User $user ): bool {
		return in_array( 'burst_viewer', (array) $user->roles, true );
	}
}
