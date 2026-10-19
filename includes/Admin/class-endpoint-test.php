<?php
/**
 * Tracking endpoint reachability test.
 *
 * Probes the beacon endpoint and the REST API with a loopback request and stores
 * the result in `burst_tracking_status`, which the frontend reads to choose the
 * tracking transport. The probe only runs from WP-Cron, so a visitor or admin
 * request never waits on a loopback request.
 *
 * @package Burst\Admin
 */

namespace Burst\Admin;

use Burst\Frontend\Endpoint;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Endpoint_Test
 */
class Endpoint_Test {
	use Helper;

	/**
	 * Register the cron hook that runs the test when it is due.
	 *
	 * One ten-minute hook covers both the daily re-test and the fast retry while
	 * in error: should_test_again() decides which interval applies.
	 */
	public function init(): void {
		add_action( 'burst_every_ten_minutes', [ $this, 'maybe_run_test' ] );
	}

	/**
	 * Cron callback: run the test when it is due.
	 *
	 * The combined tracking script bakes in whether the beacon transport is used,
	 * so it is rebuilt when the result switches between beacon and no beacon.
	 * Otherwise the script keeps the old transport until the next daily rebuild.
	 */
	public function maybe_run_test(): void {
		if ( ! $this->should_test_again() ) {
			return;
		}

		$was_beacon = 'beacon' === Endpoint::get_tracking_status();
		$is_beacon  = 'beacon' === $this->run_test();

		if ( $was_beacon !== $is_beacon ) {
			do_action( 'burst_create_js_file' );
		}
	}

	/**
	 * Determine whether the tracking endpoint test should be re-run.
	 *
	 * Re-test daily, or every 10 minutes while in error to recover faster. But a
	 * failed loopback probe is not a real outage while hits are still recorded, so
	 * back off to the daily interval when recent hits exist instead of hammering
	 * the server. has_recent_hits() only runs in the error branch (short-circuit).
	 *
	 * @return bool True if a re-test is overdue.
	 */
	public function should_test_again(): bool {
		$last_test = get_option( 'burst_ran_test' );

		if ( false === $last_test ) {
			return true;
		}

		$fast_retry         = 'error' === Endpoint::get_tracking_status() && ! ( new Tracking_Health() )->has_recent_hits();
		$time_between_tests = $fast_retry ? 10 * MINUTE_IN_SECONDS : DAY_IN_SECONDS;
		$time_between_tests = (int) apply_filters( 'burst_time_between_tests', $time_between_tests );

		return (int) $last_test < ( time() - $time_between_tests );
	}

	/**
	 * Run the test and store the result.
	 *
	 * The test time is stored before probing: the probes can take up to ~15
	 * seconds, and an overlapping cron runner then sees the test as not due
	 * instead of probing as well.
	 *
	 * @return string The new status: 'beacon', 'rest' or 'error'.
	 */
	public function run_test(): string {
		update_option( 'burst_ran_test', time(), false );

		// no tracking is possible on the Blueprint environment. Always return success there.
		if ( defined( 'BURST_BLUEPRINT' ) || $this->endpoint_test_request() ) {
			$status = 'beacon';
		} else {
			$status = $this->rest_api_test_request() ? 'rest' : 'error';
		}

		update_option( 'burst_tracking_status', $status, true );

		return $status;
	}

	/**
	 * Test the beacon endpoint.
	 *
	 * @return bool True if the endpoint responded with a 200.
	 */
	public function endpoint_test_request(): bool {
		$url  = self::get_beacon_url();
		$data = [ 'request' => 'test' ];

		$response = wp_remote_post(
			$url,
			[
				'method'    => 'POST',
				'headers'   => [ 'Content-type' => 'application/x-www-form-urlencoded' ],
				'body'      => $data,
				'sslverify' => false,
				'timeout'   => 5,
			]
		);
		$status   = false;
		if ( ! is_wp_error( $response ) && ! empty( $response['response']['code'] ) ) {
			$status = $response['response']['code'];
		}
		if ( 200 === (int) $status ) {
			return true;
		}
		// otherwise try with file_get_contents.

		// use key 'http' even if you send the request to https://...
		$options = [
			'http' => [
				'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
				'method'  => 'POST',
				'content' => http_build_query( $data ),
				'timeout' => 5,
			],
			'ssl'  => [
				'verify_peer'      => false,
				'verify_peer_name' => false,
			],
		];
		$context = stream_context_create( $options );
        // phpcs:ignore
		@file_get_contents( $url, false, $context );
		$status_line = $http_response_header[0] ?? '';

		$status = false;
		if ( preg_match( '{HTTP\/\S*\s(\d{3})}', $status_line, $matches ) ) {
			$status = $matches[1];
		}

		return 200 === (int) $status;
	}

	/**
	 * Test the REST API tracking route.
	 *
	 * @return bool True if the route responded with a 200.
	 */
	public function rest_api_test_request(): bool {
		$url      = get_rest_url( null, 'burst/v1/track' );
		$data     = '{"request":"test"}';
		$response = wp_remote_post(
			$url,
			[
				'headers'     => [ 'Content-Type' => 'application/json; charset=utf-8' ],
				'method'      => 'POST',
				'body'        => wp_json_encode( $data ),
				'data_format' => 'body',
				'timeout'     => 5,
			]
		);
		if ( is_wp_error( $response ) ) {
			return false;
		}

		return 200 === (int) $response['response']['code'];
	}
}
