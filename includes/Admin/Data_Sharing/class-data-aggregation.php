<?php

namespace Burst\Admin\Data_Sharing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Data_Sharing\Data_Collectors\Data_Collector;
use Burst\Admin\Data_Sharing\Data_Collectors\Metrics_Data;
use Burst\Admin\Data_Sharing\Data_Collectors\Reports_Data;
use Burst\Admin\Data_Sharing\Data_Collectors\Settings_Data;
use Burst\Admin\Data_Sharing\Data_Collectors\Goals_Data;
use Burst\Admin\Data_Sharing\Data_Collectors\Environment_Data;
use Burst\Traits\Helper;

/**
 * Class Data_Aggregation
 * Aggregates data from multiple collectors and formats it for API responses
 */
class Data_Aggregation {
	use Helper;

	private string $site_hash;
	private array $collectors    = [];
	private const CACHE_KEY      = 'burst_aggregated_data';
	private const CACHE_DURATION = WEEK_IN_SECONDS;

	private int $capture_data_from;

	private int $capture_data_to;

	private bool $first_send;

	private bool $is_test;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to, bool $first_send, bool $is_test = false ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
		$this->first_send        = $first_send;
		$this->is_test           = $is_test;
		$this->site_hash         = $this->generate_site_hash();

		$this->register_collectors();
	}

	/**
	 * Register all data collectors
	 */
	private function register_collectors(): void {
		$this->collectors = [
			'settings'      => new Settings_Data(),
			// For goals, if it's the first send, capture all historical data. -1 will remove date_start filter.
			'goals'         => new Goals_Data( $this->first_send ? -1 : $this->capture_data_from, $this->capture_data_to ),
			'environment'   => new Environment_Data(),
			'email_reports' => new Reports_Data( $this->capture_data_from ),
			'metrics'       => new Metrics_Data( $this->capture_data_from, $this->capture_data_to ),
		];
	}

	/**
	 * Generate a unique hash for this site
	 */
	private function generate_site_hash(): string {
		$site_url = get_site_url();
		$salt     = defined( 'AUTH_KEY' ) ? AUTH_KEY : 'burst_default_salt';

		return hash( 'sha256', $site_url . $salt );
	}

	/**
	 * Collect data from all registered collectors
	 *
	 * @param bool $use_cache Whether to use cached data.
	 * @throws \Exception If a collector fails to collect data.
	 */
	public function collect_all_data( bool $use_cache = true ): array {
		if ( $use_cache ) {
			$cached_data = get_transient( self::CACHE_KEY );
			if ( false !== $cached_data ) {
				return $cached_data;
			}
		}

		$aggregated_data = [
			'data'   => [],
			'errors' => [],
		];

		foreach ( $this->collectors as $key => $collector ) {
			try {
				if ( ! $collector instanceof Data_Collector ) {
					throw new \Exception( "Collector {$key} does not implement Data_Collectors" );
				}

				$aggregated_data['data'][ $key ] = $collector->collect_data();
			} catch ( \Exception $e ) {
				$aggregated_data['errors'][ $key ] = [
					'message' => $e->getMessage(),
					'code'    => $e->getCode(),
				];

				self::error_log(
					sprintf(
						'Burst Data Aggregation Error [%s]: %s',
						$key,
						$e->getMessage()
					)
				);
			}
		}

		set_transient( self::CACHE_KEY, $aggregated_data, self::CACHE_DURATION );

		return $aggregated_data;
	}

	/**
	 * Get API response formatted data
	 *
	 * @param bool $use_cache Whether to use cached data.
	 * @throws \Exception If data collection fails.
	 */
	public function get_api_response( bool $use_cache = true ): array {
		$data = $this->collect_all_data( $use_cache );

		$has_errors = ! empty( $data['errors'] );

		if ( $has_errors ) {
			return [
				'success' => false,
				'data'    => null,
				'errors'  => $data['errors'],
				'meta'    => [
					'version'      => defined( 'BURST_VERSION' ) ? BURST_VERSION : '1.0.0',
					'wp_version'   => get_bloginfo( 'version' ),
					'collected_at' => gmdate( 'Y-m-d H:i:s', $data['timestamp'] ?? time() ),
				],
			];
		}

		$final_data              = [];
		$final_data['site_hash'] = $this->get_site_hash();
		$final_data['is_test']   = $this->is_test;

		return array_merge( $final_data, $data['data'] );
	}

	/**
	 * Send data to remote API endpoint
	 *
	 * @param string $api_url The API endpoint URL.
	 * @param array  $args    Additional arguments for wp_remote_post.
	 * @param bool   $return_response Whether to return the HTTP response. Default false for backward compatibility.
	 * @return array|null|\WP_Error Returns the HTTP response array if $return_response is true, null otherwise.
	 * @throws \Exception If data collection fails.
	 */
	public function send_to_api( string $api_url, array $args = [], bool $return_response = false ): array|\WP_Error|null {
		$use_cache = false;

		if ( wp_get_environment_type() === 'production' ) {
			$use_cache = true;
		}

		$response_data = $this->get_api_response( $use_cache );

		if ( isset( $response_data['success'] ) && ! $response_data['success'] ) {
			// TODO: Handle errors appropriately.
			if ( $return_response ) {
				return [
					'success' => false,
					'message' => 'Failed to collect data',
					'errors'  => $response_data['errors'] ?? [],
				];
			}
			return null;
		}

		$default_args = [
			'method'   => 'POST',
			'blocking' => true,
			'headers'  => [
				'Content-Type'           => 'application/json',
				'Accept'                 => 'application/json',
				'HTTP_X_BURST_SIGNATURE' => BURST_PUBLIC_KEY,
			],
			'body'     => wp_json_encode( $response_data ),
			'cookies'  => [],
		];

		$args = wp_parse_args( $args, $default_args );

		$response = wp_remote_post( $api_url, $args );

		// Check for response errors and log if it contains "invalid payload structure".
		if ( ! is_wp_error( $response ) ) {
			$body = wp_remote_retrieve_body( $response );
			if ( ! empty( $body ) && str_contains( strtolower( $body ), 'invalid payload structure' ) ) {
				self::error_log(
					sprintf(
						'Burst Telemetry API Error: %s',
						$body
					)
				);
			}
		}

		if ( $return_response ) {
			return $response;
		}

		return null;
	}

	/**
	 * Clear cached aggregated data
	 */
	public function clear_cache(): bool {
		return delete_transient( self::CACHE_KEY );
	}

	/**
	 * Get the site hash
	 */
	public function get_site_hash(): string {
		return $this->site_hash;
	}
}
