<?php
namespace Burst\Frontend;

defined( 'ABSPATH' ) || die();

class Endpoint {

	/**
	 * Get the stored tracking status and the timestamp of the last test.
	 *
	 * Reads the stored result only; Burst\Admin\Endpoint_Test keeps it up to date
	 * from WP-Cron.
	 *
	 * @return array{status: string, last_test: int}
	 */
	public static function get_tracking_status_and_time(): array {
		return [
			'status'    => self::get_tracking_status(),
			'last_test' => (int) get_option( 'burst_ran_test', 0 ),
		];
	}

	/**
	 * Get the stored tracking status.
	 *
	 * Reads the result of the last reachability test only. This runs on every
	 * tracked page view, so it never decides whether a new test is due: that
	 * happens in WP-Cron, see Burst\Admin\Endpoint_Test.
	 *
	 * @return string 'beacon', 'rest' or 'error'.
	 */
	public static function get_tracking_status(): string {
		$status = get_option( 'burst_tracking_status' );

		return empty( $status ) ? 'error' : (string) $status;
	}
}
