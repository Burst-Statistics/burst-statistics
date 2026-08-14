<?php
/**
 * Base class for tracking diagnostic collectors.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Diagnostic_Collector
 *
 * A collector runs one independent check that helps explain why tracking dropped
 * and returns a structured result object. Collectors are decoupled: each can be
 * instantiated and tested on its own, and each returns a 'skipped' result rather
 * than throwing when its check does not apply.
 */
abstract class Diagnostic_Collector {

	/**
	 * Stable identifier for this collector.
	 */
	abstract public function key(): string;

	/**
	 * Run the check and return its result object, or an empty array when the
	 * collector has nothing to report (e.g. the check does not apply to this
	 * environment) — the runner skips empty results.
	 *
	 * @return array{key: string, status: string, label: string, summary: string, details: array}|array{}
	 */
	abstract public function collect(): array;

	/**
	 * Build a standard result object.
	 *
	 * @param string $status  One of 'ok', 'warning', 'critical', 'skipped'.
	 * @param string $label   Human-readable name of the check.
	 * @param string $summary One-line explanation for the summary email.
	 * @param array  $details Structured specifics for the check.
	 * @return array{key: string, status: string, label: string, summary: string, details: array}
	 */
	protected function result( string $status, string $label, string $summary, array $details = [] ): array {
		return [
			'key'     => $this->key(),
			'status'  => $status,
			'label'   => $label,
			'summary' => $summary,
			'details' => $details,
		];
	}

	/**
	 * Active plugin basenames, including network-activated ones.
	 *
	 * Read from options so it works on the cron path without loading
	 * wp-admin/includes/plugin.php.
	 *
	 * @return string[]
	 */
	protected function active_plugins(): array {
		$active  = (array) get_option( 'active_plugins', [] );
		$network = is_multisite() ? array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) ) : [];

		return array_values( array_unique( array_merge( $active, $network ) ) );
	}
}
