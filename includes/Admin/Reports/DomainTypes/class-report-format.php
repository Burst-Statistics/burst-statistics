<?php
namespace Burst\Admin\Reports\DomainTypes;

defined( 'ABSPATH' ) || exit;

final class Report_Format {
	/**
	 * Classic format for reports.
	 */
	public const CLASSIC = 'classic';

	/**
	 * STORY format for reports.
	 */
	public const STORY = 'story';

	/**
	 * Default format for reports.
	 */
	public const DEFAULT = self::CLASSIC;

	/**
	 * Creates a Report_Format from a string.
	 *
	 * @param string $format The format as a string.
	 * @return string The valid format or the default if invalid.
	 */
	public static function from_string( string $format ): string {
		$valid_formats = self::all();
		return in_array( $format, $valid_formats, true )
			? $format
			: self::DEFAULT;
	}

	/**
	 * Gets the default report format.
	 *
	 * @return string The default report format.
	 */
	public static function default(): string {
		return self::DEFAULT;
	}

	/**
	 * Gets all valid report formats.
	 *
	 * @return string[] Array of all valid report formats.
	 */
	public static function all(): array {
		$formats = [ self::CLASSIC ];

		return apply_filters( 'burst_report_formats', $formats );
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
