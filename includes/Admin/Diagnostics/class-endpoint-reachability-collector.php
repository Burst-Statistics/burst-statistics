<?php
/**
 * Endpoint-reachability diagnostic collector.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

use Burst\Frontend\Endpoint;

defined( 'ABSPATH' ) || exit;

/**
 * Class Endpoint_Reachability_Collector
 *
 * Reuses the existing tracking-endpoint probe as an explanation only: if the
 * endpoint cannot be reached, hits cannot be recorded.
 */
class Endpoint_Reachability_Collector extends Diagnostic_Collector {

	/**
	 * {@inheritDoc}
	 */
	public function key(): string {
		return 'endpoint_reachability';
	}

	/**
	 * {@inheritDoc}
	 */
	public function collect(): array {
		$label    = __( 'Tracking endpoint reachability', 'burst-statistics' );
		$tracking = Endpoint::get_tracking_status_and_time();
		$status   = $tracking['status'] ?? 'error';
		$details  = [
			'probe_status' => $status,
			'last_test'    => $tracking['last_test'] ?? 0,
		];

		if ( 'beacon' === $status || 'rest' === $status ) {
			return $this->result(
				'ok',
				$label,
				__( 'The tracking endpoint responded successfully to a test request.', 'burst-statistics' ),
				$details
			);
		}

		if ( 'disabled' === $status ) {
			return $this->result(
				'skipped',
				$label,
				__( 'Tracking is disabled, so the endpoint was not tested.', 'burst-statistics' ),
				$details
			);
		}

		return $this->result(
			'critical',
			$label,
			__( 'The tracking endpoint did not respond to a test request, which prevents hits from being recorded.', 'burst-statistics' ),
			$details
		);
	}
}
