<?php
namespace Burst\Frontend;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();
class Endpoint {
	use Helper;

	/**
	 * Get tracking status and timestamp of last test.
	 *
	 * @return array{status: string, last_test: int}
	 */
	public static function get_tracking_status_and_time(): array {
		$status_option = get_option( 'burst_tracking_status' );

		// default to error if not false or empty.
		$status = ( false === $status_option ) ? 'error' : ( empty( $status_option ) ? 'error' : $status_option );

		$last_test = get_option( 'burst_ran_test' );
		$now       = time();
		// check if last test was more than 24 hours ago, 10 minutes if there's an error, to re-check faster.
		$time_between_tests = $status === 'error' ? 10 * MINUTE_IN_SECONDS : DAY_IN_SECONDS;
		$time_between_tests = apply_filters( 'burst_time_between_tests', $time_between_tests );
		$should_test_again  = $last_test < $now - $time_between_tests;

		if ( $should_test_again || $last_test === false ) {
			$last_test = time();
			update_option( 'burst_ran_test', $last_test );
			$status = self::test_tracking_status();
		}

		return [
			'status'    => $status,
			'last_test' => $last_test,
		];
	}

	/**
	 * Get tracking status
	 */
	public static function get_tracking_status(): string {
		$tracking = self::get_tracking_status_and_time();
		return $tracking['status'];
	}

	/**
	 * Check if tracking status is error
	 */
	public static function tracking_status_error(): bool {
		return self::get_tracking_status() === 'error';
	}

	/**
	 * Test tracking status
	 * Only returns 'error', 'rest', 'beacon'
	 */
	public static function test_tracking_status(): string {
		$endpoint_test_success = self::endpoint_test_request();

		// no tracking is possible on the Blueprint environment. Always return success there.
		if ( defined( 'BURST_BLUEPRINT' ) ) {
			$status = 'beacon';
		} elseif ( $endpoint_test_success ) {
			$status = 'beacon';
		} else {
			$rest_api_success = self::rest_api_test_request();
			$status           = $rest_api_success ? 'rest' : 'error';
		}

		update_option( 'burst_tracking_status', $status, true );

		return $status;
	}

	/**
	 * Test endpoint
	 */
	public static function endpoint_test_request(): bool {
		$url  = self::get_beacon_url();
		$data = [ 'request' => 'test' ];

		$response = wp_remote_post(
			$url,
			[
				'method'    => 'POST',
				'headers'   => [ 'Content-type' => 'application/x-www-form-urlencoded' ],
				'body'      => $data,
				'sslverify' => false,
			]
		);
		$status   = false;
		if ( ! is_wp_error( $response ) && ! empty( $response['response']['code'] ) ) {
			$status = $response['response']['code'];
		}
		if ( $status === 200 ) {
			return true;
		}
		// otherwise try with file_get_contents.

		// use key 'http' even if you send the request to https://...
		$options = [
			'http' => [
				'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
				'method'  => 'POST',
				'content' => http_build_query( $data ),
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

		return (int) $status === 200;
	}

	/**
	 * Test REST API
	 */
	public static function rest_api_test_request(): bool {
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
		if ( $response['response']['code'] === 200 ) {
			return true;
		}

		return false;
	}
}
