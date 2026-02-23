<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Frequency {
	/**
	 * Daily frequency for reports.
	 */
	public const DAILY = 'daily';

	/**
	 * Weekly frequency for reports.
	 */
	public const WEEKLY = 'weekly';

	/**
	 * Monthly frequency for reports.
	 */
	public const MONTHLY = 'monthly';

	/**
	 * Default frequency for reports.
	 */
	public const DEFAULT = self::WEEKLY;

	/**
	 * Array of all valid report frequencies.
	 */
	private const ALL = [
		self::DAILY,
		self::WEEKLY,
		self::MONTHLY,
	];

	/**
	 * Creates a Report_Frequency from a string.
	 *
	 * @param string $frequency The frequency as a string.
	 * @return string The valid frequency or the default if invalid.
	 */
	public static function from_string( string $frequency ): string {
		return in_array( $frequency, self::ALL, true )
			? $frequency
			: self::DEFAULT;
	}

	/**
	 * Gets the default report frequency.
	 *
	 * @return string The default report frequency.
	 */
	public static function default(): string {
		return self::DEFAULT;
	}

	/**
	 * Gets all valid report frequencies.
	 *
	 * @return string[] Array of all valid report frequencies.
	 */
	public static function all(): array {
		return self::ALL;
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
