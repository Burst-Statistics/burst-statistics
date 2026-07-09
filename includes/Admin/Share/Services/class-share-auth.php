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

			wp_insert_user(
				[
					'user_login'           => $username,
					'user_pass'            => wp_generate_password( 64, true, true ),
					'user_email'           => 'noreply@' . wp_parse_url( home_url(), PHP_URL_HOST ),
					'role'                 => 'burst_viewer',
					'show_admin_bar_front' => 'false',
				]
			);
			Capability::add_capability( 'view', [ 'burst_viewer' ] );
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
