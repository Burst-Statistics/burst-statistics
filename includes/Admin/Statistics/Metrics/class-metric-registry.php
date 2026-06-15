<?php
/**
 * Registry for metric handler instances.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

defined( 'ABSPATH' ) || die();

/**
 * Class Metric_Registry - Static registry mapping metric keys to handler instances.
 */
class Metric_Registry {
	/**
	 * Registered metric handlers.
	 *
	 * @var array<string, Metric_Handler_Interface> $handlers
	 */
	private static array $handlers = [];

	/**
	 * Register a metric handler.
	 *
	 * @param Metric_Handler_Interface $handler The handler to register.
	 */
	public static function register( Metric_Handler_Interface $handler ): void {
		self::$handlers[ $handler->key() ] = $handler;
	}

	/**
	 * Retrieve a handler by metric key.
	 *
	 * @param string $key The metric key.
	 */
	public static function get( string $key ): ?Metric_Handler_Interface {
		return self::$handlers[ $key ] ?? null;
	}

	/**
	 * Return all registered handlers.
	 *
	 * @return array<string, Metric_Handler_Interface>
	 */
	public static function all(): array {
		return self::$handlers;
	}
}
