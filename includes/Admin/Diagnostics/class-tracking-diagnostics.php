<?php
/**
 * Tracking diagnostics runner.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Tracking_Diagnostics
 *
 * Runs the diagnostic collectors that explain why tracking dropped, but only when
 * the Tracking_Health detector has reported an actual issue. Results are stored
 * for the summary email and exposed via get_results().
 */
class Tracking_Diagnostics {

	/**
	 * Option key holding the last diagnostics run.
	 *
	 * @var string
	 */
	private const OPTION = 'burst_tracking_diagnostics';

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'burst_tracking_health_checked', [ $this, 'maybe_collect' ] );

		// Always-on: record plugin updates and tracking-setting changes so the
		// recent-changes collector can later correlate them with a tracking drop.
		( new Plugin_Update_Log() )->init();
		( new Settings_Change_Log() )->init();
	}

	/**
	 * Run the collectors only when the health detector reports a real issue.
	 *
	 * @param array $health_result The result fired by Tracking_Health.
	 */
	public function maybe_collect( array $health_result ): void {
		if ( ! $this->is_tracking_issue( $health_result ) ) {
			return;
		}

		$results = $this->collect_and_store();

		do_action( 'burst_tracking_diagnostics_collected', $results, $health_result );
	}

	/**
	 * Whether a health result reports an actual tracking issue.
	 *
	 * @param array $health_result A Tracking_Health detection result.
	 */
	private function is_tracking_issue( array $health_result ): bool {
		return in_array( $health_result['status'] ?? 'ok', [ 'down', 'suspect' ], true );
	}

	/**
	 * Run all collectors and persist the results.
	 *
	 * @return array<string, array> Map of collector key => result object.
	 */
	private function collect_and_store(): array {
		$results = $this->run();
		update_option( self::OPTION, $results, false );

		return $results;
	}

	/**
	 * Run every registered collector and return their results keyed by collector id.
	 *
	 * @return array<string, array> Map of collector key => result object.
	 */
	public function run(): array {
		$results = [];
		foreach ( $this->get_collectors() as $collector ) {
			$result = $collector->collect();
			// A collector returns an empty array when it has nothing to report
			// (e.g. a check that does not apply to this environment); skip it.
			if ( ! empty( $result ) ) {
				$results[ $collector->key() ] = $result;
			}
		}

		return $results;
	}

	/**
	 * The diagnostics stored from the last run.
	 *
	 * @return array<string, array>
	 */
	public function get_results(): array {
		return get_option( self::OPTION, [] );
	}

	/**
	 * The collectors to run.
	 *
	 * @return Diagnostic_Collector[]
	 */
	private function get_collectors(): array {
		$collectors = [
			new Htaccess_Collector(),
			new Security_Plugins_Collector(),
			new Consent_Plugins_Collector(),
			new Endpoint_Reachability_Collector(),
			new Recent_Changes_Collector(),
		];

		/**
		 * Filter the diagnostic collectors. Lets extensions register additional
		 * checks without modifying the runner.
		 *
		 * @param Diagnostic_Collector[] $collectors Registered collectors.
		 */
		$collectors = apply_filters( 'burst_tracking_diagnostic_collectors', $collectors );

		return array_filter( $collectors, static fn( $collector ): bool => $collector instanceof Diagnostic_Collector );
	}
}
