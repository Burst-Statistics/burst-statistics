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
		return [];
	}

	/**
	 * Check if status is beacon
	 */
	public function beacon_enabled(): bool {
		return true;
	}

	/**
	 * Get all active goals from the database with single query + cached result.
	 *
	 * @param bool $server_side Whether to return server-side goals only.
	 * @return array<array<string, mixed>> Filtered list of active goals.
	 */
	public function get_active_goals( bool $server_side ): array {
		return [];
	}

	/**
	 * Get user agent data
	 *
	 * @param string $user_agent The User Agent.
	 * @return null[]|string[]
	 */
	public function get_user_agent_data( string $user_agent ): array {
		return [];
	}

	/**
	 * Get last user statistic from the burst_statistics table.
	 *
	 * @param string $uid         The user identifier or fingerprint.
	 * @param string $page_url    Optional. Specific page URL to narrow down the result.
	 * @return array{
	 *     ID?: int,
	 *     session_id?: int,
	 *     parameters?: string,
	 *     time_on_page?: int,
	 *     bounce?: int,
	 *     page_url?: string
	 * } Associative array of the last user statistic, or empty array if none found.
	 */
	public function get_last_user_statistic( string $uid, string $page_url = '' ): array {
		return [];
	}

	/**
	 * Create session in {prefix}_burst_sessions
	 */
	public function create_session( array $data ): int {
		return 0;
	}

	/**
	 * Update session in {prefix}_burst_sessions
	 *
	 * @param int   $session_id The session ID to update.
	 * @param array $data Data to update in the session.
	 * @return bool True on success, false on failure.
	 */
	public function update_session( int $session_id, array $data ): bool {
		return false;
	}

	/**
	 * Create a statistic in {prefix}_burst_statistics
	 *
	 * @param array $data Data to insert.
	 * @return int The newly created statistic ID on success, or false on failure.
	 */
	public function create_statistic( array $data ): int {
		return 0;
	}

	/**
	 * Create goal statistic in {prefix}_burst_goal_statistics
	 */
	public function create_goal_statistic( array $data ): void {}

	/**
	 * Sets the bounce flag to 0 for all hits within a session.
	 *
	 * @param int $session_id The ID of the session.
	 * @return bool True on success, false on failure.
	 */
	public function set_bounce_for_session( int $session_id ): bool {
		return true;
	}

	/**
	 * Retrieve fingerprint from PHP session.
	 *
	 * @return string The stored fingerprint or empty string if not found.
	 */
	public function get_fingerprint_from_session(): string {
		return '';
	}
}
