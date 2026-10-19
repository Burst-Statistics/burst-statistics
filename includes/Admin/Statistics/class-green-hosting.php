<?php
/**
 * Green hosting check integration.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Checks and caches Green Web Foundation hosting status for the site's own host.
 */
class Green_Hosting {
	use Helper;

	public const OPTION     = 'burst_green_hosting';
	public const CHECK_HOOK = 'burst_green_hosting_check';
	public const TTL        = 30 * DAY_IN_SECONDS;

	private const STALE_GRACE_PERIOD = WEEK_IN_SECONDS;
	private const RETRY_DELAYS       = [
		5 * MINUTE_IN_SECONDS,
		HOUR_IN_SECONDS,
		6 * HOUR_IN_SECONDS,
		DAY_IN_SECONDS,
		3 * DAY_IN_SECONDS,
		7 * DAY_IN_SECONDS,
	];

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_option' ] );
		add_action( 'burst_weekly', [ $this, 'maybe_refresh' ] );
		add_action( self::CHECK_HOOK, [ $this, 'run_scheduled_check' ] );
	}

	/**
	 * Create the cache option with autoload disabled.
	 */
	public function install_option(): void {
		add_option( self::OPTION, self::default_status(), '', false );
	}

	/**
	 * Whether the site owner has ever asked for a check.
	 *
	 * Burst never contacts the Green Web Foundation on its own: the button in
	 * the Page weight block is the only thing that starts the first check, and
	 * that click is what permits the background refreshes below. Read from the
	 * stored status rather than get_status(), because a stale result is masked
	 * there and would otherwise revoke the consent it was given under.
	 */
	public static function has_been_checked(): bool {
		return self::get_stored_status()['last_attempt'] > 0;
	}

	/**
	 * Refresh from weekly cron when the result is older than 30 days.
	 */
	public function maybe_refresh(): void {
		if ( ! self::has_been_checked() ) {
			return;
		}

		self::refresh();
	}

	/**
	 * Run a deferred or retry check outside the request that asked for it.
	 */
	public function run_scheduled_check(): void {
		if ( ! self::has_been_checked() ) {
			return;
		}

		self::refresh( true );
	}

	/**
	 * Whether the current cached value can be used as green hosting.
	 */
	public static function uses_green_hosting(): bool {
		return (bool) self::get_status()['green'];
	}

	/**
	 * Return the cached status with a safe default.
	 *
	 * @return array{green: bool, hosted_by: string, checked_at: int, host: string, last_attempt: int, failed_attempts: int, retry_at: int}
	 */
	public static function get_status(): array {
		$status = self::get_stored_status();
		$host   = self::get_site_host();
		if ( '' === $host || $status['host'] !== $host ) {
			return self::default_status();
		}

		if ( 0 === $status['checked_at'] || $status['checked_at'] < time() - self::TTL - self::STALE_GRACE_PERIOD ) {
			$status['green']      = false;
			$status['hosted_by']  = '';
			$status['checked_at'] = 0;
		}

		return $status;
	}

	/**
	 * Check Green Web Foundation and cache successful responses.
	 *
	 * @param bool $force Bypass the cache TTL and the retry backoff. Set for a
	 *                    check a person asked for, and for the scheduled retry
	 *                    that runs at retry_at.
	 * @return bool Whether a current result is in place after this call.
	 */
	public static function refresh( bool $force = false ): bool {
		$status = self::get_stored_status();
		$host   = self::get_site_host();

		if ( $status['host'] !== $host ) {
			$status = self::default_status();
		}

		if ( ! $force && $status['checked_at'] > time() - self::TTL ) {
			return true;
		}

		// The backoff exists to stop the weekly refresh hammering a failing API,
		// not to ignore a person who clicked Check: the last delay is 7 days, so
		// without the force guard the button does nothing for a week and says
		// nothing about why.
		if ( ! $force && $status['retry_at'] > time() ) {
			self::schedule_check( $status['retry_at'] );
			return false;
		}

		if ( '' === $host ) {
			self::record_failure( $status, $host, 'the site host could not be determined' );
			return false;
		}

		$response = wp_remote_get(
			'https://api.thegreenwebfoundation.org/api/v3/greencheck/' . rawurlencode( $host ),
			[
				'timeout'    => 10,
				'user-agent' => 'Burst Statistics',
				'headers'    => [
					'Accept' => 'application/json',
				],
			]
		);

		if ( is_wp_error( $response ) ) {
			self::record_failure( $status, $host, $response->get_error_message() );
			return false;
		}

		$response_code = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 !== $response_code ) {
			self::record_failure( $status, $host, 'unexpected HTTP status ' . $response_code );
			return false;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) || ! array_key_exists( 'green', $body ) || ! is_bool( $body['green'] ) ) {
			self::record_failure( $status, $host, 'the API returned a malformed response' );
			return false;
		}

		$checked_at = time();

		update_option(
			self::OPTION,
			[
				'green'           => $body['green'],
				'hosted_by'       => sanitize_text_field( (string) ( $body['hosted_by'] ?? '' ) ),
				'checked_at'      => $checked_at,
				'host'            => $host,
				'last_attempt'    => $checked_at,
				'failed_attempts' => 0,
				'retry_at'        => 0,
			],
			false
		);
		wp_clear_scheduled_hook( self::CHECK_HOOK );

		return true;
	}

	/**
	 * Return the host portion of home_url().
	 */
	private static function get_site_host(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( ! is_string( $host ) ) {
			return '';
		}

		return sanitize_text_field( strtolower( $host ) );
	}

	/**
	 * Normalize the stored status without performing output sanitization.
	 *
	 * Values are sanitized when written; casts keep legacy option shapes safe.
	 *
	 * @return array{green: bool, hosted_by: string, checked_at: int, host: string, last_attempt: int, failed_attempts: int, retry_at: int}
	 */
	private static function get_stored_status(): array {
		$status = get_option( self::OPTION, [] );
		if ( ! is_array( $status ) ) {
			return self::default_status();
		}

		return [
			'green'           => (bool) ( $status['green'] ?? false ),
			'hosted_by'       => (string) ( $status['hosted_by'] ?? '' ),
			'checked_at'      => (int) ( $status['checked_at'] ?? 0 ),
			'host'            => strtolower( (string) ( $status['host'] ?? '' ) ),
			'last_attempt'    => (int) ( $status['last_attempt'] ?? 0 ),
			'failed_attempts' => (int) ( $status['failed_attempts'] ?? 0 ),
			'retry_at'        => (int) ( $status['retry_at'] ?? 0 ),
		];
	}

	/**
	 * Record an unsuccessful check and schedule its next retry.
	 *
	 * @param array{green: bool, hosted_by: string, checked_at: int, host: string, last_attempt: int, failed_attempts: int, retry_at: int} $status Cached status before the attempt.
	 * @param string                                                                                                                       $host   Host used for the attempt.
	 * @param string                                                                                                                       $reason Failure detail for the debug log.
	 */
	private static function record_failure( array $status, string $host, string $reason ): void {
		$attempted_at               = time();
		$status['host']             = $host;
		$status['last_attempt']     = $attempted_at;
		$status['failed_attempts'] += 1;
		$status['retry_at']         = $attempted_at + self::get_retry_delay( $status['failed_attempts'] );

		update_option( self::OPTION, $status, false );
		self::error_log( sprintf( 'Green hosting verification failed for "%s": %s.', $host, $reason ) );
		self::schedule_check( $status['retry_at'] );
	}

	/**
	 * Return the retry delay for the current consecutive failure count.
	 */
	private static function get_retry_delay( int $failed_attempts ): int {
		$index = min( max( 0, $failed_attempts - 1 ), count( self::RETRY_DELAYS ) - 1 );

		return self::RETRY_DELAYS[ $index ];
	}

	/**
	 * Keep one Green Hosting check scheduled at the earliest requested time.
	 */
	private static function schedule_check( int $timestamp ): void {
		$timestamp = max( time(), $timestamp );
		$scheduled = wp_next_scheduled( self::CHECK_HOOK );
		if ( false !== $scheduled && $scheduled <= $timestamp ) {
			return;
		}

		if ( false !== $scheduled ) {
			$unscheduled = wp_unschedule_event( $scheduled, self::CHECK_HOOK, [], true );
			if ( true !== $unscheduled ) {
				$reason = is_wp_error( $unscheduled ) ? $unscheduled->get_error_message() : 'the existing event could not be removed';
				self::error_log( 'Could not reschedule Green Hosting verification: ' . $reason );
				return;
			}
		}

		$result = wp_schedule_single_event( $timestamp, self::CHECK_HOOK, [], true );
		if ( true !== $result ) {
			$reason = is_wp_error( $result ) ? $result->get_error_message() : 'WordPress rejected the event';
			self::error_log( 'Could not schedule Green Hosting verification: ' . $reason );
		}
	}

	/**
	 * Default result when no successful check has been cached.
	 *
	 * @return array{green: bool, hosted_by: string, checked_at: int, host: string, last_attempt: int, failed_attempts: int, retry_at: int}
	 */
	private static function default_status(): array {
		return [
			'green'           => false,
			'hosted_by'       => '',
			'checked_at'      => 0,
			'host'            => '',
			'last_attempt'    => 0,
			'failed_attempts' => 0,
			'retry_at'        => 0,
		];
	}
}
