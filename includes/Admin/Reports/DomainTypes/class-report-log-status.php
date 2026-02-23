<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Log_Status {
	/**
	 * Sending successful status.
	 */
	public const SENDING_SUCCESSFUL = 'sending_successful';

	/**
	 * Sending failed status.
	 */
	public const SENDING_FAILED = 'sending_failed';

	/**
	 * Email domain error status.
	 */
	public const EMAIL_DOMAIN_ERROR = 'email_domain_error';

	/**
	 * Email address error status.
	 */
	public const EMAIL_ADDRESS_ERROR = 'email_address_error';

	/**
	 * Cron miss status.
	 */
	public const CRON_MISS = 'cron_miss';

	/**
	 * Partly sent status.
	 */
	public const PARTLY_SENT = 'partly_sent';

	/**
	 * Processing status.
	 */
	public const PROCESSING = 'processing';

	/**
	 * Default status.
	 */
	public const DEFAULT = self::SENDING_FAILED;

	/**
	 * All allowed statuses.
	 */
	private const ALL = [
		self::PROCESSING,
		self::SENDING_SUCCESSFUL,
		self::SENDING_FAILED,
		self::EMAIL_DOMAIN_ERROR,
		self::EMAIL_ADDRESS_ERROR,
		self::CRON_MISS,
		self::PARTLY_SENT,
	];

	/**
	 * Fallback-safe factory.
	 *
	 * @param string $status Status string.
	 * @return string Valid status.
	 */
	public static function from_string( string $status ): string {
		return in_array( $status, self::ALL, true )
			? $status
			: self::DEFAULT;
	}

	/**
	 * Get Generic log message for status.
	 *
	 * @param string $status Status string.
	 * @return string Log message.
	 */
	public static function get_log_message( string $status ): string {
		return match ( $status ) {
			self::PARTLY_SENT         => __( 'Partly sent', 'burst-statistics' ),
			self::EMAIL_ADDRESS_ERROR => __( 'Email address error', 'burst-statistics' ),
			self::EMAIL_DOMAIN_ERROR  => __( 'Email domain error', 'burst-statistics' ),
			self::SENDING_SUCCESSFUL  => __( 'Sent successfully', 'burst-statistics' ),
			self::SENDING_FAILED      => __( 'Sending failed', 'burst-statistics' ),
			self::CRON_MISS           => __( 'Sending missed', 'burst-statistics' ),
			self::PROCESSING          => __( 'In progress', 'burst-statistics' ),
			default                                => $status,
		};
	}


	/**
	 * Prevent instantiation.
	 */
	private function __construct() {}
}
