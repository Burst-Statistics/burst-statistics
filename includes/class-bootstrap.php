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

		// Ensure that defaults are set only once.
		if ( ! get_option( 'burst_activation_time' ) ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_start_onboarding', true, false );
			update_option( 'burst_set_defaults', true, false );
		}

		if ( $is_pro ) {
			update_option( 'burst_run_premium_upgrade', true, false );

			// In premium, we want to start onboarding again, to ensure the license is set up correctly.
			if ( ! get_option( 'burst_activation_time_pro' ) ) {
				set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
				update_option( 'burst_start_onboarding', true, false );
				delete_option( 'burst_skipped_onboarding' );
				delete_option( 'burst_completed_onboarding' );
				update_option( 'burst_activation_time_pro', time(), false );
			}
		}

		// Define constant to force the onboarding to run again.
		// The first line ensures that the entire process runs again, even if the user has completed the onboarding in free.
		if ( defined( 'BURST_FORCE_ONBOARDING' ) ) {
			set_transient( 'burst_redirect_to_settings_page', true, 5 * MINUTE_IN_SECONDS );
			update_option( 'burst_start_onboarding', true, false );
			delete_option( 'burst_skipped_onboarding' );
			delete_option( 'burst_completed_onboarding' );
			delete_option( 'burst_onboarding_free_completed' );
		}
	}
}
