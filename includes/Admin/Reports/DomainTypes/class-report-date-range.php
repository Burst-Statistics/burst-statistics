<?php

namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

use Burst\Admin\Reports\Report;

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
	 * Get the effective date range for a block or report.
	 *
	 * Ported from the React wizard's getDateRange logic.
	 *
	 * @param array<string, mixed>|string|null $block  The block array or block id string.
	 * @param Report                           $report The report instance.
	 * @return string The resolved date range string.
	 */
	public static function get_date_range( array|string|null $block, Report $report ): string {
		$effective_range = ! empty( $report->date_range ) ? $report->date_range : self::DEFAULT;

		if ( $report->scheduled ) {
			$map             = [
				Report_Frequency::DAILY   => self::YESTERDAY,
				Report_Frequency::WEEKLY  => self::LAST_7_DAYS,
				Report_Frequency::MONTHLY => self::LAST_MONTH,
			];
			$effective_range = $map[ $report->frequency ] ?? self::LAST_7_DAYS;
		}

		if ( is_array( $block ) && ! empty( $block['date_range_enabled'] ) && ! empty( $block['date_range'] ) ) {
			return (string) $block['date_range'];
		}

		return $effective_range;
	}

	/**
	 * Get the fixed end date for a block or report.
	 *
	 * Ported from the React wizard's getFixedEndDate logic.
	 *
	 * @param array<string, mixed>|string|null $block               The block array or block id string.
	 * @param Report                           $report              The report instance.
	 * @param int|null                         $reference_timestamp Optional reference timestamp.
	 * @return string The fixed end date string (Y-m-d).
	 */
	public static function get_fixed_end_date( array|string|null $block, Report $report, ?int $reference_timestamp = null ): string {
		if ( is_array( $block ) && ! empty( $block['date_range_enabled'] ) ) {
			if ( ! empty( $block['fixed_end_date'] ) ) {
				return (string) $block['fixed_end_date'];
			}
			if ( ! empty( $block['date_range'] ) ) {
				return self::parse_date_range_end( (string) $block['date_range'], $reference_timestamp );
			}
		}

		if ( empty( $report->fixed_end_date ) ) {
			$range = ! empty( $report->date_range ) ? $report->date_range : self::DEFAULT;
			return self::parse_date_range_end( $range, $reference_timestamp );
		}

		return $report->fixed_end_date;
	}

	/**
	 * Find the most recent weekday occurrence at or before a reference timestamp.
	 *
	 * @param string $day_of_week         Day of the week (e.g. 'monday').
	 * @param int    $reference_timestamp Reference unix timestamp.
	 * @return int Unix timestamp of midnight of that day.
	 */
	public static function find_last_weekday_occurrence( string $day_of_week, int $reference_timestamp ): int {
		$target_day = match ( strtolower( $day_of_week ) ) {
			'sunday'    => 0,
			'monday'    => 1,
			'tuesday'   => 2,
			'wednesday' => 3,
			'thursday'  => 4,
			'friday'    => 5,
			'saturday'  => 6,
			default     => 1,
		};

		$current = (int) strtotime( 'today', $reference_timestamp );
		while ( (int) gmdate( 'w', $current ) !== $target_day ) {
			$current = (int) strtotime( '-1 day', $current );
		}

		return $current;
	}

	/**
	 * Find the most recent monthly weekday occurrence (e.g. 1st Monday, last Friday).
	 *
	 * @param string $day_of_week         Day of the week (e.g. 'monday').
	 * @param int    $ordinal             1-4 for 1st-4th occurrence, -1 for last occurrence.
	 * @param int    $reference_timestamp Reference unix timestamp.
	 * @return int Unix timestamp of midnight of that day.
	 */
	public static function find_last_monthly_occurrence( string $day_of_week, int $ordinal, int $reference_timestamp ): int {
		$target_day = match ( strtolower( $day_of_week ) ) {
			'sunday'    => 0,
			'monday'    => 1,
			'tuesday'   => 2,
			'wednesday' => 3,
			'thursday'  => 4,
			'friday'    => 5,
			'saturday'  => 6,
			default     => 1,
		};

		$ref_zero   = (int) strtotime( 'today', $reference_timestamp );
		$base_year  = (int) gmdate( 'Y', $ref_zero );
		$base_month = (int) gmdate( 'n', $ref_zero );

		for ( $month_offset = 0; $month_offset < 12; $month_offset++ ) {
			$m = $base_month - $month_offset;
			$y = $base_year;
			while ( $m < 1 ) {
				$m += 12;
				--$y;
			}

			$days_in_month = (int) gmdate( 't', (int) gmmktime( 0, 0, 0, $m, 1, $y ) );
			$occurrences   = [];

			for ( $day = 1; $day <= $days_in_month; $day++ ) {
				$ts = (int) gmmktime( 0, 0, 0, $m, $day, $y );
				if ( (int) gmdate( 'w', $ts ) === $target_day ) {
					$occurrences[] = $ts;
				}
			}

			if ( ! empty( $occurrences ) ) {
				if ( -1 === $ordinal ) {
					$target = end( $occurrences );
				} else {
					$index  = $ordinal - 1;
					$target = $occurrences[ $index ] ?? null;
				}

				if ( null !== $target && $target <= $ref_zero ) {
					return $target;
				}
			}
		}

		return $ref_zero;
	}

	/**
	 * Parse end date from a preset range key or custom range string.
	 *
	 * @param string   $range               Range string.
	 * @param int|null $reference_timestamp Reference timestamp.
	 * @return string Y-m-d format date string.
	 */
	public static function parse_date_range_end( string $range, ?int $reference_timestamp = null ): string {
		if ( str_starts_with( $range, self::CUSTOM . ':' ) ) {
			$custom = self::parse_custom_range( $range );
			if ( null !== $custom ) {
				return $custom['end'];
			}
		}

		$ref = $reference_timestamp ?? time();
		switch ( $range ) {
			case self::YESTERDAY:
			case self::LAST_7_DAYS:
			case self::LAST_30_DAYS:
			case self::LAST_90_DAYS:
				return gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
			case self::LAST_WEEK:
				$w = (int) gmdate( 'w', $ref );
				return gmdate( 'Y-m-d', (int) strtotime( '-' . ( $w + 1 ) . ' days', $ref ) );
			case self::LAST_MONTH:
				return gmdate( 'Y-m-t', (int) strtotime( 'last month', $ref ) );
			case self::LAST_YEAR:
				$prev_year = (int) gmdate( 'Y', $ref ) - 1;
				return "$prev_year-12-31";
			default:
				return gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
		}
	}

	/**
	 * Get the resolved end date for a block or report.
	 *
	 * Ported from the React wizard's getEndDate logic.
	 *
	 * @param array<string, mixed>|string|null $block               The block array or block id string.
	 * @param Report                           $report              The report instance.
	 * @param int|null                         $reference_timestamp Optional reference timestamp.
	 * @return string The resolved end date string (Y-m-d).
	 */
	public static function get_end_date( array|string|null $block, Report $report, ?int $reference_timestamp = null ): string {
		if ( ! $report->scheduled ) {
			return self::get_fixed_end_date( $block, $report, $reference_timestamp );
		}

		$ref       = $reference_timestamp ?? time();
		$frequency = ! empty( $report->frequency ) ? $report->frequency : Report_Frequency::WEEKLY;

		if ( Report_Frequency::WEEKLY === $frequency ) {
			if ( ! empty( $report->day_of_week ) ) {
				$last_occ = self::find_last_weekday_occurrence( $report->day_of_week, $ref );
				return gmdate( 'Y-m-d', (int) strtotime( '-1 day', $last_occ ) );
			}
			return gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
		}

		if ( Report_Frequency::MONTHLY === $frequency ) {
			if ( ! empty( $report->day_of_week ) && null !== $report->week_of_month ) {
				$last_occ = self::find_last_monthly_occurrence( $report->day_of_week, $report->week_of_month, $ref );
				return gmdate( 'Y-m-d', (int) strtotime( '-1 day', $last_occ ) );
			}
			return gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
		}

		return gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
	}

	/**
	 * Get the resolved start date for a block or report.
	 *
	 * Ported from the React wizard's getStartDate logic.
	 *
	 * @param array<string, mixed>|string|null $block               The block array or block id string.
	 * @param Report                           $report              The report instance.
	 * @param int|null                         $reference_timestamp Optional reference timestamp.
	 * @return string The resolved start date string (Y-m-d).
	 */
	public static function get_start_date( array|string|null $block, Report $report, ?int $reference_timestamp = null ): string {
		$end_date   = self::get_end_date( $block, $report, $reference_timestamp );
		$date_range = self::get_date_range( $block, $report );

		if ( empty( $end_date ) ) {
			$ref      = $reference_timestamp ?? time();
			$end_date = gmdate( 'Y-m-d', (int) strtotime( 'yesterday', $ref ) );
		}

		if ( str_starts_with( $date_range, self::CUSTOM . ':' ) ) {
			$custom = self::parse_custom_range( $date_range );
			if ( null !== $custom ) {
				return $custom['start'];
			}
		}

		$end_ts = (int) strtotime( $end_date );

		switch ( $date_range ) {
			case self::YESTERDAY:
				return $end_date;
			case self::LAST_WEEK:
			case self::LAST_7_DAYS:
				return gmdate( 'Y-m-d', (int) strtotime( '-6 days', $end_ts ) );
			case self::LAST_30_DAYS:
				return gmdate( 'Y-m-d', (int) strtotime( '-29 days', $end_ts ) );
			case self::LAST_90_DAYS:
				return gmdate( 'Y-m-d', (int) strtotime( '-89 days', $end_ts ) );
			case self::LAST_YEAR:
				return gmdate( 'Y-m-d', (int) strtotime( '-364 days', $end_ts ) );
			case self::LAST_MONTH:
				return gmdate( 'Y-m-d', (int) strtotime( '-1 month', $end_ts ) );
			default:
				return gmdate( 'Y-m-d', (int) strtotime( '-6 days', $end_ts ) );
		}
	}

	/**
	 * Resolve start and end dates and unix timestamps for a block or report.
	 *
	 * @param array<string, mixed>|string|null $block               The block array or block id string.
	 * @param Report                           $report              The report instance.
	 * @param int|null                         $reference_timestamp Optional reference timestamp.
	 * @return array{start_date: string, end_date: string, start: int, end: int, start_nice: string, end_nice: string}
	 */
	public static function resolve_block_dates( array|string|null $block, Report $report, ?int $reference_timestamp = null ): array {
		$start_date = self::get_start_date( $block, $report, $reference_timestamp );
		$end_date   = self::get_end_date( $block, $report, $reference_timestamp );

		$start_unix = (int) strtotime( $start_date . ' 00:00:00' );
		$end_unix   = (int) strtotime( $end_date . ' 23:59:59' );

		return [
			'start_date' => $start_date,
			'end_date'   => $end_date,
			'start'      => $start_unix,
			'end'        => $end_unix,
			'start_nice' => date_i18n( (string) get_option( 'date_format' ), $start_unix ),
			'end_nice'   => date_i18n( (string) get_option( 'date_format' ), $end_unix ),
		];
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {
	}
}
