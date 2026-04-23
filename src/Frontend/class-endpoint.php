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
		return [
			'status'    => 'beacon',
			'last_test' => time(),
		];
	}

	/**
	 * Get tracking status
	 */
	public static function get_tracking_status(): string {
		return 'beacon';
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
		return 'beacon';
	}

	/**
	 * Test endpoint
	 */
	public static function endpoint_test_request(): bool {
		return true;
	}

	/**
	 * Test REST API
	 */
	public static function rest_api_test_request(): bool {
		return true;
	}
}
