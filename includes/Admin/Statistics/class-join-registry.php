<?php
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Static registry for named JOIN definitions used by Statistics_Query.
 *
 * Free-tier joins are registered in Metric_Bootstrap::register_joins().
 * Pro joins are registered in Pro\Admin\Statistics\Statistics::register_joins().
 */
class Join_Registry {

	private static array $joins = [];

	/**
	 * Dynamic join factories keyed by alias.
	 *
	 * @var array<string, callable>
	 */
	private static array $dynamic_joins = [];

	/**
	 * Register a static join (table and ON clause are fixed).
	 *
	 * @param string $key  Alias used in queries (e.g. 'sessions', 'goals').
	 * @param array  $join Keys: table, on, type (INNER|LEFT|RIGHT), depends_on (optional).
	 */
	public static function register( string $key, array $join ): void {
		self::$joins[ $key ] = $join;
	}

	/**
	 * Register a dynamic join whose SQL depends on the query (e.g. date-filtered subqueries).
	 *
	 * @param string   $key     Alias used in queries.
	 * @param callable $factory Receives Statistics_Query, returns a join array.
	 */
	public static function register_dynamic( string $key, callable $factory ): void {
		self::$dynamic_joins[ $key ] = $factory;
	}

	/**
	 * Resolve all registered joins for the given query instance.
	 *
	 * @param Statistics_Query $qd The query being built.
	 * @return array<string, array> Keyed by alias.
	 */
	public static function resolve( Statistics_Query $qd ): array {
		$joins = self::$joins;
		foreach ( self::$dynamic_joins as $key => $factory ) {
			$joins[ $key ] = $factory( $qd );
		}
		return $joins;
	}

	/**
	 * Reset all registrations. Used in tests.
	 */
	public static function reset(): void {
		self::$joins         = [];
		self::$dynamic_joins = [];
	}
}
