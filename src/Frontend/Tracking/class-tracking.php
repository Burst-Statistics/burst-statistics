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
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Ip\Ip;
use Burst\Traits\Helper;

// require_once BURST_PATH . 'helpers/php-user-agent/UserAgentParser.php';
// use function Burst\UserAgent\parse_user_agent;
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


	/**
	 * Checks if a specified goal is completed based on the provided page URL.
	 *
	 * @param int    $goal_id The ID of the goal to check.
	 * @param string $page_url The current page URL.
	 * @return bool Returns true if the goal is completed, false otherwise.
	 */
	public function goal_is_completed( int $goal_id, string $page_url ): bool {
		$goal = new Goal( $goal_id );

		// Check if the goal and page URL are properly set.
		if ( empty( $goal->type ) || empty( $goal->url ) || empty( $page_url ) ) {
			return false;
		}

		switch ( $goal->type ) {
			case 'visits':
				// Improved URL comparison logic could go here.
				// @TODO: Maybe add support for * and ? wildcards?.
				if ( rtrim( $page_url, '/' ) === rtrim( $goal->url, '/' ) ) {
					return true;
				}
				break;
			// @todo Add more case statements for other types of goals.

			default:
				return false;
		}

		return false;
	}

	/**
	 * Get completed goals by combining client-side and server-side results.
	 *
	 * @param array<int> $completed_client_goals Array of goal IDs completed on the client.
	 * @param string     $page_url               Page URL used to verify server-side goal completion.
	 * @return array<int> List of completed goal IDs.
	 */
	public function get_completed_goals( array $completed_client_goals, string $page_url ): array {
		$completed_server_goals = [];
		$server_goals           = $this->get_active_goals( true );
		// if server side goals exist.
		if ( count( $server_goals ) > 0 ) {
			// loop through server side goals.
			foreach ( $server_goals as $goal ) {
				// if goal is completed.
				if ( $this->goal_is_completed( $goal['ID'], $page_url ) ) {
					// add goal id to completed goals array.
					$completed_server_goals[] = $goal['ID'];
				}
			}
		}

		// merge completed client goals and completed server goals.
		return array_merge( $completed_client_goals, $completed_server_goals );
	}

	/**
	 * Get user agent data
	 *
	 * @param string $user_agent The User Agent.
	 * @return null[]|string[]
	 */
	public function get_user_agent_data( string $user_agent ): array {
		$defaults = [
			'browser'         => '',
			'browser_version' => '',
			'platform'        => '',
			'device'          => '',
		];
		if ( $user_agent === '' ) {
			return $defaults;
		}

		$ua = parse_user_agent( $user_agent );

		switch ( $ua['platform'] ) {
			case 'Macintosh':
			case 'Chrome OS':
			case 'Linux':
			case 'Windows':
				$ua['device'] = 'desktop';
				break;
			case 'Android':
			case 'BlackBerry':
			case 'iPhone':
			case 'Windows Phone':
			case 'Sailfish':
			case 'Symbian':
			case 'Tizen':
				$ua['device'] = 'mobile';
				break;
			case 'iPad':
				$ua['device'] = 'tablet';
				break;
			case 'PlayStation 3':
			case 'PlayStation 4':
			case 'PlayStation 5':
			case 'PlayStation Vita':
			case 'Xbox':
			case 'Xbox One':
			case 'New Nintendo 3DS':
			case 'Nintendo 3DS':
			case 'Nintendo DS':
			case 'Nintendo Switch':
			case 'Nintendo Wii':
			case 'Nintendo WiiU':
			case 'iPod':
			case 'Kindle':
			case 'Kindle Fire':
			case 'NetBSD':
			case 'OpenBSD':
			case 'PlayBook':
			case 'FreeBSD':
			default:
				$ua['device'] = 'other';
				break;
		}

		// change version to browser_version.
		$ua['browser_version'] = $ua['version'];
		unset( $ua['version'] );

		return wp_parse_args( $ua, $defaults );
	}

	/**
	 * Get first time visit
	 */
	public function is_first_time_visit( string $burst_uid ): int {
		global $wpdb;
		// Check if uid is already in the database.
		$sql                = $wpdb->prepare(
			"SELECT EXISTS(SELECT 1 FROM {$wpdb->prefix}burst_statistics WHERE uid = %s LIMIT 1)",
			$burst_uid,
		);
		$fingerprint_exists = $wpdb->get_var( $sql );

		return $fingerprint_exists ? 0 : 1;
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
		global $wpdb;
		// if fingerprint is send get the last user statistic with the same fingerprint.
		if ( strlen( $uid ) === 0 ) {
			return [];
		}
		$where = '';
		if ( $page_url !== '' ) {
			$destructured_url = $this->sanitize_url( $page_url );
			$parameters       = $destructured_url['parameters'];
			$where            = ! empty( $parameters ) ? $wpdb->prepare( ' AND parameters = %s', $parameters ) : '';
		}

		$where .= $wpdb->prepare( ' AND time > %d', strtotime( '-30 minutes' ) );

		$data = $wpdb->get_row(
			$wpdb->prepare(
				"select ID, session_id, parameters, time_on_page, bounce, page_url
				from {$wpdb->prefix}burst_statistics
				where uid = %s $where ORDER BY ID DESC limit 1",
				$uid,
			)
		);

		return $data ? (array) $data : [];
	}

	/**
	 * Create session in {prefix}_burst_sessions
	 */
	public function create_session( array $data ): int {
		global $wpdb;
		$data = $this->remove_empty_values( $data );
		$wpdb->insert(
			$wpdb->prefix . 'burst_sessions',
			$data
		);

		if ( $wpdb->last_error ) {
			self::error_log( 'Failed to create session. Error: ' . $wpdb->last_error );
			return 0;
		}

		return $wpdb->insert_id;
	}

	/**
	 * Update session in {prefix}_burst_sessions
	 *
	 * @param int   $session_id The session ID to update.
	 * @param array $data Data to update in the session.
	 * @return bool True on success, false on failure.
	 */
	public function update_session( int $session_id, array $data ): bool {
		global $wpdb;

		// Remove empty values from the data array.
		$data = $this->remove_empty_values( $data );
		// Perform the update operation.
		$result = $wpdb->update(
			$wpdb->prefix . 'burst_sessions',
			$data,
			[ 'ID' => $session_id ]
		);

		return $result !== false;
	}

	/**
	 * Create a statistic in {prefix}_burst_statistics
	 *
	 * @param array $data Data to insert.
	 * @return int The newly created statistic ID on success, or false on failure.
	 */
	public function create_statistic( array $data ): int {
		global $wpdb;
		$data = $this->remove_empty_values( $data );

		if ( ! $this->required_values_set( $data ) ) {
            // phpcs:ignore
			self::error_log( 'Missing required values for statistic creation. Data: ' . print_r( $data, true ) );
			return 0;
		}

		$inserted = $wpdb->insert( $wpdb->prefix . 'burst_statistics', $data );

		if ( $inserted ) {
			return $wpdb->insert_id;
		} else {
			self::error_log( 'Failed to create statistic. Error: ' . $wpdb->last_error );
			return 0;
		}
	}

	/**
	 * Update a statistic in {prefix}_burst_statistics
	 *
	 * @param array $data Data to update, must include 'ID' for the statistic.
	 * @return bool True on success, false on failure.
	 */
	public function update_statistic( array $data ): bool {
		global $wpdb;
		$data = $this->remove_empty_values( $data );

		// Ensure 'ID' is present for update.
		if ( ! isset( $data['ID'] ) ) {
            // phpcs:ignore
			self::error_log( 'Missing ID for statistic update. Data: ' . print_r( $data, true ) );
			return false;
		}

		$updated = $wpdb->update( $wpdb->prefix . 'burst_statistics', $data, [ 'ID' => (int) $data['ID'] ] );

		if ( $updated === false ) {
			self::error_log( 'Failed to update statistic. Error: ' . $wpdb->last_error );
			return false;
		}

		return $updated > 0;
	}

	/**
	 * Create goal statistic in {prefix}_burst_goal_statistics
	 */
	public function create_goal_statistic( array $data ): void {
		global $wpdb;
		// do not create goal statistic if statistic_id or goal_id is not set.
		if ( ! isset( $data['statistic_id'] ) || ! isset( $data['goal_id'] ) ) {
			return;
		}
		// first get row with same statistics_id and goal_id.
		// check if goals already exists.
		$goal_exists = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM {$wpdb->prefix}burst_goal_statistics WHERE statistic_id = %d AND goal_id = %d LIMIT 1",
				$data['statistic_id'],
				$data['goal_id']
			)
		);

		// goal already exists.
		if ( $goal_exists ) {
			return;
		}
		$wpdb->insert(
			$wpdb->prefix . 'burst_goal_statistics',
			$data
		);
	}

	/**
	 * Sets the bounce flag to 0 for all hits within a session.
	 *
	 * @param int $session_id The ID of the session.
	 * @return bool True on success, false on failure.
	 */
	public function set_bounce_for_session( int $session_id ): bool {
		global $wpdb;

		// Prepare table name to ensure it's properly quoted.
		$table_name = $wpdb->prefix . 'burst_statistics';

		// Update query.
		$result = $wpdb->update(
			$table_name,
			// data.
			[ 'bounce' => 0 ],
			// where.
			[ 'session_id' => $session_id ]
		);

		// Check for errors.
		if ( $result === false ) {
			// Handle error, log it or take other actions.
			self::error_log( 'Error setting bounce to 0 for session ' . $session_id );
			return false;
		}

		return true;
	}

	/**
	 * Remove null, empty, and specific values from an array.
	 *
	 * Skips removal for the 'parameters' key. Also unsets 'host' and 'completed_goals'.
	 *
	 * @param array<string, mixed> $data Input associative array of values.
	 * @return array<string, mixed> Filtered associative array.
	 */
	public function remove_empty_values( array $data ): array {
		foreach ( $data as $key => $value ) {
			if ( $key === 'parameters' ) {
				continue;
			}

			if ( $value === null || $value === '' ) {
				unset( $data[ $key ] );
			}

			if ( strpos( $key, '_id' ) !== false && $value === 0 ) {
				unset( $data[ $key ] );
			}
		}
		unset( $data['host'] );
		unset( $data['completed_goals'] );
		return $data;
	}


	/**
	 * Store fingerprint in PHP session.
	 *
	 * @param string $fingerprint The fingerprint to store.
	 * @return bool True on success, false on failure.
	 */
	public function store_fingerprint_in_session( string $fingerprint ): bool {
		if ( session_status() === PHP_SESSION_NONE ) {
			session_start();
		}

		$_SESSION['burst_fingerprint'] = $this->sanitize_fingerprint( $fingerprint );

		return true;
	}

	/**
	 * Retrieve fingerprint from PHP session.
	 *
	 * @return string The stored fingerprint or empty string if not found.
	 */
	public function get_fingerprint_from_session(): string {
		if ( session_status() === PHP_SESSION_NONE ) {
			session_start();
		}
		$fingerprint = $_SESSION['burst_fingerprint'] ?? '';
		return $this->sanitize_fingerprint( $fingerprint );
	}

	/**
	 * Check if required values are set
	 */
	public function required_values_set( array $data ): bool {
		return (
			isset( $data['uid'] ) &&
			isset( $data['page_url'] ) &&
			isset( $data['parameters'] )
		);
	}
}
