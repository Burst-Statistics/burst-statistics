<?php

namespace Burst\Admin\Data_Sharing;

use Burst\Admin\Admin_Options;
use Burst\Admin\DomainTypes\Admin_Option_Category;
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
	 * The cron hook name for the actual data send
	 */
	const CRON_HOOK = 'burst_telemetry_send';

	/**
	 * The core admin option that holds the time of the last send scheduled by an opt-in.
	 */
	const OPT_IN_SEND_KEY = 'telemetry_opt_in_send';

	/**
	 * Delay between opting in and the first send on a site that already has a
	 * month of data, so it never runs in the save request.
	 */
	const OPT_IN_SEND_DELAY = 5 * MINUTE_IN_SECONDS;

	/**
	 * The kill switch URL
	 */
	const KILL_SWITCH_URL = 'https://burst.ams3.cdn.digitaloceanspaces.com/feedback/switch.txt';

	private int $current_send_time;

	private int $capture_data_from;

	private int $last_send;

	private array $api_urls = [
		'production' => 'https://api.burst-statistics.com/v2/telemetry',
		'staging'    => 'http://localhost:3000/v2/telemetry',
	];

	/**
	 * Get API URL for data sharing.
	 *
	 * @return string The API URL to send telemetry data to
	 */
	private function get_api_url(): string {
		if ( wp_get_environment_type() === 'production' ) {
			return $this->api_urls['production'];
		}

		return $this->api_urls['staging'];
	}

	/**
	 * Init Data Sharing.
	 *
	 * The opt-in listeners always register, because the setting is still off in
	 * the request that turns it on. The sends only register when sharing is on.
	 */
	public function init(): void {
		add_action( 'add_option_burst_options_settings', [ $this, 'on_settings_added' ], 10, 2 );
		add_action( 'update_option_burst_options_settings', [ $this, 'on_settings_updated' ], 10, 2 );

		if ( ! $this->get_option_bool( 'anonymous_usage_data' ) ) {
			return;
		}

		add_action( 'burst_monthly', [ $this, 'schedule_telemetry' ] );

		add_action( self::CRON_HOOK, [ $this, 'send_monthly_telemetry' ] );
	}

	/**
	 * Schedule the first send when the settings option is created with sharing on.
	 *
	 * Mixed $value: WordPress passes the raw option value, which is only an array once Burst saved it.
	 *
	 * @param string $option The option name.
	 * @param mixed  $value  The new settings option value.
	 */
	public function on_settings_added( string $option, mixed $value ): void {
		$this->on_settings_updated( [], $value );
	}

	/**
	 * Schedule the first send when anonymous usage data switches from off to on.
	 *
	 * Mixed fallback is allowed because if the option does not exist yet
	 * or fails to load, WordPress may pass a boolean false instead of an array.
	 *
	 * @param mixed $old_value Old settings option value.
	 * @param mixed $value     New settings option value.
	 */
	public function on_settings_updated( mixed $old_value, mixed $value ): void {
		if ( $this->is_sharing_enabled_in( $old_value ) || ! $this->is_sharing_enabled_in( $value ) ) {
			return;
		}

		$this->schedule_opt_in_send( time() );
	}

	/**
	 * Whether a settings option value has anonymous usage data switched on.
	 *
	 * Mixed $settings: the raw option value, see on_settings_updated().
	 *
	 * @param mixed $settings The settings option value.
	 * @return bool True when sharing is on.
	 */
	private function is_sharing_enabled_in( mixed $settings ): bool {
		if ( ! is_array( $settings ) || ! isset( $settings['anonymous_usage_data'] ) ) {
			return false;
		}

		return rest_sanitize_boolean( $settings['anonymous_usage_data'] );
	}

	/**
	 * Schedule the first send after opting in, so the community comparison does
	 * not wait for the next burst_monthly run plus its random offset.
	 *
	 * Limited to once per day, so toggling the setting cannot trigger repeated
	 * sends, and skipped when the last send is less than a month ago: the
	 * endpoint expects one send per site per month.
	 *
	 * @param int $now Current timestamp.
	 * @return bool True when the send was scheduled. Side effect: replaces a later
	 *              scheduled send and stores the time in OPT_IN_SEND_KEY.
	 */
	public function schedule_opt_in_send( int $now ): bool {
		$last_opt_in_send = (int) Admin_Options::get( Admin_Option_Category::CORE, self::OPT_IN_SEND_KEY, 0 );
		if ( $last_opt_in_send > $now - DAY_IN_SECONDS ) {
			return false;
		}

		if ( ! $this->is_send_due( (int) Admin_Options::get( Admin_Option_Category::CORE, 'last_telemetry_send', 0 ), $now ) ) {
			return false;
		}

		$send_at   = $this->get_opt_in_send_time( $now );
		$scheduled = wp_next_scheduled( self::CRON_HOOK );
		if ( false !== $scheduled && $scheduled <= $send_at ) {
			return false;
		}

		if ( false !== $scheduled ) {
			wp_unschedule_event( $scheduled, self::CRON_HOOK );
		}

		wp_schedule_single_event( $send_at, self::CRON_HOOK );
		Admin_Options::update( Admin_Option_Category::CORE, self::OPT_IN_SEND_KEY, $now );

		return true;
	}

	/**
	 * Get the moment of the first send after opting in.
	 *
	 * The endpoint places a site in a peer group by its monthly visitors, so a
	 * site that has tracked for less than a month would be compared with sites
	 * that are too small. The first send therefore waits until a month after
	 * activation, or follows shortly when that month has already passed.
	 *
	 * @param int $now Current timestamp.
	 * @return int Timestamp of the first send.
	 */
	private function get_opt_in_send_time( int $now ): int {
		$month_after_activation = (int) get_option( 'burst_activation_time', 0 ) + MONTH_IN_SECONDS;

		return max( $month_after_activation, $now + self::OPT_IN_SEND_DELAY );
	}

	/**
	 * Get the time of the last send and the expected next send, for the settings field.
	 *
	 * @return array{last_send: int, next_send: int, is_staging: bool} Timestamps, 0 when unknown.
	 */
	public function get_sync_status(): array {
		$last_send = (int) Admin_Options::get( Admin_Option_Category::CORE, 'last_telemetry_send', 0 );

		return [
			'last_send'  => $last_send,
			'next_send'  => $this->get_next_send( $last_send ),
			'is_staging' => $this->is_staging(),
		];
	}

	/**
	 * Get the first scheduled moment a send will actually go out.
	 *
	 * A send that runs before the last one is a month old is skipped (see
	 * is_send_due()), so the next one is then the following burst_monthly run.
	 *
	 * @param int $last_send Timestamp of the last send, 0 if never sent.
	 * @return int Timestamp of the next send, 0 when nothing is scheduled.
	 */
	private function get_next_send( int $last_send ): int {
		$monthly    = (int) wp_next_scheduled( 'burst_monthly' );
		$candidates = [ (int) wp_next_scheduled( self::CRON_HOOK ), $monthly ];
		if ( $monthly > 0 ) {
			$candidates[] = $monthly + MONTH_IN_SECONDS;
		}
		sort( $candidates );

		$due_from = $last_send > 0 ? $last_send + MONTH_IN_SECONDS - DAY_IN_SECONDS : 0;
		foreach ( $candidates as $candidate ) {
			if ( $candidate > 0 && $candidate >= $due_from ) {
				return $candidate;
			}
		}

		return 0;
	}

	/**
	 * Schedule the telemetry send.
	 *
	 * The very first time, a random offset (24-720h) is used to spread the
	 * initial load across the month over all sites. Every subsequent run uses a
	 * small fixed delay so the send does not fire in the same request as all the
	 * other tasks hooked onto burst_monthly.
	 */
	public function schedule_telemetry(): void {
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return;
		}

		$offset_hours = Admin_Options::get( Admin_Option_Category::CORE, 'telemetry_offset', false );

		if ( false === $offset_hours ) {
			// First scheduling only: random offset to spread the initial load across the month.
			$offset_hours = wp_rand( 24, 720 );
			Admin_Options::update( Admin_Option_Category::CORE, 'telemetry_offset', $offset_hours );
			$delay = $offset_hours * HOUR_IN_SECONDS;
		} else {
			// Subsequent schedulings: small fixed delay so crons on burst_monthly don't all start at once.
			$delay = 30 * MINUTE_IN_SECONDS;
		}

		wp_schedule_single_event( time() + $delay, self::CRON_HOOK );
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
			Admin_Options::update( Admin_Option_Category::CORE, 'last_telemetry_send', $this->current_send_time );
			return;
		}

		$this->last_send = (int) Admin_Options::get( Admin_Option_Category::CORE, 'last_telemetry_send', 0 );

		if ( ! $this->is_send_due( $this->last_send, $this->current_send_time ) ) {
			return;
		}

		$this->capture_data_from = $this->get_capture_start( $this->last_send, $this->current_send_time );

		$aggregation = new Data_Aggregation( $this->capture_data_from, $this->current_send_time );
		try {
			$response = $aggregation->send_to_api( $this->get_api_url(), [], true );

			if ( ! is_wp_error( $response ) ) {
				$status_code = wp_remote_retrieve_response_code( $response );
				if ( $status_code >= 200 && $status_code < 300 ) {
					$body        = wp_remote_retrieve_body( $response );
					$parsed_body = json_decode( $body, true );
					if ( is_array( $parsed_body ) && isset( $parsed_body['community_data'] ) ) {
						set_transient( 'burst_community_data', $parsed_body['community_data'], YEAR_IN_SECONDS );
					}
				}
			}

			Admin_Options::update( Admin_Option_Category::CORE, 'last_telemetry_send', $this->current_send_time );
			delete_option( 'burst_ai_chat_questions' );
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
	 * Whether enough time has passed since the last send to send again.
	 *
	 * The send is triggered by burst_monthly, which runs every MONTH_IN_SECONDS
	 * (30 days). Comparing against a calendar month (strtotime( '-1 month' ))
	 * skipped every send that followed a 31-day month, so the check uses the
	 * same 30-day unit with a day of slack for cron timing.
	 *
	 * @param int $last_send Timestamp of the last send, 0 if never sent.
	 * @param int $now       Current timestamp.
	 * @return bool True when a send is due.
	 */
	private function is_send_due( int $last_send, int $now ): bool {
		if ( 0 === $last_send ) {
			return true;
		}

		return $last_send <= $now - ( MONTH_IN_SECONDS - DAY_IN_SECONDS );
	}

	/**
	 * Get the start of the period to aggregate for this send.
	 *
	 * Starts right after the last send, but never more than a month back: the
	 * endpoint buckets sites by monthly visitors, so a longer window (e.g. after
	 * a missed send) would place the site in a too-high visitor range.
	 *
	 * @param int $last_send Timestamp of the last send, 0 if never sent.
	 * @param int $now       Current timestamp.
	 * @return int Timestamp to capture data from.
	 */
	private function get_capture_start( int $last_send, int $now ): int {
		return max( $last_send + 1, $now - MONTH_IN_SECONDS );
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
		$this->last_send         = (int) Admin_Options::get( Admin_Option_Category::CORE, 'last_telemetry_send', 0 );
		$this->capture_data_from = $this->get_capture_start( $this->last_send, $this->current_send_time );

		$aggregation = new Data_Aggregation( $this->capture_data_from, $this->current_send_time, true );

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

			if ( is_array( $parsed_body ) && isset( $parsed_body['community_data'] ) ) {
				set_transient( 'burst_community_data', $parsed_body['community_data'], YEAR_IN_SECONDS );
			}

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
