<?php
namespace Burst\Admin\Debug;

use Burst\Admin\Search_Console\Diagnostic_Logs;
use Burst\Admin\Search_Console\Sync;
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
	public function init(): void {
		add_filter( 'debug_information', [ $this, 'add_site_health_info' ] );
	}

	/**
	 * Add Burst debug info to Site Health → Info tab.
	 *
	 * @param array $info Existing debug info.
	 * @return array the updated info.
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

		$server_data = $this->sanitize_server_data( $_SERVER );

		$settings = get_option( 'burst_options_settings', [] );
		if ( ! is_array( $settings ) ) {
			$settings = [];
		}
		$settings = $this->format_array_as_string( $settings );
		unset( $settings['license'] );

		// WordPress burst options. Get all options that start with 'burst_'.
		$wp_options = $wpdb->get_results( $wpdb->prepare( "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( 'burst_' ) . '%' ), ARRAY_A );
		$wp_options = wp_list_pluck( $wp_options, 'option_value', 'option_name' );
		unset( $wp_options['burst_gsc_tokens'] );
		// Share-link tokens are stored in plaintext and grant statistics access
		// to anyone holding them; a pasted Site Health export must not leak them.
		unset( $wp_options['burst_share_tokens'] );
		$wp_options = $this->format_array_as_string( $wp_options );
		unset( $wp_options['burst_options_settings'] );

		// Burst transients.
		$burst_transients = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s",
				$wpdb->esc_like( '_transient_burst_' ) . '%'
			)
		);
		$burst_transients = wp_list_pluck( $burst_transients, 'option_value', 'option_name' );
		// Holds the in-flight PKCE code_verifier and single-use nonce while a
		// Search Console connect is pending; exporting it mid-flow leaks both.
		unset( $burst_transients['_transient_burst_gsc_connect'] );
		$burst_transients = $this->format_array_as_string( $burst_transients );

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
			'BURST_HEADLESS_DOMAIN'        => defined( 'BURST_HEADLESS_DOMAIN' ) ? BURST_HEADLESS_DOMAIN : 'undefined',
			'BURST_DONT_USE_SUMMARY_TABLE' => defined( 'BURST_DONT_USE_SUMMARY_TABLE' ) ? ( BURST_DONT_USE_SUMMARY_TABLE ? 'true' : 'false' ) : 'undefined',
		];

		$fields = [
			'geo_ip'              => [
				'label' => __( 'Geo IP File', 'burst-statistics' ),
				'value' => [ 'Premium' => 'Pro version required' ],

			],
			'detected_ip'         => [
				'label' => __( 'Detected Geo IP', 'burst-statistics' ),
				'value' => $ip,
			],
			'location_data'       => [
				'label' => __( 'Location Data', 'burst-statistics' ),
				'value' => [ 'Premium' => 'Pro version required' ],
			],
			'burst_tables'        => [
				'label' => __( 'Burst Database Tables', 'burst-statistics' ),
				'value' => $tables ?: 'No burst_ tables found',
			],
			'burst_settings'      => [
				'label' => __( 'Burst Settings', 'burst-statistics' ),
				'value' => $settings,
			],
			'burst_wp_options'    => [
				'label' => __( 'Burst WordPress options', 'burst-statistics' ),
				'value' => "available in 'Copy site info to clipboard'",
				'debug' => $wp_options,
			],
			'burst_wp_transients' => [
				'label' => __( 'Burst WordPress transients', 'burst-statistics' ),
				'value' => "available in 'Copy site info to clipboard'",
				'debug' => $burst_transients,
			],
			'server_data'         => [
				'label' => '$_SERVER',
				'value' => $server_data,
			],
			'burst_debug_log'     => [
				'label' => __( 'Debug Log', 'burst-statistics' ),
				'value' => $debug_log_lines,
			],
			'used_constants'      => [
				'label' => __( 'Used Constants', 'burst-statistics' ),
				'value' => $constants,
			],
		];

		$fields = array_merge( $fields, $this->get_search_console_fields() );

		$info['burst_debug'] = [
			'label'  => __( 'Burst Debug Information', 'burst-statistics' ),
			'fields' => apply_filters( 'burst_debug_fields', $fields ),
		];

		return $info;
	}

	/**
	 * Keep only explicitly approved diagnostic data before exposing $_SERVER in
	 * Site Health or its clipboard export. An allowlist prevents host-specific
	 * environment variables from disclosing credentials or infrastructure data.
	 *
	 * @param array $server_data Raw server data.
	 * @return array Safe server data.
	 */
	private function sanitize_server_data( array $server_data ): array {
		$allowed_keys = [
			'APP_ENGINE',
			'APP_ENGINE_VERSION',
			'ENVIRONMENT',
			'GATEWAY_INTERFACE',
			'GEOIP_CITY',
			'GEOIP_COUNTRY_CODE',
			'GEOIP_COUNTRY_NAME',
			'GEOIP_LATITUDE',
			'GEOIP_LONGITUDE',
			'GEOIP_REGION',
			'HTTPS',
			'REMOTE_ADDR',
			'REQUEST_SCHEME',
			'SERVER_PROTOCOL',
			'SERVER_SOFTWARE',
		];

		return array_intersect_key( $server_data, array_flip( $allowed_keys ) );
	}

	/**
	 * Add stored Search Console state and persistent activity to Site Health.
	 * This path performs no Google API calls and writes no diagnostic events.
	 *
	 * @return array Site Health fields.
	 */
	private function get_search_console_fields(): array {
		if ( ! $this->get_option_bool( 'enable_search_console' ) ) {
			return [
				'search_console' => [
					'label' => __( 'Google Search Console', 'burst-statistics' ),
					'value' => __( 'Disabled', 'burst-statistics' ),
				],
			];
		}

		$diagnostics = ( new Sync() )->diagnostics();
		$storage     = is_array( $diagnostics['storage'] ?? null ) ? $diagnostics['storage'] : [];
		$summary     = [
			__( 'Connection', 'burst-statistics' )         => (string) ( $diagnostics['status'] ?? '' ),
			__( 'Site', 'burst-statistics' )               => (string) ( $diagnostics['site_url'] ?? '' ),
			__( 'Site URL source', 'burst-statistics' )    => (string) ( $diagnostics['site_url_source'] ?? '' ),
			__( 'Property selection', 'burst-statistics' ) => (string) ( $diagnostics['property_status'] ?? '' ),
			__( 'Stored property', 'burst-statistics' )    => (string) ( $diagnostics['stored_property'] ?? '' ),
			__( 'Property scope', 'burst-statistics' )     => (string) ( $diagnostics['property_scope'] ?? '' ),
			__( 'Property retry', 'burst-statistics' )     => ! empty( $diagnostics['property_retry'] ) ? wp_date( DATE_ATOM, (int) $diagnostics['property_retry'] ) : __( 'Not scheduled', 'burst-statistics' ),
			__( 'Stored rows', 'burst-statistics' )        => isset( $storage['row_count'] ) ? (string) $storage['row_count'] : __( 'Not available', 'burst-statistics' ),
			__( 'Stored date range', 'burst-statistics' )  => ! empty( $storage['first_date'] ) ? $storage['first_date'] . ' – ' . $storage['last_date'] : __( 'No stored rows', 'burst-statistics' ),
			__( 'Sync state', 'burst-statistics' )         => $this->format_search_console_value( $diagnostics['sync_state'] ?? [] ),
			__( 'Next hourly sync', 'burst-statistics' )   => ! empty( $diagnostics['next_sync'] ) ? wp_date( DATE_ATOM, (int) $diagnostics['next_sync'] ) : __( 'Not scheduled', 'burst-statistics' ),
		];

		return [
			'search_console'          => [
				'label' => __( 'Google Search Console', 'burst-statistics' ),
				'value' => $summary,
			],
			'search_console_activity' => [
				'label' => __( 'Google Search Console Activity', 'burst-statistics' ),
				'value' => $this->format_search_console_activity( ( new Diagnostic_Logs() )->recent() ),
			],
		];
	}

	/**
	 * Format compact diagnostic metadata for Site Health's one-level field value
	 * format and its clipboard export.
	 *
	 * @param array $logs Stored diagnostic events.
	 * @return array<string, string> Timestamped event details.
	 */
	private function format_search_console_activity( array $logs ): array {
		if ( empty( $logs ) ) {
			return [ __( 'Activity', 'burst-statistics' ) => __( 'No Search Console activity has been recorded for this site yet.', 'burst-statistics' ) ];
		}

		$activity = [];
		foreach ( $logs as $log ) {
			$time    = isset( $log['time'] ) ? wp_date( DATE_ATOM, (int) $log['time'] ) : __( 'Unknown time', 'burst-statistics' );
			$event   = (string) ( $log['event'] ?? 'unknown' );
			$status  = (string) ( $log['status'] ?? 'info' );
			$message = (string) ( $log['message'] ?? '' );
			$context = $this->format_search_console_value( $log['context'] ?? [] );

			$activity[ $time . ' — ' . $event ] = sprintf(
				'%1$s: %2$s | %3$s',
				$status,
				$message,
				$context
			);
		}

		return $activity;
	}

	/**
	 * Format nested diagnostics as readable metadata rather than JSON payloads.
	 *
	 * @param mixed $value Diagnostic value.
	 */
	private function format_search_console_value( mixed $value ): string {
		if ( ! is_array( $value ) ) {
			return (string) $value;
		}

		$parts = [];
		$this->flatten_search_console_value( $value, $parts );
		return empty( $parts ) ? __( 'No details', 'burst-statistics' ) : implode( '; ', $parts );
	}

	/**
	 * Flatten diagnostic metadata for the native Site Health table.
	 *
	 * @param array<int|string, mixed> $value  Nested diagnostic value.
	 * @param array<int, string>       $parts  Formatted values.
	 * @param string                   $prefix Parent key.
	 */
	private function flatten_search_console_value( array $value, array &$parts, string $prefix = '' ): void {
		foreach ( $value as $key => $item ) {
			$name = '' === $prefix ? (string) $key : $prefix . '.' . $key;
			if ( is_array( $item ) ) {
				$this->flatten_search_console_value( $item, $parts, $name );
				continue;
			}
			$parts[] = $name . ': ' . ( is_bool( $item ) ? ( $item ? 'true' : 'false' ) : (string) $item );
		}
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
