<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Traits\Helper;
use function Burst\burst_loader;

/**
 * Class Settings_Data
 */
class Settings_Data extends Data_Collector {
	use Helper;

	/**
	 * Normalize common option encodings to a strict boolean.
	 *
	 * Mixed $value: this normalizes a raw get_option() value, which can be any serialized type (bool|int|float|string|null); narrowing would defeat its purpose.
	 */
	private function normalize_option_boolean( mixed $value, bool $default_value = false ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( is_int( $value ) || is_float( $value ) ) {
			return ( (int) $value ) !== 0;
		}

		if ( is_string( $value ) ) {
			$normalized = strtolower( trim( $value ) );

			if ( in_array( $normalized, [ '1', 'true', 'yes', 'on' ], true ) ) {
				return true;
			}

			if ( in_array( $normalized, [ '0', 'false', 'no', 'off', '' ], true ) ) {
				return false;
			}
		}

		return $default_value;
	}

	/**
	 * Read a WordPress option and normalize to a strict boolean.
	 */
	private function get_wordpress_option_bool( string $option, bool $default_value = false ): bool {
		return $this->normalize_option_boolean( get_option( $option, $default_value ), $default_value );
	}

	/**
	 * Read a Burst setting and normalize to a strict boolean.
	 */
	private function get_burst_setting_bool( string $option, bool $default_value = false ): bool {
		return $this->normalize_option_boolean( $this->get_option( $option, $default_value ), $default_value );
	}

	/**
	 * Get Team Updraft plugin install source map.
	 *
	 * @return array<string,string>
	 */
	private function get_udp_plugin_install_sources(): array {
		global $wpdb;

		$prefix = 'teamupdraft_installation_source_';
		$rows   = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s",
				$wpdb->esc_like( $prefix ) . '%'
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return [];
		}

		$sources = [];

		foreach ( $rows as $row ) {
			$option_name = isset( $row['option_name'] ) ? (string) $row['option_name'] : '';
			$source      = isset( $row['option_value'] ) ? sanitize_text_field( (string) $row['option_value'] ) : '';

			if ( '' === $option_name || '' === $source || 0 !== strpos( $option_name, $prefix ) ) {
				continue;
			}

			$plugin_slug = sanitize_text_field( substr( $option_name, strlen( $prefix ) ) );

			if ( '' === $plugin_slug ) {
				continue;
			}

			$sources[ $plugin_slug ] = $source;
		}

		return $sources;
	}

	/**
	 * Count active share links by type.
	 *
	 * @param string $type all, link, or report.
	 */
	private function get_share_links_count( string $type ): int {
		$share_links = burst_loader()->admin->share->tokens->get_share_links( $type );

		if ( ! is_array( $share_links ) ) {
			return 0;
		}

		return count( $share_links );
	}

	/**
	 * Collect data from the settings
	 */
	public function collect_data(): array {
		$license_status             = apply_filters( 'burst_data_sharing_license_status', 'free' );
		$burst_activation_time_pro  = get_option( 'burst_activation_time_pro', null );
		$burst_completed_onboarding = $this->normalize_option_boolean(
			get_option(
				'burst_telemetry_completed_onboarding',
				get_option( 'burst_completed_onboarding', false )
			),
			false
		);
		$burst_skipped_onboarding   = $this->normalize_option_boolean(
			get_option(
				'burst_telemetry_skipped_onboarding',
				get_option( 'burst_skipped_onboarding', false )
			),
			false
		);

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
			'enable_turbo_mode'                   => $this->get_burst_setting_bool( 'enable_turbo_mode' ),
			'enable_cookieless_tracking'          => $this->get_burst_setting_bool( 'enable_cookieless_tracking' ),
			'enable_do_not_track'                 => $this->get_burst_setting_bool( 'enable_do_not_track' ),
			'dismiss_non_error_notices'           => $this->get_burst_setting_bool( 'dismiss_non_error_notices' ),
			'filtering_by_domain'                 => $this->get_burst_setting_bool( 'filtering_by_domain' ),
			'track_url_change'                    => $this->get_burst_setting_bool( 'track_url_change' ),
			'combine_vars_and_script'             => $this->get_burst_setting_bool( 'combine_vars_and_script' ),
			'enable_ghost_mode'                   => $this->get_burst_setting_bool( 'ghost_mode' ),
			'uses_custom_logo'                    => $this->has_custom_logo(),
			'tips_tricks_signup'                  => $this->get_burst_setting_bool( 'tips_tricks_mailinglist' ),
			'burst_pro_active'                    => defined( 'BURST_PRO' ),
			'burst_version'                       => BURST_VERSION,
			'subscription_tier'                   => $this->get_subscription_tier(),
			'excluded_user_roles'                 => $this->get_option( 'user_role_blocklist', [] ),
			'uses_ip_exclusion'                   => $this->get_burst_setting_bool( 'ip_blocklist' ),
			// Derived, not stored: free always tracks country, Pro always tracks city.
			'geo_ip_database_type'                => defined( 'BURST_PRO_FILE' ) ? 'city' : 'country',
			'archive_mode'                        => $this->get_option( 'archive_data', 'none' ),
			'archive_months'                      => $this->get_option_int( 'archive_after_months' ),
			'site_category'                       => $this->get_option( 'site_category', 'uncategorized' ),
			'plugin_installed_by'                 => get_option( 'teamupdraft_installation_source_burst-statistics', '' ),
			'udp_plugin_install_sources'          => $this->get_udp_plugin_install_sources(),
			'burst_auto_installed'                => $this->get_wordpress_option_bool( 'burst_auto_installed', false ),
			'burst_activation_time_pro'           => $burst_activation_time_pro,
			'burst_completed_onboarding'          => $burst_completed_onboarding,
			'burst_skipped_onboarding'            => $burst_skipped_onboarding,
			'burst_activation_time'               => $burst_activation_time,
			'time_since_cron_hit'                 => time() - intval( get_option( 'burst_last_cron_hit', time() ) ),
			'burst_geo_ip_file'                   => get_option( 'burst_geo_ip_file', '' ),
			'burst_geo_ip_import_error'           => get_option( 'burst_geo_ip_import_error', '' ),
			'burst_tracking_status'               => get_option( 'burst_tracking_status', 'unknown' ),
			'burst_share_tokens'                  => ! empty( get_option( 'burst_share_tokens', [] ) ),
			'shared_links'                        => $this->get_share_links_count( 'link' ),
			'report_links'                        => $this->get_share_links_count( 'report' ),
			'burst_use_fallback_licensing_domain' => ! empty( get_transient( 'burst_use_fallback_licensing_domain' ) ),
			'burst_license_status'                => $license_status,
			'enable_mainwp_integration'           => $this->get_burst_setting_bool( 'enable_mainwp_integration' ),
			'enable_abilities_api'                => $this->get_burst_setting_bool( 'enable_abilities_api' ),
			'burst_headless_domain'               => defined( 'BURST_HEADLESS_DOMAIN' ),
		];
	}

	/**
	 * Check if a custom logo is configured
	 */
	private function has_custom_logo(): bool {
		return ! empty( $this->get_option( 'logo_attachment_id' ) );
	}

	/**
	 * Get the subscription tier
	 */
	private function get_subscription_tier(): string {
		return apply_filters( 'burst_data_sharing_subscription_tier', 'free' );
	}
}
