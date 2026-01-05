<?php

namespace Burst\Traits;

use Burst\Frontend\Ip\Ip;

use Burst\Pro\Admin\Share\Share;
use function Burst\burst_loader;
use function burst_is_logged_in_rest;
use function burst_get_option;
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trait admin helper
 *
 * @since   3.0
 */
trait Admin_Helper {
	use Helper;


	/**
	 * Check if user has Burst view permissions
	 *
	 * @return boolean true or false
	 */
	protected function user_can_view(): bool {
		if ( isset( burst_loader()->user_can_view ) ) {
			return burst_loader()->user_can_view;
		}

		if ( ! is_user_logged_in() ) {
			return burst_loader()->user_can_view = false;
		}

		if ( ! current_user_can( 'view_burst_statistics' ) ) {
			return burst_loader()->user_can_view = false;
		}

		return burst_loader()->user_can_view = true;
	}

	/**
	 * Check if user has Burst view permissions
	 *
	 * @return boolean true or false
	 */
	protected function user_can_view_sales(): bool {
		if ( isset( burst_loader()->user_can_view_sales ) ) {
			return burst_loader()->user_can_view_sales;
		}

		if ( ! is_user_logged_in() ) {
			return burst_loader()->user_can_view_sales = false;
		}

		if ( ! current_user_can( 'view_sales_burst_statistics' ) ) {
			return burst_loader()->user_can_view_sales = false;
		}

		return burst_loader()->user_can_view_sales = true;
	}

	/**
	 * Verify if this is an authenticated rest request for Burst
	 */
	protected function is_logged_in_rest(): bool {
		if ( isset( burst_loader()->is_logged_in_rest ) ) {
			return burst_loader()->is_logged_in_rest;
		}

		burst_loader()->is_logged_in_rest = burst_is_logged_in_rest();
		return burst_loader()->is_logged_in_rest;
	}

	/**
	 * Check if we're on the Burst page
	 */
	protected function is_burst_page(): bool {
		if ( $this->is_logged_in_rest() ) {
			return true;
		}

		if ( ! isset( $_SERVER['QUERY_STRING'] ) ) {
			return false;
		}

		parse_str( sanitize_text_field( wp_unslash( $_SERVER['QUERY_STRING'] ) ), $params );
		if ( array_key_exists( 'page', $params ) && ( $params['page'] === 'burst' ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Create a website URL with optional parameters.
	 *               Example usage:
	 *               utm_content=page-analytics -> specifies that the user is interacting with the page analytics feature.
	 *               utm_source=download-button -> indicates that the click originated from the download button.
	 */
	protected function get_website_url( string $url = '/', array $params = [] ): string {
		$version    = defined( 'BURST_PRO' ) ? 'pro' : 'free';
		$version_nr = defined( 'BURST_VERSION' ) ? BURST_VERSION : '0';

		// strip debug time from version nr.
		$default_params = [
			'utm_campaign' => 'burst-' . $version . '-' . $version_nr,
		];

		$params              = wp_parse_args( $params, $default_params );
		$plugin_installed_by = get_option( 'teamupdraft_installation_source_burst-statistics', '' );
		if ( ! empty( $plugin_installed_by ) ) {
			$params['utm_source'] = 'onboarding-' . $plugin_installed_by;
		}

		// remove slash prepending the $url.
		$url = ltrim( $url, '/' );

		return add_query_arg( $params, 'https://burst-statistics.com/' . trailingslashit( $url ) );
	}

	/**
	 * Validate a share token
	 */
	public function validate_share_token( string $token ): bool {
		if ( ! preg_match( '/^[a-f0-9]{32}$/i', $token ) ) {
			return false;
		}

		$existing_tokens = get_option( 'burst_share_tokens', [] );
		$valid           = false;
		$current_time    = time();
		foreach ( $existing_tokens as $key => $token_data ) {
			if ( $token_data['expires'] < $current_time ) {
				// Token expired, remove it.
				unset( $existing_tokens[ $key ] );
				continue;
			}
			if ( $token_data['token'] === $token ) {
				$valid = true;
				break;
			}
		}
		$request_count = (int) get_transient( "burst_shared_link_request_count_$token" );
		++$request_count;
		set_transient( "burst_shared_link_request_count_$token", $request_count, MINUTE_IN_SECONDS );

		if ( $request_count > apply_filters( 'burst_max_shared_link_requests', 100 ) ) {
			// Exceeded max requests for this shared link.
			self::error_log( "Shared link token $token has exceeded max requests: $request_count" );
			return false;
		}

		// Update the option to remove expired tokens.
		update_option( 'burst_share_tokens', $existing_tokens );
		return $valid;
	}

	/**
	 * Checks if the user has admin access to the Burst plugin.
	 */
	protected function has_admin_access(): bool {
		if ( isset( burst_loader()->has_admin_access ) ) {
			return burst_loader()->has_admin_access;
		}

		// Cheap fast-paths that don't require user/caps.
		if ( wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) || burst_is_logged_in_rest() ) {
			return burst_loader()->has_admin_access = true;
		}

		// during activation, we need to load some additional files.
		if ( get_option( 'burst_run_activation' ) ) {
			return burst_loader()->has_admin_access = true;
		}

		// the share token is a nonce in itself with an expiry.
        // phpcs:ignore
		if ( isset( $_GET['burst_share_token'] ) && $this->validate_share_token( wp_unslash( $_GET['burst_share_token'] ) ) ) {
			return burst_loader()->has_admin_access = true;
		}

		// Only check caps in admin; avoids loading user on frontend.
		if ( is_admin() ) {
			// Avoids double calls; still loads user once if needed.
			if ( is_user_logged_in() && current_user_can( 'view_burst_statistics' ) ) {
				return burst_loader()->has_admin_access = true;
			}
		}

		return burst_loader()->has_admin_access = false;
	}

	/**
	 * Check if the current user has the 'burst_viewer' role.
	 */
	private static function is_shareable_link_viewer(): bool {
		if ( isset( burst_loader()->is_shareable_link_viewer ) ) {
			return burst_loader()->is_shareable_link_viewer;
		}
		$user = wp_get_current_user();
		return burst_loader()->is_shareable_link_viewer = in_array( 'burst_viewer', (array) $user->roles, true );
	}

	/**
	 * Get share link permissions
	 *
	 * @return array <string, bool> Associative array of share link permissions.
	 */
	private static function get_share_link_permissions(): array {
		// if the current user is NOT a shareable link viewer, it is a normal user with full permissions.
		$is_shareable_link_viewer = self::is_shareable_link_viewer();
		return apply_filters(
			'burst_share_link_permissions',
			[
				'can_change_date'          => ! $is_shareable_link_viewer,
				'can_filter'               => ! $is_shareable_link_viewer,
				'is_shareable_link_viewer' => $is_shareable_link_viewer,
			]
		);
	}

	/**
	 * Prepare localized settings data to expose to JavaScript.
	 *
	 * @param array $js_data Array of loaded translations.
	 * @return array{
	 *     burst_version: string,
	 *     is_pro: bool,
	 *     plugin_url: string,
	 *     installed_by: string,
	 *     site_url: string,
	 *     admin_ajax_url: string,
	 *     dashboard_url: string,
	 *     network_link: string,
	 *     nonce: string,
	 *     burst_nonce: string,
	 *     current_ip: string,
	 *     user_roles: array<string, string>,
	 *     view_sales_burst_statistics: bool,
	 *     manage_burst_statistics: bool,
	 *     can_install_plugins: bool,
	 *     is_shareable_link_viewer: bool,
	 *     json_translations: list<array<string, mixed>>,
	 *     date_format: string,
	 *     gmt_offset: float|int|string,
	 *     date_ranges: array<int, string>,
	 *     tour_shown: int
	 * }
	 */
	protected function localized_settings( array $js_data ): array {
		$user_can_install = current_user_can( 'install_plugins' );
		return apply_filters(
			'burst_localize_script',
			[
				// Core plugin information.
				'burst_version'               => BURST_VERSION,
				'is_pro'                      => defined( 'BURST_PRO' ),
				'plugin_url'                  => BURST_URL,
				'installed_by'                => get_option( 'teamupdraft_installation_source_burst-statistics', '' ),

				// URLs and endpoints.
				'site_url'                    => get_rest_url(),
				'admin_ajax_url'              => add_query_arg( [ 'action' => 'burst_rest_api_fallback' ], admin_url( 'admin-ajax.php' ) ),
				'dashboard_url'               => $this->admin_url( 'burst' ),
				'network_link'                => network_site_url( 'plugins.php' ),

				// Security and authentication.
				'nonce'                       => wp_create_nonce( 'wp_rest' ),
				'burst_nonce'                 => wp_create_nonce( 'burst_nonce' ),
				'current_ip'                  => Ip::get_ip_address(),

				// User permissions and capabilities.
				'user_roles'                  => $this->get_user_roles(),
				'view_sales_burst_statistics' => $this->user_can_view_sales(),
				'manage_burst_statistics'     => $this->user_can_manage(),
				'can_install_plugins'         => $user_can_install,
				'share_link_permissions'      => self::get_share_link_permissions(),

				// Localization and internationalization.
				'json_translations'           => $js_data['json_translations'],
				'date_format'                 => get_option( 'date_format' ),
				'gmt_offset'                  => get_option( 'gmt_offset' ),

				// Configuration and options.
				'date_ranges'                 => $this->get_date_ranges(),
				'tour_shown'                  => $this->get_option_int( 'burst_tour_shown_once' ),

			]
		);
	}

	/**
	 * Get admin url. We don't use a different URL for multisite, as there is no network settings page.
	 */
	protected function admin_url( string $page = '' ): string {
		if ( isset( burst_loader()->admin_url ) ) {
			$url = burst_loader()->admin_url;
		} else {
			$url                      = admin_url( 'admin.php' );
			burst_loader()->admin_url = $url;
		}

		if ( ! empty( $page ) ) {
			$url = add_query_arg( 'page', $page, $url );
		}
		return $url;
	}

	/**
	 * Get user roles for the settings page in Burst.
	 *
	 * @return array<string, string> Associative array of role slugs and their translated names.
	 */
	protected function get_user_roles(): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		global $wp_roles;

		return $wp_roles->get_names();
	}

	/**
	 * Check if user has Burst manage permissions
	 *
	 * @return boolean true or false
	 */
	protected function user_can_manage(): bool {
		// Check if we already have a cached result.
		if ( isset( burst_loader()->user_can_manage ) ) {
			return burst_loader()->user_can_manage;
		}

		// During activation, allow access.
		if ( (bool) get_option( 'burst_run_activation' ) ) {
			burst_loader()->user_can_manage = true;
			return true;
		}

		// Allow access during cron jobs and WP-CLI.
		$is_wpli = ( defined( 'WP_CLI' ) && WP_CLI );
		if ( wp_doing_cron() || $is_wpli ) {
			burst_loader()->user_can_manage = true;
			return true;
		}

		// Check if user is logged in.
		if ( ! is_user_logged_in() ) {
			burst_loader()->user_can_manage = false;
			return false;
		}

		// Check if user has the required capability.
		if ( ! current_user_can( 'manage_burst_statistics' ) ) {
			burst_loader()->user_can_manage = false;
			return false;
		}

		burst_loader()->user_can_manage = true;
		return true;
	}

	/**
	 * Get possible date ranges for the date picker.
	 *
	 * @return array<int, string> List of available date range keys.
	 */
	protected function get_date_ranges(): array {
		return apply_filters(
			'burst_date_ranges',
			[
				'today',
				'yesterday',
				'last-7-days',
				'last-30-days',
				'last-90-days',
				'last-month',
				'last-year',
				'week-to-date',
				'month-to-date',
				'year-to-date',
			]
		);
	}

	/**
	 * Add some additional sanitizing
	 * https://developer.wordpress.org/news/2023/08/understand-and-use-wordpress-nonces-properly/#verifying-the-nonce
	 */
	protected function verify_nonce( ?string $nonce, string $action ): bool {
		if ( empty( $nonce ) ) {
			return false;
		}
		$valid = wp_verify_nonce( sanitize_text_field( wp_unslash( $nonce ) ), $action );
		return apply_filters( 'burst_verify_nonce', wp_verify_nonce( sanitize_text_field( wp_unslash( $nonce ) ), $action ), $nonce, $action );
	}

	/**
	 * We use this custom sprintf for outputting translatable strings. This function only works with %s
	 * This function wraps the sprintf and will prevent fatal errors.
	 */
	protected function sprintf(): string {
		$args   = func_get_args();
		$format = $args[0];
		$passed = array_slice( $args, 1 );

		// Find all numbered placeholders (%1$s, %2$d, etc).
		preg_match_all( '/%(\d+)\$/', $format, $matches );

		if ( ! empty( $matches[1] ) ) {
			$max_index    = max( $matches[1] );
			$passed_count = count( $passed );

			// If we have enough args for the highest placeholder index, run sprintf.
			if ( $passed_count >= $max_index ) {
				return sprintf( ...$args );
			}

			return $format . ' (Translation error)';
		}

		// Fallback for old-style %s %d etc.
		$expected = preg_match_all( '/%(?!%)[a-zA-Z]/', $format );
		if ( $expected === count( $passed ) ) {
			return sprintf( ...$args );
		}

		return $format . ' (Translation error)';
	}

	/**
	 * WordPress doesn't allow for translation of chunks resulting of code splitting.
	 * Several workarounds have popped up in JetPack and WooCommerce: https://developer.wordpress.com/2022/01/06/wordpress-plugin-i18n-webpack-and-composer/
	 * Below is mainly based on the WooCommerce solution, which seems to be the most simple approach. Simplicity is king here.
	 *
	 * @param string $dir Directory path relative to BURST_PATH.
	 * @return array{
	 *     json_translations: mixed,
	 *     js_file: string,
	 *     dependencies: list<string>,
	 *     version: string
	 * }
	 */
	protected function get_chunk_translations( string $dir ): array {
		$default           = [
			'json_translations' => [],
			'js_file'           => '',
			'dependencies'      => [],
			'version'           => '',
		];
		$text_domain       = 'burst-statistics';
		$languages_dir     = defined( 'BURST_PRO' ) ? BURST_PATH . 'languages' : WP_CONTENT_DIR . '/languages/plugins';
		$json_translations = [];
		$locale            = determine_locale();
		$languages         = [];

		if ( is_dir( $languages_dir ) ) {
			// Get all JSON files matching text domain & locale.
			foreach ( glob( "$languages_dir/{$text_domain}-{$locale}-*.json" ) as $language_file ) {
				$languages[] = basename( $language_file );
			}
		}

		foreach ( $languages as $src ) {
			$hash = str_replace( [ $text_domain . '-', $locale . '-', '.json' ], '', $src );
			wp_register_script( $hash, plugins_url( $src, __FILE__ ), [], true, true );
			$locale_data = load_script_textdomain( $hash, $text_domain, $languages_dir );
			wp_deregister_script( $hash );

			if ( ! empty( $locale_data ) ) {
				$json_translations[] = $locale_data;
			}
		}
		$js_files       = glob( BURST_PATH . $dir . '/index*.js' );
		$asset_files    = glob( BURST_PATH . $dir . '/index*.asset.php' );
		$js_filename    = ! empty( $js_files ) ? basename( $js_files[0] ) : '';
		$asset_filename = ! empty( $asset_files ) ? basename( $asset_files[0] ) : '';
		if ( ! file_exists( BURST_PATH . $dir . '/' . $asset_filename ) ) {
			return $default;
		}
		$asset_file = require BURST_PATH . $dir . '/' . $asset_filename;

		if ( empty( $js_filename ) ) {
			return $default;
		}

		return [
			'json_translations' => $json_translations,
			'js_file'           => $js_filename,
			'dependencies'      => $asset_file['dependencies'],
			'version'           => $asset_file['version'],
		];
	}
}
