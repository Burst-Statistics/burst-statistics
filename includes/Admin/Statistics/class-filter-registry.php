<?php
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Static registry for filter key → qualified SQL column mappings used by Statistics_Query.
 *
 * Free-tier filters are registered in Metric_Bootstrap::register_filters().
 * Pro filters are registered in Pro\Admin\Statistics\Statistics::register_filters().
 */
class Filter_Registry {

	/**
	 * Filter key to qualified SQL column map.
	 *
	 * @var array<string, string>
	 */
	private static array $filters = [];

	/**
	 * Register a filter key mapped to a qualified SQL column (e.g. 'sessions.browser_id').
	 *
	 * @param string $key    Filter key as sent from the frontend.
	 * @param string $column Qualified SQL column reference.
	 */
	public static function register( string $key, string $column ): void {
		self::$filters[ $key ] = $column;
	}

	/**
	 * Return all registered filter mappings.
	 *
	 * @return array<string, string>
	 */
	public static function all(): array {
		return self::$filters;
	}

	/**
	 * Reset all registrations. Used in tests.
	 */
	public static function reset(): void {
		self::$filters = [];
	}
}
