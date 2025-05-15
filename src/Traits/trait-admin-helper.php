<?php

namespace Burst\Traits;

use Burst\Frontend\Ip\Ip;

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
	 * Get possible date ranges for the date picker.
	 *
	 * @return array<int, string> List of available date range keys.
	 */
	public function get_date_ranges(): array {
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
	 * Check if user has Burst view permissions
	 *
	 * @return boolean true or false
	 */
	public function user_can_view(): bool {
		if ( isset( \Burst\burst_loader()->user_can_view ) ) {
			return \Burst\burst_loader()->user_can_view;
		}

		if ( ! is_user_logged_in() ) {
			\Burst\burst_loader()->user_can_view = false;
			return false;
		}
		if ( ! current_user_can( 'view_burst_statistics' ) ) {
			\Burst\burst_loader()->user_can_view = false;
			return false;
		}

		\Burst\burst_loader()->user_can_view = true;
		return true;
	}

	/**
	 * Verify if this is an authenticated rest request for Burst
	 */
	public function is_logged_in_rest(): bool {
		if ( isset( \Burst\burst_loader()->is_logged_in_rest ) ) {
			return \Burst\burst_loader()->is_logged_in_rest;
		}

		\Burst\burst_loader()->is_logged_in_rest = burst_is_logged_in_rest();
		return \Burst\burst_loader()->is_logged_in_rest;
	}

	/**
	 * Check if user has Burst manage permissions
	 *
	 * @return boolean true or false
	 */
	public function user_can_manage(): bool {
		if ( isset( \Burst\burst_loader()->user_can_manage ) ) {
			return \Burst\burst_loader()->user_can_manage;
		}

		if ( (bool) get_option( 'burst_run_activation' ) ) {
			\Burst\burst_loader()->user_can_manage = true;
			return true;
		}

		$is_wpli = ( defined( 'WP_CLI' ) && WP_CLI );
		if ( wp_doing_cron() || $is_wpli ) {
			\Burst\burst_loader()->user_can_manage = true;
			return true;
		}

		if ( ! is_user_logged_in() ) {
			\Burst\burst_loader()->user_can_manage = false;
			return false;
		}

		if ( ! current_user_can( 'manage_burst_statistics' ) ) {
			\Burst\burst_loader()->user_can_manage = false;
			return false;
		}

		\Burst\burst_loader()->user_can_manage = true;
		return true;
	}

	/**
	 * Create a website URL with optional parameters.
	 *               Example usage:
	 *               burst_content=page-analytics -> specifies that the user is interacting with the page analytics feature.
	 *               burst_source=download-button -> indicates that the click originated from the download button.
	 */
	public function get_website_url( string $url = '/', array $params = [] ): string {
		$version    = defined( 'BURST_PRO' ) ? 'pro' : 'free';
		$version_nr = defined( 'BURST_VERSION' ) ? BURST_VERSION : '0';

		// strip debug time from version nr.
		$version_nr     = explode( '#', $version_nr );
		$version_nr     = $version_nr[0];
		$default_params = [
			'burst_campaign' => 'burst-' . $version . '-' . $version_nr,
		];

		$params = wp_parse_args( $params, $default_params );
		// remove slash prepending the $url.
		$url = ltrim( $url, '/' );

		return add_query_arg( $params, 'https://burst-statistics.com/' . trailingslashit( $url ) );
	}

	/**
	 * Checks if the user has admin access to the Burst plugin.
	 */
	public function has_admin_access(): bool {
		if ( isset( \Burst\burst_loader()->has_admin_access ) ) {
			return \Burst\burst_loader()->has_admin_access;
		}

		// during activation, we need to allow access.
		if ( get_option( 'burst_run_activation' ) ) {
			\Burst\burst_loader()->has_admin_access = true;
			return \Burst\burst_loader()->has_admin_access;
		}

		\Burst\burst_loader()->has_admin_access =
			( is_admin() && current_user_can( 'view_burst_statistics' ) )
			|| burst_is_logged_in_rest()
			|| wp_doing_cron()
			|| ( defined( 'WP_CLI' ) && WP_CLI );
		return \Burst\burst_loader()->has_admin_access;
	}
	/**
	 * Prepare localized settings data to expose to JavaScript.
	 *
	 * @param array $js_data Array of loaded translations.
	 * @return array{
	 *     json_translations: list<array<string, mixed>>,
	 *     site_url: string,
	 *     admin_ajax_url: string,
	 *     dashboard_url: string,
	 *     plugin_url: string,
	 *     network_link: string,
	 *     is_pro: bool,
	 *     nonce: string,
	 *     burst_nonce: string,
	 *     current_ip: string,
	 *     user_roles: array<string, string>,
	 *     date_ranges: array<int, string>,
	 *     date_format: string,
	 *     tour_shown: mixed,
	 *     gmt_offset: mixed,
	 *     goals_information_shown: int,
	 *     burst_version: string,
	 *     burst_pro: bool
	 * }
	 */
	public function localized_settings( array $js_data ): array {
		return apply_filters(
			'burst_localize_script',
			[
				'json_translations' => $js_data['json_translations'],
				'site_url'          => get_rest_url(),
				'admin_ajax_url'    => add_query_arg( [ 'action' => 'burst_rest_api_fallback' ], admin_url( 'admin-ajax.php' ) ),
				'dashboard_url'     => $this->admin_url( 'burst' ),
				'plugin_url'        => BURST_URL,
				'network_link'      => network_site_url( 'plugins.php' ),
				'is_pro'            => defined( 'BURST_PRO' ),
				// to authenticate the logged in user.
				'nonce'             => wp_create_nonce( 'wp_rest' ),
				'burst_nonce'       => wp_create_nonce( 'burst_nonce' ),
				'current_ip'        => Ip::get_ip_address(),
				'user_roles'        => $this->get_user_roles(),
				'date_ranges'       => $this->get_date_ranges(),
				'date_format'       => get_option( 'date_format' ),
				'tour_shown'        => $this->get_option_int( 'burst_tour_shown_once' ),
				'gmt_offset'        => get_option( 'gmt_offset' ),
				'burst_version'     => BURST_VERSION,
				'burst_pro'         => defined( 'BURST_PRO' ),
			]
		);
	}

	/**
	 * Get admin url, adjusted for multisite
	 */
	public function admin_url( string $page = '' ): string {
		if ( isset( \Burst\burst_loader()->admin_url ) ) {
			$url = \Burst\burst_loader()->admin_url;
		} else {
			$url                             = is_multisite() && is_network_admin() ? network_admin_url( 'admin.php' ) : admin_url( 'admin.php' );
			\Burst\burst_loader()->admin_url = $url;
		}

		if ( ! empty( $page ) ) {
			$url = add_query_arg( 'page', $page, $url );
		}
		return $url;
	}

	/**
	 * Add some additional sanitizing
	 * https://developer.wordpress.org/news/2023/08/understand-and-use-wordpress-nonces-properly/#verifying-the-nonce
	 */
	public function verify_nonce( string $nonce, string $action ): bool {
		return wp_verify_nonce( sanitize_text_field( wp_unslash( $nonce ) ), $action );
	}

	/**
	 * We use this custom sprintf for outputting translatable strings. This function only works with %s
	 * This function wraps the sprintf and will prevent fatal errors.
	 */
	public function sprintf(): string {
		$args             = func_get_args();
		$count            = substr_count( $args[0], '%s' );
		$count_percentage = substr_count( $args[0], '%' );
		$args_count       = count( $args ) - 1;

		if ( $count_percentage === $count ) {
			if ( $args_count === $count ) {
				return call_user_func_array( 'sprintf', $args );
			}
		}

		return $args[0] . ' (Translation error)';
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
	public function get_chunk_translations( string $dir ): array {
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

	/**
	 * Get user roles for the settings page in Burst.
	 *
	 * @return array<string, string> Associative array of role slugs and their translated names.
	 */
	public function get_user_roles(): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		global $wp_roles;

		return $wp_roles->get_names();
	}

	/**
	 * Custom printf function to prevent errors when translators make a mistake in the %s items
	 *
	 * @echo string
	 */
	public function printf(): void {
		$args       = func_get_args();
		$count      = substr_count( $args[0], '%s' );
		$args_count = count( $args ) - 1;

		if ( $args_count === $count ) {
			$string = call_user_func_array( 'sprintf', $args );
			echo wp_kses_post( $string );
		} else {
			echo wp_kses_post( $args[0] ) . ' (Translation error)';
		}
	}
}
