<?php
namespace Burst\Admin\Debug;

use Burst\Frontend\Ip\Ip;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Debug {
	use Admin_Helper;
	use Helper;

	/**
	 * Initialize the debug class.
	 */
	public function init() {
		add_filter( 'debug_information', [ $this, 'add_site_health_info' ] );
	}

	/**
	 * Add Burst debug info to Site Health → Info tab.
	 *
	 * @param array $info Existing debug info.
	 * @return array
	 */
	public function add_site_health_info( array $info ): array {
		if ( ! $this->user_can_manage() ) {
			return $info;
		}

		global $wpdb;

		$ip     = Ip::get_ip_address();
		$tables = $wpdb->get_col(
			$wpdb->prepare(
				'SHOW TABLES LIKE %s',
				$wpdb->esc_like( $wpdb->prefix . 'burst_' ) . '%'
			)
		);

		$server_data = $_SERVER;
		$remove_keys = [
			'REDIRECT_STATUS',
			'DOCUMENT_ROOT',
			'DOCUMENT_URI',
			'PATH_TRANSLATED',
			'PATH_INFO',
			'SCRIPT_NAME',
			'SCRIPT_FILENAME',
			'CONTENT_LENGTH',
			'CONTENT_TYPE',
			'REQUEST_METHOD',
			'QUERY_STRING',
			'FCGI_ROLE',
			'PHP_SELF',
			'REQUEST_TIME_FLOAT',
			'REQUEST_TIME',
			'PATH',
			'GS_LIB',
			'MAGICK_CODER_MODULE_PATH',
			'USER',
			'HOME',
			'HTTP_COOKIE',
			'HTTP_ACCEPT_LANGUAGE',
			'HTTP_ACCEPT_ENCODING',
			'HTTP_REFERER',
			'HTTP_ACCEPT',
			'HTTP_USER_AGENT',
			'HTTP_UPGRADE_INSECURE_REQUESTS',
			'HTTP_CACHE_CONTROL',
			'HTTP_CONNECTION',
		];

		foreach ( $remove_keys as $key ) {
			if ( isset( $server_data[ $key ] ) ) {
				unset( $server_data[ $key ] );
			}
		}
		$settings = get_option( 'burst_options_settings', [] );
		if ( ! is_array( $settings ) ) {
			$settings = [];
		}
		$settings = $this->format_array_as_string( $settings );
		unset( $settings['license'] );

		// WordPress burst options. Get all options that start with 'burst_'.
		$sql        = $wpdb->prepare( "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( 'burst_' ) . '%' );
		$wp_options = $wpdb->get_results( $sql, ARRAY_A );
		$wp_options = wp_list_pluck( $wp_options, 'option_value', 'option_name' );
		$wp_options = $this->format_array_as_string( $wp_options );
		unset( $wp_options['burst_options_settings'] );

		$debug_log_lines = $this->get_burst_debug_log_lines();
		if ( empty( $debug_log_lines ) ) {
			$debug_log_lines = [ __( 'No debug log entries found.', 'burst-statistics' ) ];
		}

		$constants = [
			// @phpstan-ignore-next-line
			'WP_DEBUG'                     => defined( 'WP_DEBUG' ) ? ( WP_DEBUG ? 'true' : 'false' ) : 'undefined',
			'BURST_DEBUG'                  => defined( 'BURST_DEBUG' ) ? ( BURST_DEBUG ? 'true' : 'false' ) : 'undefined',
			'BURST_VERSION'                => defined( 'BURST_VERSION' ) ? BURST_VERSION : 'undefined',
			'BURST_PRO'                    => defined( 'BURST_PRO' ) ? BURST_PRO : 'undefined',
			'BURST_DO_NOT_UPDATE_GEO_IP'   => defined( 'BURST_DO_NOT_UPDATE_GEO_IP' ) ? ( BURST_DO_NOT_UPDATE_GEO_IP ? 'true' : 'false' ) : 'undefined',
			'BURST_HEADLESS'               => defined( 'BURST_HEADLESS' ) ? ( BURST_HEADLESS ? 'true' : 'false' ) : 'undefined',
			'BURST_DONT_USE_SUMMARY_TABLE' => defined( 'BURST_DONT_USE_SUMMARY_TABLE' ) ? ( BURST_DONT_USE_SUMMARY_TABLE ? 'true' : 'false' ) : 'undefined',
		];

		$fields = [
			'geo_ip'           => [
				'label' => __( 'Geo IP File', 'burst-statistics' ),
				'value' => [ 'Premium' => 'Pro version required' ],

			],
			'detected_ip'      => [
				'label' => __( 'Detected Geo IP', 'burst-statistics' ),
				'value' => $ip,
			],
			'location_data'    => [
				'label' => __( 'Location Data', 'burst-statistics' ),
				'value' => [ 'Premium' => 'Pro version required' ],
			],
			'burst_tables'     => [
				'label' => __( 'Burst Database Tables', 'burst-statistics' ),
				'value' => $tables ?: 'No burst_ tables found',
			],
			'burst_settings'   => [
				'label' => __( 'Burst Settings', 'burst-statistics' ),
				'value' => $settings,
			],
			'burst_wp_options' => [
				'label' => __( 'Burst WordPress options', 'burst-statistics' ),
				'value' => "available in 'Copy site info to clipboard'",
				'debug' => $wp_options,
			],
			'server_data'      => [
				'label' => '$_SERVER',
				'value' => $server_data,
			],
			'burst_debug_log'  => [
				'label' => __( 'Debug Log', 'burst-statistics' ),
				'value' => $debug_log_lines,
			],
			'used_constants'   => [
				'label' => __( 'Used Constants', 'burst-statistics' ),
				'value' => $constants,
			],
		];

		$info['burst_debug'] = [
			'label'  => __( 'Burst Debug Information', 'burst-statistics' ),
			'fields' => apply_filters( 'burst_debug_fields', $fields ),
		];

		return $info;
	}

	/**
	 * Format an array as a string for display.
	 */
	private function format_array_as_string( array $data ): array {
		foreach ( $data as $key => $value ) {
			if ( is_array( $value ) ) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_print_r
				$data[ $key ] = print_r( $value, true );
			} else {
				$data[ $key ] = (string) $value;
			}
		}
		return $data;
	}

	/**
	 * Get last 50 lines from debug.log that start with "Burst".
	 *
	 * @return array<string> Lines from log file, or empty array if none.
	 */
	private function get_burst_debug_log_lines(): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		global $wp_filesystem;

		// initialize WP_Filesystem if not loaded.
		if ( ! $wp_filesystem ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}

		$log_file = WP_CONTENT_DIR . '/debug.log';

		// check if file exists and is readable.
		if ( ! $wp_filesystem->exists( $log_file ) || ! $wp_filesystem->is_readable( $log_file ) ) {
			return [];
		}

		// skip if log is too big (> 10MB).
		if ( $wp_filesystem->size( $log_file ) > 10 * 1024 * 1024 ) {
			return [];
		}

		$content = $wp_filesystem->get_contents( $log_file );
		if ( $content === false ) {
			return [];
		}

		$lines       = [];
		$all_lines   = array_reverse( explode( "\n", $content ) );
		$total_lines = 0;

		foreach ( $all_lines as $line ) {
			++$total_lines;

			if ( stripos( $line, 'burst' ) !== false ) {
				$lines[] = $line;
				if ( count( $lines ) >= 50 ) {
					break;
				}
			}

			// limit scanning to 500 lines from the end.
			if ( $total_lines >= 500 ) {
				break;
			}
		}

		return array_reverse( $lines );
	}
}
