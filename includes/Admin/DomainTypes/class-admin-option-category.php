<?php
namespace Burst\Admin\DomainTypes;

defined( 'ABSPATH' ) || exit;

/**
 * Categories used by the backend-only admin option store. Each category is one
 * non-autoloaded wp_options row, so a value only earns its own category when it
 * is large or written on a hot path; everything small and rarely written shares
 * CORE. Pro categories live here too: a shared constant cannot reference a Pro
 * class, which does not exist in free.
 */
final class Admin_Option_Category {
	public const CORE        = 'core';
	public const DIAGNOSTICS = 'diagnostics';
	// The collector output: large, and the diagnostics timestamps beside it are
	// written on every settings save.
	public const DIAGNOSTIC_RUN = 'diagnostic_run';
	public const NOTIFICATIONS  = 'notifications';
	public const TASKS          = 'tasks';
	public const LANGUAGES      = 'languages';
	public const QUICK_WINS     = 'quick_wins';
	public const ANOMALY        = 'anomaly';

	/** All categories. */
	public const ALL = [
		self::CORE,
		self::DIAGNOSTICS,
		self::DIAGNOSTIC_RUN,
		self::NOTIFICATIONS,
		self::TASKS,
		self::LANGUAGES,
		self::QUICK_WINS,
		self::ANOMALY,
	];

	/**
	 * Get every category.
	 *
	 * @return string[] Category names.
	 */
	public static function all(): array {
		return self::ALL;
	}

	/**
	 * Private constructor to prevent instantiation.
	 */
	private function __construct() {}
}
