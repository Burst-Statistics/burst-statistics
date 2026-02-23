<?php

namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Date_Range {

	/**
	 * Yesterday
	 */
	public const YESTERDAY = 'yesterday';

	/**
	 * Last 7 Days
	 */
	public const LAST_7_DAYS = 'last-7-days';

	/**
	 * Last 30 Days
	 */
	public const LAST_30_DAYS = 'last-30-days';

	/**
	 * Last 90 Days
	 */
	public const LAST_90_DAYS = 'last-90-days';


	/**
	 * Last Month
	 */
	public const LAST_MONTH = 'last-month';

	/**
	 * Last Week
	 */
	public const LAST_WEEK = 'last-week';

	/**
	 * Last Year
	 */
	public const LAST_YEAR = 'last-year';

	/**
	 * Week to Date
	 */
	public const WEEK_TO_DATE = 'week-to-date';

	/**
	 * Month to Date
	 */
	public const MONTH_TO_DATE = 'month-to-date';

	/**
	 * Year to Date
	 */
	public const YEAR_TO_DATE = 'year-to-date';

	/**
	 * Custom Range (prefix for custom:startDate:endDate format)
	 */
	public const CUSTOM = 'custom';

	/**
	 * Default range
	 */
	public const DEFAULT = 'last-7-days';

	/**
	 * Array of all valid predefined ranges.
	 */
	private const ALL = [
		self::YESTERDAY,
		self::LAST_7_DAYS,
		self::LAST_30_DAYS,
		self::LAST_90_DAYS,
		self::LAST_MONTH,
		self::LAST_WEEK,
		self::LAST_YEAR,
		self::WEEK_TO_DATE,
		self::MONTH_TO_DATE,
		self::YEAR_TO_DATE,
	];

	/**
	 * Creates a Report_Report_Date_Range from a string.
	 *
	 * @param string|null $range The date range as a string.
	 * @return string The valid date range or the default if invalid.
	 */
	public static function from_string( ?string $range ): string {
		if ( null === $range || '' === $range ) {
			return self::DEFAULT;
		}

		// Check if it's a custom range (format: custom:startDate:endDate).
		if ( str_starts_with( $range, self::CUSTOM . ':' ) ) {
			if ( self::is_valid_custom_range( $range ) ) {
				return $range;
			}
			return self::DEFAULT;
		}

		return in_array( $range, self::ALL, true )
			? $range
			: self::DEFAULT;
	}

	/**
	 * Validates a custom range format.
	 *
	 * @param string $range The custom range string (format: custom:startDate:endDate).
	 * @return bool True if valid, false otherwise.
	 */
	public static function is_valid_custom_range( string $range ): bool {
		$parts = explode( ':', $range );

		// Must have exactly 3 parts: 'custom', startDate, endDate.
		if ( count( $parts ) !== 3 ) {
			return false;
		}

		[, $start_date, $end_date] = $parts;

		// Validate date format (yyyy-MM-dd).
		return self::is_valid_date( $start_date ) && self::is_valid_date( $end_date );
	}

	/**
	 * Validates a date string in yyyy-MM-dd format.
	 *
	 * @param string $date The date string to validate.
	 * @return bool True if valid, false otherwise.
	 */
	private static function is_valid_date( string $date ): bool {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
			return false;
		}

		$parts = explode( '-', $date );
		return checkdate( (int) $parts[1], (int) $parts[2], (int) $parts[0] );
	}

	/**
	 * Checks if a range is a custom range.
	 *
	 * @param string $range The range to check.
	 * @return bool True if custom range, false otherwise.
	 */
	public static function is_custom( string $range ): bool {
		return str_starts_with( $range, self::CUSTOM . ':' );
	}

	/**
	 * Parses a custom range into start and end dates.
	 *
	 * @param string $range The custom range string (format: custom:startDate:endDate).
	 * @return array{start: string, end: string}|null Array with 'start' and 'end' dates, or null if invalid.
	 */
	public static function parse_custom_range( string $range ): ?array {
		if ( ! self::is_valid_custom_range( $range ) ) {
			return null;
		}

		$parts = explode( ':', $range );
		return [
			'start' => $parts[1],
			'end'   => $parts[2],
		];
	}

	/**
	 * Creates a custom range string from start and end dates.
	 *
	 * @param string $start_date Start date in yyyy-MM-dd format.
	 * @param string $end_date End date in yyyy-MM-dd format.
	 * @return string|null Custom range string, or null if dates are invalid.
	 */
	public static function create_custom_range( string $start_date, string $end_date ): ?string {
		if ( ! self::is_valid_date( $start_date ) || ! self::is_valid_date( $end_date ) ) {
			return null;
		}

		return self::CUSTOM . ':' . $start_date . ':' . $end_date;
	}

	/**
	 * Gets the default date range.
	 *
	 * @return string The default date range.
	 */
	public static function default(): string {
		return self::DEFAULT;
	}

	/**
	 * Gets all valid predefined date ranges.
	 *
	 * @return string[] An array of all valid predefined ranges.
	 */
	public static function all(): array {
		return self::ALL;
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {
	}
}
