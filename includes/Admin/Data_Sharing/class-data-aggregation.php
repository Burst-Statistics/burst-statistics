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
use Burst\Admin\Data_Sharing\Data_Collectors\Ai_Chat_Data;
use Burst\Traits\Helper;

/**
 * Class Data_Aggregation
 * Aggregates data from multiple collectors and formats it for API responses
 */
class Data_Aggregation {
	use Helper;

	private string $site_hash;
	private array $collectors    = [];
	private const CACHE_KEY      = 'burst_aggregated_data_v2';
	private const CACHE_DURATION = WEEK_IN_SECONDS;

	private int $capture_data_from;

	private int $capture_data_to;

	private bool $is_test;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to, bool $is_test = false ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
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
			'goals'         => new Goals_Data(),
			'environment'   => new Environment_Data(),
			'email_reports' => new Reports_Data( $this->capture_data_from ),
			'metrics'       => new Metrics_Data( $this->capture_data_from, $this->capture_data_to ),
			'ai_chat'       => new Ai_Chat_Data(),
		];
	}

	/**
	 * Get a fallback payload shape for a collector key.
	 */
	private function get_collector_fallback_data( string $key ): array {
		switch ( $key ) {
			case 'goals':
				return [
					'goals' => [],
				];

			case 'environment':
				return [
					'wordpress' => [
						'version'   => wp_get_wp_version(),
						'multisite' => is_multisite(),
					],
					'php'       => [
						'version' => (string) phpversion(),
					],
					'plugins'   => [
						'active_plugins' => [],
					],
				];

			case 'email_reports':
				return [
					'reports' => [],
					'logs'    => null,
				];

			case 'metrics':
				return [
					'aggregation_period' => [
						'start_date' => gmdate( 'Y-m-d', $this->capture_data_from ),
						'end_date'   => gmdate( 'Y-m-d', $this->capture_data_to ),
					],
					'traffic'            => [
						'visitors'    => 0,
						'pageviews'   => 0,
						'sessions'    => 0,
						'bounce_rate' => 0,
					],
					'ecommerce'          => null,
					'database'           => [
						'database_size' => 0,
						'table_count'   => 0,
					],
					'query_stats'        => [],
				];

			case 'ai_chat':
				return [
					'question_count' => 0,
					'questions'      => [],
				];

			case 'settings':
			default:
				return [];
		}
	}

	/**
	 * Normalize email report logs to either null or a strict metrics object.
	 *
	 * Mixed $logs: defensively accepts whatever the collected-data array holds at this key (could be a non-array on corrupt/legacy data); the is_array guard handles it.
	 */
	private function normalize_email_report_logs( mixed $logs ): ?array {
		if ( ! is_array( $logs ) || empty( $logs ) ) {
			return null;
		}

		$reports_sent = isset( $logs['reports_sent_last_month'] ) ? (int) $logs['reports_sent_last_month'] : 0;
		$successes    = isset( $logs['successful_sends'] ) ? (int) $logs['successful_sends'] : 0;
		$failures     = isset( $logs['failed_sends'] ) ? (int) $logs['failed_sends'] : 0;

		return [
			'reports_sent_last_month' => max( 0, $reports_sent ),
			'successful_sends'        => max( 0, $successes ),
			'failed_sends'            => max( 0, $failures ),
		];
	}

	/**
	 * Ensure required top-level v2 sections always exist.
	 */
	private function ensure_required_sections( array $collected_data ): array {
		$required_sections = [ 'settings', 'goals', 'environment', 'email_reports', 'metrics', 'ai_chat' ];

		foreach ( $required_sections as $section ) {
			if ( ! isset( $collected_data[ $section ] ) || ! is_array( $collected_data[ $section ] ) ) {
				$collected_data[ $section ] = $this->get_collector_fallback_data( $section );
			}
		}

		$collected_data['email_reports']['logs'] = $this->normalize_email_report_logs( $collected_data['email_reports']['logs'] ?? null );

		return $collected_data;
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
				$aggregated_data['data'][ $key ] = $this->get_collector_fallback_data( $key );

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

		$aggregated_data['data'] = $this->ensure_required_sections( $aggregated_data['data'] );

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
