<?php
/**
 * Burst Tracking class
 *
 * @package Burst
 */

namespace Burst\Frontend\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

use Burst\Frontend\Endpoint;
use Burst\Traits\Helper;

class Tracking {
	use Helper;

	public string $beacon_enabled;
	public array $goals = [];

	/**
	 * Get tracking options for localize_script and burst.js integration.
	 *
	 * @return array{
	 *     tracking: array{
	 *         isInitialHit: bool,
	 *         lastUpdateTimestamp: int,
	 *         beacon_url: string
	 *     },
	 *     options: array{
	 *         cookieless: int,
	 *         pageUrl: string,
	 *         beacon_enabled: int,
	 *         do_not_track: int,
	 *         enable_turbo_mode: int,
	 *         track_url_change: int,
	 *         cookie_retention_days: int
	 *     },
	 *     goals: array{
	 *         completed: array<mixed>,
	 *         scriptUrl: string,
	 *         active: array<array<string, mixed>>
	 *     },
	 *     cache: array{
	 *         uid: string|null,
	 *         fingerprint: string|null,
	 *         isUserAgent: string|null,
	 *         isDoNotTrack: bool|null,
	 *         useCookies: bool|null
	 *     }
	 * }
	 */
	public function get_options(): array {
		$script_version = filemtime( BURST_PATH . '/assets/js/build/burst-goals.js' );
		return apply_filters(
			'burst_tracking_options',
			[
				'tracking' => [
					'isInitialHit'        => true,
					'lastUpdateTimestamp' => 0,
					'beacon_url'          => self::get_beacon_url(),
					'ajaxUrl'             => admin_url( 'admin-ajax.php' ),
				],
				'options'  => [
					'cookieless'            => $this->get_option_int( 'enable_cookieless_tracking' ),
					'pageUrl'               => get_permalink(),
					'beacon_enabled'        => (int) $this->beacon_enabled(),
					'do_not_track'          => $this->get_option_int( 'enable_do_not_track' ),
					'enable_turbo_mode'     => $this->get_option_int( 'enable_turbo_mode' ),
					'track_url_change'      => $this->get_option_int( 'track_url_change' ),
					'cookie_retention_days' => apply_filters( 'burst_cookie_retention_days', 30 ),
					'debug'                 => defined( 'BURST_DEBUG' ) && BURST_DEBUG ? 1 : 0,
				],
				'goals'    => [
					'completed' => [],
					'scriptUrl' => apply_filters( 'burst_goals_script_url', BURST_URL . '/assets/js/build/burst-goals.js?v=' . $script_version ),
					'active'    => $this->get_active_goals( false ),
				],
				'cache'    => [
					'uid'          => null,
					'fingerprint'  => null,
					'isUserAgent'  => null,
					'isDoNotTrack' => null,
					'useCookies'   => null,
				],
			]
		);
	}

	/**
	 * Check if status is beacon
	 */
	public function beacon_enabled(): bool {
		if ( empty( $this->beacon_enabled ) ) {
			$this->beacon_enabled = Endpoint::get_tracking_status() === 'beacon' ? 'true' : 'false';
		}
		return $this->beacon_enabled === 'true';
	}

	/**
	 * Get all active goals from the database with single query + cached result.
	 *
	 * @param bool $server_side Whether to return server-side goals only.
	 * @return array<array<string, mixed>> Filtered list of active goals.
	 */
	public function get_active_goals( bool $server_side ): array {
		// Prevent queries during install.
		if ( defined( 'BURST_INSTALL_TABLES_RUNNING' ) ) {
			return [];
		}

		// Reuse per-scope cache if we already computed it this request.
		$scope = $server_side ? 'server_side' : 'client_side';
		if ( isset( $this->goals[ $scope ] ) ) {
			return $this->goals[ $scope ];
		}

		// Get full active goals list from in-memory or object cache.
		if ( isset( $this->goals['all'] ) ) {
			$all_goals = $this->goals['all'];
		} else {
			$all_goals = wp_cache_get( 'burst_active_goals_all', 'burst' );
			if ( ! $all_goals ) {
				global $wpdb;
				// Single query: fetch ALL active goals (no type condition).
				$all_goals = $wpdb->get_results(
					"SELECT * FROM {$wpdb->prefix}burst_goals WHERE status = 'active'",
					ARRAY_A
				);
				// Cache full set for reuse across calls.
				wp_cache_set( 'burst_active_goals_all', $all_goals, 'burst', 60 );
			}
			// Memoize for this request.
			$this->goals['all'] = $all_goals;
		}

		// Filter in PHP to avoid a second DB roundtrip.
		$filtered = array_values(
			array_filter(
				$all_goals,
				static function ( array $goal ) use ( $server_side ): bool {
					$server_side_types = [ 'visits', 'hook' ];
					$type              = $goal['type'] ?? '';
					return $server_side
						? in_array( $type, $server_side_types, true )
						: ! in_array( $type, $server_side_types, true );
				}
			)
		);

		// Memoize filtered results.
		$this->goals[ $scope ] = $filtered;

		return $filtered;
	}
}
