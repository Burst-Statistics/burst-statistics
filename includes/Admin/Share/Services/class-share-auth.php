<?php

namespace Burst\Admin\Share\Services;

use Burst\Admin\Capability\Capability;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;
use Burst\Admin\Share\Share;

class Share_Auth {
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
	 * Validate and fix burst_statistics_viewer user.
	 * Ensures user has ONLY burst_viewer role and ONLY view_burst_statistics capability.
	 */
	public function lock_viewer_user_capabilities(): void {
		if ( ! self::is_shareable_link_viewer() ) {
			return;
		}

		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );
		if ( ! $user ) {
			return;
		}

		$needs_fix = false;

		// Only one role allowed: burst_viewer.
		if ( count( $user->roles ) !== 1 || ! in_array( 'burst_viewer', $user->roles, true ) ) {
			$needs_fix = true;
		}

		// Check 2: check allowed capabilities.
		$user_caps    = array_keys( array_filter( $user->allcaps ) );
		$allowed_caps = [
			'view_burst_statistics',
			'burst_viewer',
		];

		// Remove all other capabilities.
		$extra_caps = array_diff( $user_caps, $allowed_caps );
		if ( ! empty( $extra_caps ) ) {
			$needs_fix = true;
		}

		if ( $needs_fix ) {
			foreach ( $user->roles as $role ) {
				$user->remove_role( $role );
			}

			foreach ( $extra_caps as $cap ) {
				$user->remove_cap( $cap );
			}

			$user->add_role( 'burst_viewer' );
			Capability::add_capability( 'view', [ 'burst_viewer' ] );
		}
	}

	/**
	 * If the viewer user does not exist, create it.
	 */
	public function create_viewer_user(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );
		if ( ! $user ) {
			if ( get_role( 'burst_viewer' ) === null ) {
				add_role(
					'burst_viewer',
					__( 'Burst Statistics Viewer', 'burst-statistics' ),
					// No capabilities needed for frontend-only.
					[]
				);
			}

			$profile = $this->get_viewer_profile_fields();
			wp_insert_user(
				[
					'user_login'           => $username,
					'user_pass'            => wp_generate_password( 64, true, true ),
					'user_email'           => 'noreply@' . wp_parse_url( home_url(), PHP_URL_HOST ),
					'user_url'             => $profile['user_url'],
					'description'          => $profile['description'],
					'role'                 => 'burst_viewer',
					'show_admin_bar_front' => 'false',
				]
			);
			Capability::add_capability( 'view', [ 'burst_viewer' ] );
		}
	}

	/**
	 * Descriptive profile fields for the viewer user.
	 *
	 * The bio explains why the account exists so admins are not confused by an
	 * unexpected user, and the website links to the explanatory article. Kept in
	 * one place so both creation and the upgrade backfill stay in sync.
	 *
	 * @return array<string,string>
	 */
	public function get_viewer_profile_fields(): array {
		return [
			'user_url'    => 'https://burst-statistics.com/definition/what-is-the-burst-statistics-viewer-user/',
			'description' => __( 'This account is created automatically by Burst Statistics to power shared statistics links. Recipients of a share link are temporarily signed in as this user so they can view statistics without their own account. It has no administrative capabilities and can only view statistics. You can safely leave it in place.', 'burst-statistics' ),
		];
	}

	/**
	 * Backfill the descriptive bio and website on an existing viewer user.
	 *
	 * Only fills empty fields so a manually edited profile is left untouched.
	 */
	public function backfill_viewer_profile(): void {
		$user = get_user_by( 'login', 'burst_statistics_viewer' );
		if ( ! $user ) {
			return;
		}

		$fields  = $this->get_viewer_profile_fields();
		$updates = [ 'ID' => $user->ID ];
		if ( empty( $user->description ) ) {
			$updates['description'] = $fields['description'];
		}
		if ( empty( $user->user_url ) ) {
			$updates['user_url'] = $fields['user_url'];
		}

		if ( count( $updates ) > 1 ) {
			wp_update_user( $updates );
		}
	}

	/**
	 * Get the viewer user.
	 *
	 * @return int The User ID of the viewer user.
	 */
	public function get_viewer_user(): int {
		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );

		if ( ! $user ) {
			return 0;
		}

		return $user->ID;
	}

	/**
	 * Delete all sessions for the burst_statistics_viewer user.
	 * Runs daily via burst_daily cron to ensure viewer sessions never exceed 24 hours.
	 */
	public function cleanup_viewer_sessions(): void {
		$user = get_user_by( 'login', 'burst_statistics_viewer' );
		if ( ! $user ) {
			return;
		}

		$manager = \WP_Session_Tokens::get_instance( $user->ID );
		$manager->destroy_all();
	}
}
