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
use Burst\Traits\Sanitize;
use Burst\UserAgentParser\UserAgentParser;

class Tracking {
	use Helper;
	use Sanitize;

	public string $beacon_enabled;
	public array $lookup_table_cache = [];
	public array $goals              = [];
	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'rest_api_init', [ $this, 'register_track_hit_route' ] );
	}

	/**
	 * Register the track hit route
	 */
	public function register_track_hit_route(): void {
		register_rest_route(
			'burst/v1',
			'track',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_track_hit' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	/**
	 * Burst Statistics endpoint for collecting hits
	 */
	public function track_hit( array $data ): string {
		// validate & sanitize all data.
		$sanitized_data        = $this->prepare_tracking_data( $data );
		$should_load_ecommerce = $sanitized_data['should_load_ecommerce'];

		unset( $sanitized_data['should_load_ecommerce'] );

		if ( $sanitized_data['referrer'] === 'spammer' ) {
			self::error_log( 'Referrer spam prevented.' );
			return 'referrer is spam';
		}

		// If new hit, get the last row.
		$result = $this->get_hit_type( $sanitized_data );
		if ( empty( $result ) ) {
			return 'failed to determine hit type';
		}

		// create or update.
		$hit_type = $result['hit_type'];
		// last row. create can also have a last row from the previous hit.
		$previous_hit          = $result['last_row'];
		$filtered_previous_hit = $previous_hit;
		if ( $previous_hit === null ) {
			$filtered_previous_hit = [];
		}
		$sanitized_data = apply_filters( 'burst_before_track_hit', $sanitized_data, $hit_type, $filtered_previous_hit );
		$session_arr    = [
			'last_visited_url' => $this->create_path( $sanitized_data ),
			'city_code'        => $sanitized_data['city_code'] ?? '',
			'referrer'         => $sanitized_data['referrer'],
		];
		unset( $sanitized_data['city_code'], $sanitized_data['referrer'] );

		// keep track of the hosts, to check if this is a multi domain setup.
		$destructured = $this->sanitize_url( $sanitized_data['host'] );
		$host         = $destructured['host'] ?? '';
		// Normalize host by removing www. prefix for comparison.
		$normalized_host = preg_replace( '/^www\./i', '', $host );
		$is_multi_domain = get_option( 'burst_is_multi_domain' );
		if ( ! $is_multi_domain ) {
			$first_domain = get_option( 'burst_first_domain' );
			// only update this once, on the first used domain.
			if ( empty( $first_domain ) ) {
				update_option( 'burst_is_multi_domain', false );
				update_option( 'burst_first_domain', $normalized_host );
			} elseif ( $first_domain !== $normalized_host ) {
				// if it's different from the first used, it is multi domain.
				update_option( 'burst_is_multi_domain', true );
			}
		}

		if ( $this->get_option_bool( 'filtering_by_domain' ) ) {
			$session_arr['host'] = $host;
		}

		// update burst_sessions table.
		// Get the last record with the same uid within 30 minutes. If it exists, use session_id. If not, create a new session.
		if ( isset( $previous_hit ) && $previous_hit['session_id'] > 0 ) {
			$sanitized_data['session_id'] = $previous_hit['session_id'];
			if ( $this->session_needs_update( $previous_hit, $session_arr ) ) {
				$this->update_session( (int) $sanitized_data['session_id'], $session_arr );
			}
		} elseif ( $previous_hit === null ) {
			$session_arr['first_visited_url'] = $this->create_path( $sanitized_data );
			$sanitized_data['session_id']     = $this->create_session( $session_arr );
		}

		// if there is a fingerprint use that instead of uid.
		if ( $sanitized_data['fingerprint'] && ! $sanitized_data['uid'] ) {
			$this->store_fingerprint_in_session( $sanitized_data['fingerprint'], $should_load_ecommerce );
			$sanitized_data['uid'] = $sanitized_data['fingerprint'];
		}

		unset( $sanitized_data['fingerprint'] );

		// update burst_statistics table.
		// Get the last record with the same uid and page_url. If it exists update it. If not, create a new record and add time() to $sanitized_data['time'].
		// if update hit, make sure that the URL matches.
		$previous_page_url = $previous_hit['page_url'] ?? '';

		$new_page_url = $sanitized_data['page_url'];

		// if track_url_changes is enabled, also check for changing parameters.
		if ( $this->get_option_bool( 'track_url_change' ) ) {
			$previous_page_url .= $previous_hit['parameters'] ?? '';
			$new_page_url      .= $sanitized_data['parameters'];
		}
		$is_same_url = $previous_page_url === $new_page_url;

		if ( $hit_type === 'update' && ( $is_same_url || $previous_hit['session_id'] === '' ) ) {
			// add up time_on_page to the existing record.
			$sanitized_data['time_on_page'] += $previous_hit['time_on_page'];
			$sanitized_data['ID']            = $previous_hit['ID'];
			$this->update_statistic( $sanitized_data );
		} elseif ( $hit_type === 'create' ) {
			do_action( 'burst_before_create_statistic', $sanitized_data );
			// if it is not an update hit, create a new record.
			$sanitized_data['time']             = time();
			$sanitized_data['first_time_visit'] = 0;
			$insert_id                          = $this->create_statistic( $sanitized_data );
			do_action( 'burst_after_create_statistic', $insert_id, $sanitized_data );
		}

		if ( array_key_exists( 'ID', $sanitized_data ) && $sanitized_data['ID'] > 0 ) {
			$statistic_id = $sanitized_data['ID'];
		} else {
			$statistic_id = $insert_id ?? 0;
		}
		if ( $statistic_id > 0 ) {
			$completed_goals = $this->get_completed_goals( $sanitized_data['completed_goals'], $sanitized_data['page_url'] );
			// if $sanitized_data['completed_goals'] is not an empty array, update burst_goals table.
			if ( ! empty( $completed_goals ) ) {
				$this->create_goal_statistic( $statistic_id, $completed_goals );
			}
		}

		return 'success';
	}

	/**
	 * Create a path from the sanitized data.
	 */
	public function create_path( array $sanitized_data ): string {
		return empty( $sanitized_data['parameters'] ) ? $sanitized_data['page_url'] : $sanitized_data['page_url'] . '?' . $sanitized_data['parameters'];
	}

	/**
	 * Burst Statistics beacon endpoint for collecting hits
	 */
	public function beacon_track_hit(): string {
		$request = (string) file_get_contents( 'php://input' );
		if ( empty( $request ) ) {
			wp_die( 'not a valid request' );
		}
		if ( $request === 'request=test' ) {
			http_response_code( 200 );
			return 'success';
		}

		if ( IP::is_ip_blocked() && strpos( $request, 'burst_test_hit' ) === false ) {
			http_response_code( 200 );

			return 'ip blocked';
		}

		$data = json_decode( $request, true );
		if ( is_array( $data ) ) {
			$this->track_hit( $data );
		} else {
			self::error_log( 'The posted data has to be an array. Please check if your Javascript code is cached, using the old version.' );
		}

		http_response_code( 200 );

		return 'success';
	}

	/**
	 * Burst Statistics rest_api endpoint for collecting hits
	 */
	public function rest_track_hit( \WP_REST_Request $request ): \WP_REST_Response {
		// has to be decoded, contrary to what phpstan says.
		// @phpstan-ignore-next-line.
		$data     = json_decode( $request->get_json_params(), true );
		$test_hit = isset( $data['url'] ) && strpos( $data['url'], 'burst_test_hit' ) !== false;

		if ( Ip::is_ip_blocked() && ! $test_hit ) {
			// @phpstan-ignore-next-line.
			$status_code = WP_DEBUG ? 202 : 200;
			return new \WP_REST_Response( 'Burst Statistics: Your IP is blocked from tracking.', $status_code );
		}

		if ( isset( $data['request'] ) && $data['request'] === 'test' ) {
			return new \WP_REST_Response( [ 'success' => 'test' ], 200 );
		}

		if ( is_array( $data ) ) {
			$this->track_hit( $data );
		} else {
			self::error_log( 'The posted data has to be an array. Please check if your Javascript code is cached, using the old version.' );
		}

		return new \WP_REST_Response( [ 'success' => 'hit_tracked' ], 200 );
	}

	/**
	 * Prepare and sanitize raw tracking data from the client for storage.
	 *
	 * @param array<string, mixed> $data Raw tracking data input.
	 * @return array{
	 *     completed_goals: array<int>,
	 *     parameters: string,
	 *     page_url: string,
	 *     host: string,
	 *     uid: string,
	 *     fingerprint: string,
	 *     referrer: string,
	 *     time_on_page: int,
	 *     bounce: int,
	 *     browser_id?: int,
	 *     browser_version_id?: int,
	 *     platform_id?: int,
	 *     device_id?: int,
	 *     browser?: string,
	 *     browser_version?: string,
	 *     platform?: string,
	 *     device?: string,
	 *     should_load_ecommerce?: bool
	 * }
	 */
	public function prepare_tracking_data( array $data ): array {
		$parser          = new UserAgentParser();
		$user_agent_data = isset( $data['user_agent'] ) ? $parser->get_user_agent_data( $data['user_agent'] ) : [
			'browser'         => '',
			'browser_version' => '',
			'platform'        => '',
			'device'          => '',
		];

		$defaults = [
			'url'                   => null,
			'time'                  => null,
			'uid'                   => null,
			'fingerprint'           => null,
			'referrer_url'          => null,
			'user_agent'            => null,
			'time_on_page'          => null,
			'completed_goals'       => null,
			'page_id'               => null,
			'page_type'             => null,
			'should_load_ecommerce' => false,
		];
		$data     = wp_parse_args( $data, $defaults );

		// update array.
		$sanitized_data                    = [];
		$destructured_url                  = $this->sanitize_url( $data['url'] );
		$completed_goals                   = is_array( $data['completed_goals'] ) ? $data['completed_goals'] : '';
		$sanitized_data['completed_goals'] = $this->sanitize_completed_goal_ids( $completed_goals );
		// required.
		$sanitized_data['parameters'] = $destructured_url['parameters'];
		// required.
		$sanitized_data['page_url'] = $destructured_url['path'];
		$sanitized_data['host']     = $destructured_url['scheme'] . '://' . $destructured_url['host'];
		// required.
		$sanitized_data['uid']                   = $this->sanitize_uid( $data['uid'] );
		$sanitized_data['fingerprint']           = $this->sanitize_fingerprint( $data['fingerprint'] );
		$sanitized_data['referrer']              = $this->sanitize_referrer( $data['referrer_url'] );
		$sanitized_data['browser_id']            = self::get_lookup_table_id( 'browser', $user_agent_data['browser'] );
		$sanitized_data['browser_version_id']    = self::get_lookup_table_id( 'browser_version', $user_agent_data['browser_version'] );
		$sanitized_data['platform_id']           = self::get_lookup_table_id( 'platform', $user_agent_data['platform'] );
		$sanitized_data['device_id']             = self::get_lookup_table_id( 'device', $user_agent_data['device'] );
		$sanitized_data['time_on_page']          = $this->sanitize_time_on_page( $data['time_on_page'] );
		$sanitized_data['bounce']                = 1;
		$sanitized_data['page_id']               = (int) $data['page_id'];
		$sanitized_data['page_type']             = $this->sanitize_page_identifier( $data['page_type'] );
		$sanitized_data['should_load_ecommerce'] = filter_var( $data['should_load_ecommerce'], FILTER_VALIDATE_BOOLEAN );
		return $sanitized_data;
	}

	/**
	 * Sanitize the page identifier.
	 *
	 * @param string|null $page_identifier the page_identifier.
	 * @return string the sanitized identifier.
	 */
	private function sanitize_page_identifier( ?string $page_identifier ): string {
		if ( empty( $page_identifier ) ) {
			return '';
		}

		if ( ! function_exists( 'get_post_types' ) ) {
			require_once ABSPATH . 'wp-includes/post.php';
		}

		$page_identifier = trim( $page_identifier );
		$post_types      = get_post_types( [ 'public' => true ] );
		$fixed_values    = [
			'front-page',
			'blog-index',
			'date-archive',
			'404',
			'archive-generic',
			'wc-shop',
			'tag',
			'tax',
			'author',
			'search',
			'category',
		];
		$fixed_values    = array_unique( array_merge( $fixed_values, array_keys( $post_types ) ) );
		if ( in_array( $page_identifier, $fixed_values, true ) ) {
			return $page_identifier;
		}

		return sanitize_title( $page_identifier );
	}

	/**
	 * Determines if the current hit is an update or create operation and retrieves the last matching row if applicable.
	 *
	 * @param array<string, mixed> $data Data for the current hit.
	 * @return array{
	 *     hit_type?: 'create'|'update',
	 *     last_row?: array<string, mixed>|null
	 * } Associative array containing hit type and last row (if any), or an empty array if not applicable.
	 */
	public function get_hit_type( array $data ): array {
		// Determine if it is an update hit based on the absence of certain data points.
		$is_update_hit = $data['browser_id'] === 0 && $data['browser_version_id'] === 0 && $data['platform_id'] === 0 && $data['device_id'] === 0;

		// Attempt to get the last user statistic based on the presence or absence of certain conditions.
		$page_url = $is_update_hit ? $data['host'] . $this->create_path( $data ) : '';
		$uid      = $data['fingerprint'] ?: $data['uid'];
		$last_row = $this->get_last_user_statistic( $uid, $page_url );

		// Determine the appropriate action based on the result.
		if ( ! empty( $last_row ) ) {
			// A matching row exists, classify as update and return the last row.
			$hit_type = $is_update_hit ? 'update' : 'create';
			return [
				'hit_type' => $hit_type,
				'last_row' => $last_row,
			];
		} elseif ( $is_update_hit ) {
			// No matching row exists for an update hit, indicating a data inconsistency or error.
			// Indicate failure to find a matching row for an update.
			return [];
		} else {
			// No row exists and it's not an update hit, classify as create with no last row.
			return [
				'hit_type' => 'create',
				'last_row' => null,
			];
		}
	}

	/**
	 * Check if session needs updating by comparing previous hit data with new session data.
	 *
	 * @param array $previous_hit     Previous hit data from burst_statistics (may include host/city_code via JOIN).
	 * @param array $new_session_data New session data to be written.
	 * @return bool True if update is needed, false if data hasn't changed.
	 */
	private function session_needs_update( array $previous_hit, array $new_session_data ): bool {
		// If we don't have previous hit data, update to be safe.
		if ( empty( $previous_hit ) ) {
			return true;
		}

		$old_url      = $previous_hit['page_url'] ?? '';
		$old_params   = $previous_hit['parameters'] ?? '';
		$old_full_url = empty( $old_params ) ? $old_url : $old_url . '?' . $old_params;

		$new_url = $new_session_data['last_visited_url'] ?? '';

		if ( $old_full_url !== $new_url ) {
			return true;
		}

		// 2. Check host (only relevant for multi-domain with filtering enabled)
		// Note: host will only be in previous_hit if JOIN was performed
		if ( isset( $previous_hit['host'] ) && isset( $new_session_data['host'] ) ) {
			$old_host = $previous_hit['host'] ?? '';
			$new_host = $new_session_data['host'];

			if ( $old_host !== $new_host ) {
				// Host changed (cross-domain navigation).
				return true;
			}
		}

		return false;
	}

	/**
	 * Sanitize completed goal IDs.
	 *
	 * Filters out inactive or duplicate IDs and ensures all values are integers.
	 *
	 * @param array<int, mixed> $completed_goals Array of goal IDs from the client.
	 * @return array<int> Cleaned list of unique, active goal IDs as integers.
	 */
	public function sanitize_completed_goal_ids( array $completed_goals ): array {
		$completed_goals = array_unique( $completed_goals );
		$completed_goals = array_map( 'absint', $completed_goals );
		return array_values( $completed_goals );
	}

	/**
	 * Get the id of the lookup table for the given item and value.
	 */
	public function get_lookup_table_id( string $item, ?string $value ): int {
		if ( empty( $value ) ) {
			return 0;
		}

		$possible_items = [ 'browser', 'browser_version', 'platform', 'device' ];
		if ( ! in_array( $item, $possible_items, true ) ) {
			return 0;
		}

		// Load all items for this type if not cached yet.
		if ( ! isset( $this->lookup_table_cache[ $item ] ) ) {
			$cache_key = 'burst_' . $item . '_all';
			$all_items = wp_cache_get( $cache_key, 'burst' );

			if ( false === $all_items ) {
				// Cache miss - load all items from database.
				global $wpdb;
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name cannot be parameterized. Selected from safe list above.
				$results = $wpdb->get_results( "SELECT ID, name FROM {$wpdb->prefix}burst_{$item}s", OBJECT_K );

				$all_items = [];
				foreach ( $results as $result ) {
					$all_items[ $result->name ] = (int) $result->ID;
				}

				wp_cache_set( $cache_key, $all_items, 'burst' );
			}

			$this->lookup_table_cache[ $item ] = $all_items;
		}

		// Check if value exists.
		if ( isset( $this->lookup_table_cache[ $item ][ $value ] ) ) {
			return $this->lookup_table_cache[ $item ][ $value ];
		}

		// Value doesn't exist - insert it.
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . "burst_{$item}s",
			[ 'name' => $value ]
		);
		$id = $wpdb->insert_id;

		// Invalidate caches.
		unset( $this->lookup_table_cache[ $item ] );
		wp_cache_delete( 'burst_' . $item . '_all', 'burst' );

		return (int) $id;
	}

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
					'scriptUrl' => apply_filters( 'burst_goals_script_url', BURST_URL . 'assets/js/build/burst-goals.js?v=' . $script_version ),
					'active'    => $this->get_active_goals( [ 'clicks', 'views' ] ),
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
	 * @param array $goal_types list of goal types to select.
	 * @return array<array<string, mixed>> Filtered list of active goals.
	 */
	public function get_active_goals( array $goal_types ): array {
		// Validate and clean goal types.
		foreach ( $goal_types as $key => $type ) {
			if ( ! in_array( $type, [ 'hook', 'visits', 'clicks', 'views' ], true ) ) {
				unset( $goal_types[ $key ] );
			}
		}

		// If no valid goal types remain, return empty array.
		if ( empty( $goal_types ) ) {
			return [];
		}

		// Prevent queries during install or uninstall.
		if (
			defined( 'BURST_INSTALL_TABLES_RUNNING' ) ||
			defined( 'BURST_UNINSTALLING' )
		) {
			return [];
		}

		// Check if all requested types are already cached.
		$cache_miss = false;
		foreach ( $goal_types as $type ) {
			if ( ! isset( $this->goals[ $type ] ) ) {
				$cache_miss = true;
				break;
			}
		}

		// If all types are cached, combine and return them.
		if ( ! $cache_miss ) {
			$goals = [];
			foreach ( $goal_types as $type ) {
				$goals = array_merge( $goals, $this->goals[ $type ] );
			}
			return $goals;
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

		// Filter goals by goal type, and store in $this->goals[$type].
		foreach ( $goal_types as $type ) {
			if ( ! isset( $this->goals[ $type ] ) ) {
				$this->goals[ $type ] = array_values(
					array_filter(
						$all_goals,
						static function ( array $goal ) use ( $type ): bool {
							return isset( $goal['type'] ) && $goal['type'] === $type;
						}
					)
				);
			}
		}

		// Return combined array for the requested goal_types.
		$filtered = [];
		foreach ( $goal_types as $type ) {
			$filtered = array_merge( $filtered, $this->goals[ $type ] );
		}

		return $filtered;
	}


	/**
	 * Checks if a specified goal is completed based on the provided page URL.
	 *
	 * @param int    $goal_id The ID of the goal to check.
	 * @param string $page_url The current page URL.
	 * @param array  $goals the available goals.
	 * @return bool Returns true if the goal is completed, false otherwise.
	 */
	public function goal_is_completed( int $goal_id, string $page_url, array $goals ): bool {
		$goal = array_filter(
			$goals,
			function ( $goal ) use ( $goal_id ) {
				return isset( $goal['ID'] ) && (int) $goal['ID'] === $goal_id;
			}
		);
		$goal = reset( $goal );

		// Check if the goal and page URL are properly set.
		if ( empty( $goal['type'] ) || empty( $goal['url'] ) || empty( $page_url ) ) {
			return false;
		}

		switch ( $goal['type'] ) {
			case 'visits':
				// Improved URL comparison logic could go here.
				// @TODO: Maybe add support for * and ? wildcards?.
				if ( rtrim( $page_url, '/' ) === rtrim( $goal['url'], '/' ) ) {
					return true;
				}
				break;

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
		$server_goals           = $this->get_active_goals( [ 'visits' ] );
		// if server side goals exist.
		if ( count( $server_goals ) > 0 ) {
			// loop through server side goals.
			foreach ( $server_goals as $goal ) {
				// if goal is completed.
				if ( $this->goal_is_completed( $goal['ID'], $page_url, $server_goals ) ) {
					// add goal id to completed goals array.
					$completed_server_goals[] = $goal['ID'];
				}
			}
		}

		// merge completed client goals and completed server goals.
		return array_merge( $completed_client_goals, $completed_server_goals );
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
		if ( strlen( $uid ) === 0 ) {
			return [];
		}
		$need_session_data = $this->get_option_bool( 'filtering_by_domain' );

		global $wpdb;
		$where = '';
		if ( $page_url !== '' ) {
			$destructured_url = $this->sanitize_url( $page_url );
			$parameters       = $destructured_url['parameters'];
			$where            = ! empty( $parameters ) ? $wpdb->prepare( ' AND parameters = %s', $parameters ) : '';
		}

		$where .= $wpdb->prepare( ' AND time > %d', strtotime( '-30 minutes' ) );
		// Build query based on whether we need session data.
		if ( $need_session_data ) {
			// With JOIN to get host.
			$last_row = $wpdb->get_row(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where consists of only prepared parts.
				$wpdb->prepare(
					"SELECT 
                    s.ID, 
                    s.session_id, 
                    s.parameters, 
                    s.time_on_page, 
                    s.bounce, 
                    s.page_url,
                    sess.host
                FROM {$wpdb->prefix}burst_statistics s
                LEFT JOIN {$wpdb->prefix}burst_sessions sess ON s.session_id = sess.ID
                WHERE s.uid = %s {$where} 
                ORDER BY s.ID DESC 
                LIMIT 1",
					$uid
				)
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);
		} else {
			$last_row = $wpdb->get_row(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where consists of only prepared parts.
				$wpdb->prepare( "SELECT ID, session_id, parameters, time_on_page, bounce, page_url FROM {$wpdb->prefix}burst_statistics WHERE uid = %s {$where} ORDER BY ID DESC LIMIT 1", $uid )
			);
		}

		return $last_row ? (array) $last_row : [];
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
		unset( $data['host'] );
		$data = $this->remove_empty_values( $data );

		if ( ! $this->required_values_set( $data ) ) {
            // phpcs:ignore
            self::error_log( 'Missing required values for statistic creation. Data: ' . print_r( $data, true ) );
			return 0;
		}

		$inserted = $wpdb->insert( $wpdb->prefix . 'burst_statistics', $data );
		if ( $inserted === false ) {
			self::error_log( 'Failed to create statistic. Error: ' . $wpdb->last_error );
			return 0;
		}
		return $wpdb->insert_id;
	}

	/**
	 * Update a statistic in {prefix}_burst_statistics
	 *
	 * @param array $data Data to update, must include 'ID' for the statistic.
	 * @return bool True on success, false on failure.
	 */
	public function update_statistic( array $data ): bool {
		global $wpdb;
		unset( $data['host'] );
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
	public function create_goal_statistic( int $statistic_id, array $goal_ids ): void {
		global $wpdb;
		$values = [];
		foreach ( $goal_ids as $goal_id ) {
			$values[] = $wpdb->prepare( '(%d, %d)', $goal_id, $statistic_id );
		}
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Using prepare for each value above.
		$wpdb->query( "INSERT IGNORE INTO {$wpdb->prefix}burst_goal_statistics (goal_id, statistic_id)  VALUES " . implode( ',', $values ) );
	}

	/**
	 * Remove null, empty, and specific values from an array.
	 *
	 * Skips removal for the 'parameters' key. Also unsets 'completed_goals'.
	 *
	 * @param array<string, mixed> $data Input associative array of values.
	 * @return array<string, mixed> Filtered associative array.
	 */
	public function remove_empty_values( array $data ): array {
		foreach ( $data as $key => $value ) {
			// skip parameters.
			if ( $key === 'parameters' ) {
				continue;
			}

			// remove null or empty string.
			if ( $value === null || $value === '' ) {
				unset( $data[ $key ] );
				continue;
			}

			// remove *_id if 0.
			if ( str_ends_with( $key, '_id' ) && (int) $value === 0 ) {
				unset( $data[ $key ] );
			}
		}

		unset( $data['completed_goals'] );
		return $data;
	}

	/**
	 * Store fingerprint in PHP session.
	 *
	 * @param string $fingerprint           The fingerprint to store.
	 * @param bool   $should_load_ecommerce Whether to load ecommerce data.
	 */
	public function store_fingerprint_in_session( string $fingerprint, bool $should_load_ecommerce ): void {
		$serverside_goals = $this->get_active_goals( [ 'visits' ] );
		// no need for session without serverside goals.
		if ( empty( $serverside_goals ) && ! $should_load_ecommerce ) {
			return;
		}

		if ( ! $this->start_session_safely() ) {
			return;
		}

		$_SESSION['burst_fingerprint'] = $this->sanitize_fingerprint( $fingerprint );
	}

	/**
	 * Retrieve fingerprint from PHP session.
	 *
	 * @return string The stored fingerprint or empty string if not found.
	 */
	public function get_fingerprint_from_session(): string {
		if ( ! $this->start_session_safely() ) {
			return '';
		}

		return $this->sanitize_fingerprint( sanitize_text_field( $_SESSION['burst_fingerprint'] ?? '' ) );
	}

	/**
	 * Safely start a PHP session with error handling.
	 *
	 * @return bool True if session started successfully, false otherwise.
	 */
	private function start_session_safely(): bool {
		if ( session_status() === PHP_SESSION_ACTIVE ) {
			return true;
		}

		// Check if session save path exists and is writable.
		$save_path = session_save_path();
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
		if ( empty( $save_path ) || ! is_dir( $save_path ) || ! is_writable( $save_path ) ) {
			// Load WordPress default constants manually.
			require_once ABSPATH . WPINC . '/default-constants.php';
			wp_plugin_directory_constants();
			wp_cookie_constants();

			// Try to use WordPress uploads directory as fallback.
			$upload_dir          = wp_upload_dir();
			$custom_session_path = $upload_dir['basedir'] . '/burst-sessions';

			if ( ! file_exists( $custom_session_path ) ) {
				wp_mkdir_p( $custom_session_path );
			}

            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
			if ( is_dir( $custom_session_path ) && is_writable( $custom_session_path ) ) {
				session_save_path( $custom_session_path );
			}
		}

        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Suppressing session warnings as we handle errors gracefully.
		$result = @session_start();

		if ( ! $result ) {
			self::error_log( 'Burst: Session start failed' );
		}

		return $result;
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
