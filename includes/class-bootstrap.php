<?php
/**
 * Burst bootstrap file.
 */

namespace Burst;

use Burst\Admin\Capability\Capability;

class Bootstrap {
	/**
	 * This function will be executed when our plugin is activated.
	 *
	 * @param bool $is_pro Whether the activated plugin is the pro version.
	 */
	public static function on_activation( bool $is_pro = false ): void {
		update_option( 'burst_run_activation', true, false );
		Capability::add_capability( 'view', [ 'administrator', 'editor' ] );
		Capability::add_capability( 'manage' );

		$is_first_activation = ! get_option( 'burst_activation_time' );

		// Ensure that defaults are set only once.
		if ( $is_first_activation ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_start_onboarding', true, false );
			update_option( 'burst_set_defaults', true, false );
		}

		if ( $is_pro ) {
			update_option( 'burst_run_premium_upgrade', true, false );

			// The auto installer in the free plugin stores the license before it activates pro, so the
			// license, the only step the pro onboarding adds, is already done. The user already made
			// their choice about the free onboarding, so it is not forced on them again either.
			$is_auto_installed_upgrade = ! $is_first_activation && (bool) get_site_option( 'burst_auto_installed_license' );

			if ( ! get_option( 'burst_activation_time_pro' ) ) {
				// In premium, we want to start onboarding again, to ensure the license is set up correctly.
				if ( ! $is_auto_installed_upgrade ) {
					set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
					update_option( 'burst_start_onboarding', true, false );
				}
				// The onboarding moves the skipped/completed flags to their telemetry copies on the
				// first page load after the wizard closes, so read both instead of overwriting the
				// telemetry copy with the already deleted flag.
				$free_skipped   = (bool) get_option( 'burst_skipped_onboarding', false ) || (bool) get_option( 'burst_telemetry_skipped_onboarding', false );
				$free_completed = (bool) get_option( 'burst_completed_onboarding', false ) || (bool) get_option( 'burst_telemetry_completed_onboarding', false );
				update_option( 'burst_telemetry_skipped_onboarding', $free_skipped, false );
				update_option( 'burst_telemetry_completed_onboarding', $free_completed, false );
				// Sites that completed the free onboarding before the free plugin recorded
				// burst_onboarding_free_completed: let the pro onboarding skip the first_run_only steps.
				if ( $free_completed && ! get_option( 'burst_onboarding_free_completed' ) ) {
					update_option( 'burst_onboarding_free_completed', time(), false );
				}
				delete_option( 'burst_skipped_onboarding' );
				delete_option( 'burst_completed_onboarding' );
				update_option( 'burst_activation_time_pro', time(), false );
			}

			// Also close a free onboarding that was started but never finished or skipped.
			if ( $is_auto_installed_upgrade ) {
				delete_option( 'burst_start_onboarding' );
				delete_transient( 'burst_redirect_to_settings_page' );
			}
		}

		// Define constant to force the onboarding to run again.
		// The first line ensures that the entire process runs again, even if the user has completed the onboarding in free.
		if ( defined( 'BURST_FORCE_ONBOARDING' ) ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_start_onboarding', true, false );
			update_option( 'burst_telemetry_skipped_onboarding', (bool) get_option( 'burst_skipped_onboarding', false ), false );
			update_option( 'burst_telemetry_completed_onboarding', (bool) get_option( 'burst_completed_onboarding', false ), false );
			delete_option( 'burst_skipped_onboarding' );
			delete_option( 'burst_completed_onboarding' );
			delete_option( 'burst_onboarding_free_completed' );
		}
	}
}
