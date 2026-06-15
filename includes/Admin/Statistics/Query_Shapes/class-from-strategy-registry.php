<?php
/**
 * Registry for FROM strategy implementations.
 *
 * @package Burst\Admin\Statistics\Query_Shapes
 */
namespace Burst\Admin\Statistics\Query_Shapes;

defined( 'ABSPATH' ) || die();

/**
 * Class From_Strategy_Registry - Maps query IDs to From_Strategy_Interface instances.
 */
class From_Strategy_Registry {
	/**
	 * Map of query ID => strategy instance.
	 *
	 * @var array<string, From_Strategy_Interface>
	 */
	private static array $map = [];

	/**
	 * Register a strategy for one or more query IDs.
	 *
	 * @param string[]                $ids      Query IDs handled by this strategy.
	 * @param From_Strategy_Interface $strategy The strategy instance.
	 */
	public static function register( array $ids, From_Strategy_Interface $strategy ): void {
		foreach ( $ids as $id ) {
			self::$map[ $id ] = $strategy;
		}
	}

	/**
	 * Resolve a strategy by query ID, or null if none registered.
	 *
	 * @param string $id Query ID.
	 */
	public static function resolve( string $id ): ?From_Strategy_Interface {
		return self::$map[ $id ] ?? null;
	}
}
