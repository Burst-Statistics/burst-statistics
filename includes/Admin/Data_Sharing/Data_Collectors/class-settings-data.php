<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Pro\Admin\Licensing\License_Info;
use Burst\Pro\Admin\Licensing\Licensing;
use Burst\Traits\Helper;

/**
 * Class Settings_Data
 */
class Settings_Data extends Data_Collector {
	use Helper;

	/**
	 * Collect data from the settings
	 */
	public function collect_data(): array {
		$licensing      = new Licensing();
		$license_status = $licensing->get_license_status();
		$license_status = empty( $license_status ) ? '' : $license_status;

		$burst_activation_time_pro = get_option( 'burst_activation_time_pro', null );

		if ( empty( $burst_activation_time_pro ) ) {
			$burst_activation_time_pro = null;
		} else {
			$burst_activation_time_pro = intval( $burst_activation_time_pro );

			if ( $burst_activation_time_pro <= 0 ) {
				$burst_activation_time_pro = null;
			}
		}

		$burst_activation_time = get_option( 'burst_activation_time', null );

		if ( empty( $burst_activation_time ) ) {
			$burst_activation_time = null;
		} else {
			$burst_activation_time = intval( $burst_activation_time );

			if ( $burst_activation_time <= 0 ) {
				$burst_activation_time = null;
			}
		}

		return [
			'enable_turbo_mode'                   => $this->get_option_bool( 'enable_turbo_mode' ),
			'enable_cookieless_tracking'          => $this->get_option_bool( 'enable_cookieless_tracking' ),
			'enable_do_not_track'                 => $this->get_option_bool( 'enable_do_not_track' ),
			'dismiss_non_error_notices'           => $this->get_option_bool( 'dismiss_non_error_notices' ),
			'filtering_by_domain'                 => $this->get_option_bool( 'filtering_by_domain' ),
			'track_url_change'                    => $this->get_option_bool( 'track_url_change' ),
			'combine_vars_and_script'             => $this->get_option_bool( 'combine_vars_and_script' ),
			'enable_ghost_mode'                   => $this->get_option_bool( 'ghost_mode' ),
			'uses_custom_logo'                    => $this->has_custom_logo(),
			'tips_tricks_signup'                  => $this->has_signed_up_for_tips(),
			'burst_pro_active'                    => defined( 'BURST_PRO' ),
			'burst_version'                       => BURST_VERSION,
			'subscription_tier'                   => $this->get_subscription_tier(),
			'excluded_user_roles'                 => $this->get_option( 'user_role_blocklist', [] ),
			'uses_ip_exclusion'                   => $this->has_ip_exclusion(),
			'geo_ip_database_type'                => $this->get_option( 'geo_ip_database_type', 'city' ),
			'archive_mode'                        => $this->get_option( 'archive_data', 'none' ),
			'archive_months'                      => $this->get_option_int( 'archive_after_months' ),
			'site_category'                       => $this->get_option( 'site_category', 'uncategorized' ),
			'plugin_installed_by'                 => get_option( 'teamupdraft_installation_source_burst-statistics', '' ),
			'burst_auto_installed'                => get_option( 'burst_auto_installed', false ),
			'burst_activation_time_pro'           => $burst_activation_time_pro,
			'burst_completed_onboarding'          => get_option( 'burst_completed_onboarding', false ),
			'burst_skipped_onboarding'            => get_option( 'burst_skipped_onboarding', false ),
			'burst_activation_time'               => $burst_activation_time,
			'time_since_cron_hit'                 => time() - intval( get_option( 'burst_last_cron_hit', time() ) ),
			'burst_geo_ip_file'                   => get_option( 'burst_geo_ip_file', '' ),
			'burst_geo_ip_import_error'           => get_option( 'burst_geo_ip_import_error', '' ),
			'burst_tracking_status'               => get_option( 'burst_tracking_status', 'unknown' ),
			'burst_share_tokens'                  => ! empty( get_option( 'burst_share_tokens', [] ) ),
			'burst_use_fallback_licensing_domain' => ! empty( get_transient( 'burst_use_fallback_licensing_domain' ) ),
			'burst_license_status'                => $license_status,
		];
	}

	/**
	 * Check if a custom logo is configured
	 */
	private function has_custom_logo(): bool {
		return ! empty( $this->get_option( 'logo_attachment_id' ) );
	}

	/**
	 * Check if user has signed up for tips and tricks
	 */
	private function has_signed_up_for_tips(): bool {
		return null !== $this->get_option( 'signed_up_for_tips_and_tricks' );
	}

	/**
	 * Check if IP exclusion is enabled
	 */
	private function has_ip_exclusion(): bool {
		return ! empty( $this->get_option_bool( 'ip_blocklist' ) );
	}

	/**
	 * Get the subscription tier
	 */
	private function get_subscription_tier(): string {
		$license_info = new License_Info();
		return $license_info->tier;
	}
}
