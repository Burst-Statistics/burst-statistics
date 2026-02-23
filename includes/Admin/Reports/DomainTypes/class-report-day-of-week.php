<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Day_Of_Week {
	/**
	 * Monday
	 */
	public const MONDAY = 'monday';

	/**
	 * Tuesday
	 */
	public const TUESDAY = 'tuesday';

	/**
	 * Wednesday
	 */
	public const WEDNESDAY = 'wednesday';

	/**
	 * Thursday
	 */
	public const THURSDAY = 'thursday';

	/**
	 * Friday
	 */
	public const FRIDAY = 'friday';

	/**
	 * Saturday
	 */
	public const SATURDAY = 'saturday';

	/**
	 * Sunday
	 */
	public const SUNDAY = 'sunday';

	/**
	 * Default day of the week
	 */
	public const DEFAULT = null;

	/**
	 * Array of all valid days of the week.
	 */
	private const ALL = [
		self::SUNDAY,
		self::MONDAY,
		self::TUESDAY,
		self::WEDNESDAY,
		self::THURSDAY,
		self::FRIDAY,
		self::SATURDAY,
	];

	/**
	 * Creates a Report_Day_Of_Week from a string.
	 *
	 * @param string|null $day The day of the week as a string.
	 * @return string|null The valid day of the week or the default if invalid.
	 */
	public static function from_string( ?string $day ): ?string {
		if ( null === $day || '' === $day ) {
			return self::DEFAULT;
		}

		return in_array( $day, self::ALL, true )
			? $day
			: self::DEFAULT;
	}

	/**
	 * Gets the default day of the week.
	 *
	 * @return string|null The default day of the week.
	 * @phpstan-ignore return.unusedType
	 */
	public static function default(): ?string {
		return self::DEFAULT;
	}

	/**
	 * Gets all valid days of the week.
	 *
	 * @return string[] An array of all valid days of the week.
	 */
	public static function all(): array {
		return self::ALL;
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
