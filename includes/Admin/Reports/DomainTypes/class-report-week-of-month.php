<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Week_Of_Month {
	/**
	 * First rule.
	 */
	public const FIRST = 1;

	/**
	 * Second rule.
	 */
	public const SECOND = 2;

	/**
	 * Third rule.
	 */
	public const THIRD = 3;

	/**
	 * Last rule.
	 */
	public const LAST = -1;

	/**
	 * Default rule.
	 */
	public const DEFAULT = null;

	/**
	 * Array of all valid report monthly rules.
	 */
	private const ALL = [
		self::FIRST,
		self::SECOND,
		self::THIRD,
		self::LAST,
	];

	/**
	 * Creates a Report_Week_Of_Month from an integer.
	 *
	 * @param int|null $rule The rule as an integer.
	 * @return int|null The valid rule or the default if invalid.
	 */
	public static function from_int( ?int $rule ): ?int {
		if ( null === $rule ) {
			return self::DEFAULT;
		}

		return in_array( $rule, self::ALL, true )
			? $rule
			: self::DEFAULT;
	}

	/**
	 * Gets the default report monthly rule.
	 *
	 * @return int|null The default report monthly rule.
	 * @phpstan-ignore return.unusedType
	 */
	public static function default(): ?int {
		return self::DEFAULT;
	}

	/**
	 * Gets all valid report monthly rules.
	 *
	 * @return int[] Array of all valid report monthly rules.
	 */
	public static function all(): array {
		return self::ALL;
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
