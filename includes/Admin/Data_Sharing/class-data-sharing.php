<?php

namespace Burst\Admin\Data_Sharing;

use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Data_Sharing
 *
 * Manages anonymous data collection scheduling and execution
 */
class Data_Sharing {
	use Helper;

	/**
	 * The option name for storing the random offset
	 */
	const OFFSET_OPTION = 'burst_telemetry_offset';

	/**
	 * The cron hook name for the actual data send
	 */
	const CRON_HOOK = 'burst_telemetry_send';

	/**
	 * The kill switch URL
	 */
	const KILL_SWITCH_URL = 'https://burst.ams3.cdn.digitaloceanspaces.com/feedback/switch.txt';

	private int $current_send_time;

	private int $capture_data_from;

	private int $last_send;

	private bool $first_send;

	/**
	 * Get API URL for data sharing
	 */
	private function get_api_url(): string {
		if ( wp_get_environment_type() === 'production' ) {
			return 'https://api.burst-statistics.com/v1/telemetry';
		}

		return 'http://localhost:3000/v1/telemetry';
	}

	/**
	 * Init Data Sharing
	 */
	public function init(): void {
		add_action( 'burst_monthly', [ $this, 'schedule_telemetry' ] );

		add_action( self::CRON_HOOK, [ $this, 'send_monthly_telemetry' ] );
	}

	/**
	 * Schedule the telemetry send with a random offset
	 * This spreads the load over the month
	 */
	public function schedule_telemetry(): void {
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return;
		}

		$offset_hours = get_option( self::OFFSET_OPTION, false );

		if ( false === $offset_hours ) {
			$offset_hours = wp_rand( 24, 720 );
			update_option( self::OFFSET_OPTION, $offset_hours, false );
		}

		$scheduled_time = time() + ( $offset_hours * HOUR_IN_SECONDS );

		wp_schedule_single_event( $scheduled_time, self::CRON_HOOK );
	}

	/**
	 * Send monthly telemetry data
	 *
	 * This is the actual execution method that sends data to the API
	 */
	public function send_monthly_telemetry(): void {
		if ( $this->is_staging() ) {
			return;
		}

		$this->current_send_time = time();

		if ( ! $this->check_kill_switch() ) {
			// Kill switch is activated, do not send data but update the last send time to avoid repeated checks.
			update_option( 'burst_last_telemetry_send', $this->current_send_time, false );
			return;
		}

		$this->last_send = get_option( 'burst_last_telemetry_send', 0 );
		$one_month_ago   = strtotime( '-1 month' );

		if ( $this->last_send === 0 ) {
			$this->first_send        = true;
			$this->capture_data_from = $one_month_ago;
		} else {
			$this->first_send        = false;
			$this->capture_data_from = $this->last_send + 1;
		}

		if ( $this->last_send > $one_month_ago ) {
			return;
		}

		$aggregation = new Data_Aggregation( $this->capture_data_from, $this->current_send_time, $this->first_send );

		try {
			$aggregation->send_to_api( $this->get_api_url() );

			update_option( 'burst_last_telemetry_send', $this->current_send_time, false );
		} catch ( \Exception $e ) {
			self::error_log(
				sprintf(
					'Burst Telemetry Send Error: %s',
					$e->getMessage()
				)
			);
		}
	}

	/**
	 * Send test telemetry data
	 *
	 * This method is used for testing and will send data with the is_test flag set to true.
	 * Test data will be validated but not stored by the API.
	 *
	 * @param string|null $custom_endpoint Optional custom endpoint URL to send data to.
	 * @return array Response from the API
	 */
	public function send_test_telemetry( ?string $custom_endpoint = null ): array {
		$this->current_send_time = time();
		$one_month_ago           = strtotime( '-1 month' );

		$this->last_send = get_option( 'burst_last_telemetry_send', 0 );

		if ( $this->last_send === 0 ) {
			$this->first_send        = true;
			$this->capture_data_from = $one_month_ago;
		} else {
			$this->first_send        = false;
			$this->capture_data_from = $this->last_send + 1;
		}

		$aggregation = new Data_Aggregation( $this->capture_data_from, $this->current_send_time, $this->first_send, true );

		try {
			// Use custom endpoint if provided, otherwise use default.
			$api_url = $custom_endpoint ?? $this->get_api_url();

			// Use the existing send_to_api method with return_response flag.
			$response = $aggregation->send_to_api( $api_url, [ 'timeout' => 30 ], true );

			// Check if response indicates data collection failure.
			if ( is_array( $response ) && isset( $response['success'] ) && ! $response['success'] && isset( $response['errors'] ) ) {
				return array_merge( $response, [ 'endpoint' => $api_url ] );
			}

			// Check for WP_Error.
			if ( is_wp_error( $response ) ) {
				/**
				 * Note: This case should be rare since send_to_api is expected to throw exceptions on WP_Error, but we check just in case.
				 *
				 * @var \WP_Error $response
				 */
				return [
					'success'  => false,
					'message'  => 'API request failed: ' . $response->get_error_message(),
					'endpoint' => $api_url,
				];
			}

			if ( empty( $response ) ) {
				return [
					'success'  => false,
					'message'  => 'No response received from API',
					'endpoint' => $api_url,
				];
			}

			$status_code = wp_remote_retrieve_response_code( $response );
			$body        = wp_remote_retrieve_body( $response );
			$parsed_body = json_decode( $body, true );

			return [
				'success'     => $status_code >= 200 && $status_code < 300,
				'status_code' => $status_code,
				'message'     => $parsed_body['message'] ?? $body,
				'data'        => $parsed_body ?? null,
				'endpoint'    => $api_url,
			];
		} catch ( \Exception $e ) {
			return [
				'success' => false,
				'message' => 'Exception: ' . $e->getMessage(),
			];
		}
	}

	/**
	 * Check if the current site is a staging environment.
	 *
	 * @return bool True if staging environment, false otherwise
	 */
	private function is_staging(): bool {
		if ( wp_get_environment_type() !== 'production' ) {
			return true;
		}

		$site_url   = site_url();
		$parsed_url = wp_parse_url( $site_url );
		$host       = $parsed_url['host'] ?? '';

		// Check for localhost (with or without path).
		if ( $host === 'localhost' || strpos( $site_url, 'localhost/' ) !== false ) {
			return true;
		}

		// Check for .local domain.
		if ( str_contains( $host, '.local' ) ) {
			return true;
		}

		// Define staging subdomains/patterns.
		$staging_patterns = [
			'staging.',
			'.dev.',
			'.test.',
			'.stg.',
			'stg.',
			'test.',
			'beta.',
			'acceptance.',
			'.instawp.co',
		];

		// Check each pattern.
		foreach ( $staging_patterns as $pattern ) {
			// Pattern starts with a dot: check if it appears anywhere in the host.
			if ( str_starts_with( $pattern, '.' ) ) {
				if ( str_contains( $host, $pattern ) ) {
					return true;
				}
			} elseif ( str_ends_with( $pattern, '.' ) ) {
				if ( str_starts_with( $host, $pattern ) ) {
					return true;
				}
			}
		}

		return false;
	}
	/**
	 * Check the kill switch
	 *
	 * @return bool Whether to proceed with sending data
	 */
	private function check_kill_switch(): bool {
		$response = wp_remote_get(
			self::KILL_SWITCH_URL,
			[
				'timeout'   => 5,
				'sslverify' => true,
			]
		);

		if ( is_wp_error( $response ) ) {
			return true;
		}

		$body = wp_remote_retrieve_body( $response );
		$body = trim( $body );

		if ( 'disabled' === $body ) {
			return false;
		}

		if ( 'enabled' === $body ) {
			return true;
		}

		if ( is_numeric( $body ) ) {
			$percentage = intval( $body );
			if ( $percentage >= 0 && $percentage <= 100 ) {
				$random = wp_rand( 1, 100 );

				return $random <= $percentage;
			}
		}

		return true;
	}
}
