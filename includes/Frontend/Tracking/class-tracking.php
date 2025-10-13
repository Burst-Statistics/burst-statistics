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

require_once BURST_PATH . 'helpers/php-user-agent/UserAgentParser.php';
use function Burst\UserAgent\parse_user_agent;
class Tracking {
	use Helper;

	public string $beacon_enabled;
	public array $look_up_table_ids = [];
	public array $goals             = [];
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
		$sanitized_data = $this->prepare_tracking_data( $data );
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
		$previous_hit = $result['last_row'];
		if ( $previous_hit !== null ) {
			// Determine non-bounce conditions.
			$is_different_page          = $previous_hit['page_url'] . $previous_hit['parameters'] !== $sanitized_data['page_url'] . $sanitized_data['parameters'];
			$is_time_over_threshold     = ( (int) $previous_hit['time_on_page'] + (int) $sanitized_data['time_on_page'] ) > 5000;
			$is_previous_hit_not_bounce = (int) $previous_hit['bounce'] === 0;

			if ( $is_previous_hit_not_bounce || $is_different_page || $is_time_over_threshold ) {
				// Not a bounce.
				$sanitized_data['bounce'] = 0;
				// If the user visited more than one page, update all previous hits to not be a bounce.
				if ( $is_different_page ) {
					$this->set_bounce_for_session( (int) $previous_hit['session_id'] );
				}
			}
		}

		$filtered_previous_hit = $previous_hit;
		if ( $previous_hit === null ) {
			$filtered_previous_hit = [];
		}
		$sanitized_data = apply_filters( 'burst_before_track_hit', $sanitized_data, $hit_type, $filtered_previous_hit );
		$session_arr    = [
			'last_visited_url' => $this->create_path( $sanitized_data ),
			'city_code'        => $sanitized_data['city_code'] ?? '',
		];
		unset( $sanitized_data['city_code'] );
		// update burst_sessions table.
		// Get the last record with the same uid within 30 minutes. If it exists, use session_id. If not, create a new session.

		// Improved clarity and error handling for session management.
		if ( isset( $previous_hit ) && $previous_hit['session_id'] > 0 ) {
			// Existing session found, reuse the session ID.
			$sanitized_data['session_id'] = $previous_hit['session_id'];

			// Update existing session with new data.
			if ( ! $this->update_session( (int) $sanitized_data['session_id'], $session_arr ) ) {
				// Handle error if session update fails.
				self::error_log( 'Failed to update session for session ID: ' . $sanitized_data['session_id'] );
			}
		} elseif ( $previous_hit === null ) {
			// No previous hit, indicating a new session.
			$session_arr['first_visited_url'] = $this->create_path( $sanitized_data );

			// Attempt to create a new session and assign its ID.
			$sanitized_data['session_id'] = $this->create_session( $session_arr );
		}

		// if there is a fingerprint use that instead of uid.
		if ( $sanitized_data['fingerprint'] && ! $sanitized_data['uid'] ) {
			$this->store_fingerprint_in_session( $sanitized_data['fingerprint'] );
			$sanitized_data['uid'] = $sanitized_data['fingerprint'];
		}
		unset( $sanitized_data['fingerprint'] );

		// update burst_statistics table.
		// Get the last record with the same uid and page_url. If it exists update it. If not, create a new record and add time() to $sanitized_data['time'].
		// if update hit, make sure that the URL matches.
		if ( $hit_type === 'update' && ( $previous_hit['page_url'] . $previous_hit['parameters'] === $sanitized_data['page_url'] . $sanitized_data['parameters'] || $previous_hit['session_id'] === '' ) ) {
			// add up time_on_page to the existing record.
			$sanitized_data['time_on_page'] += $previous_hit['time_on_page'];
			$sanitized_data['ID']            = $previous_hit['ID'];
			$this->update_statistic( $sanitized_data );
		} elseif ( $hit_type === 'create' ) {
			do_action( 'burst_before_create_statistic', $sanitized_data );
			// if it is not an update hit, create a new record.
			$sanitized_data['time']             = time();
			$sanitized_data['first_time_visit'] = $this->is_first_time_visit( $sanitized_data['uid'] );
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
				foreach ( $completed_goals as $goal_id ) {
					$goal_arr = [
						'goal_id'      => $goal_id,
						'statistic_id' => $statistic_id,
					];
					$this->create_goal_statistic( $goal_arr );
				}
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
	 *     device?: string
	 * }
	 */
	public function prepare_tracking_data( array $data ): array {
		$user_agent_data = isset( $data['user_agent'] ) ? $this->get_user_agent_data( $data['user_agent'] ) : [
			'browser'         => '',
			'browser_version' => '',
			'platform'        => '',
			'device'          => '',
		];

		$defaults = [
			'url'             => null,
			'time'            => null,
			'uid'             => null,
			'fingerprint'     => null,
			'referrer_url'    => null,
			'user_agent'      => null,
			'time_on_page'    => null,
			'completed_goals' => null,
			'page_id'         => null,
			'page_type'       => null,
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
		$sanitized_data['uid']                = $this->sanitize_uid( $data['uid'] );
		$sanitized_data['fingerprint']        = $this->sanitize_fingerprint( $data['fingerprint'] );
		$sanitized_data['referrer']           = $this->sanitize_referrer( $data['referrer_url'] );
		$sanitized_data['browser_id']         = self::get_lookup_table_id( 'browser', $user_agent_data['browser'] );
		$sanitized_data['browser_version_id'] = self::get_lookup_table_id( 'browser_version', $user_agent_data['browser_version'] );
		$sanitized_data['platform_id']        = self::get_lookup_table_id( 'platform', $user_agent_data['platform'] );
		$sanitized_data['device_id']          = self::get_lookup_table_id( 'device', $user_agent_data['device'] );
		$sanitized_data['time_on_page']       = $this->sanitize_time_on_page( $data['time_on_page'] );
		$sanitized_data['bounce']             = 1;
		$sanitized_data['page_id']            = (int) $data['page_id'];
		$sanitized_data['page_type']          = $this->sanitize_page_identifier( $data['page_type'] );

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
			'page',
			'post',
		];

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
		if ( $is_update_hit ) {
			// For an update hit, require matching uid, fingerprint, and parameters.
			$page_url = $data['host'] . $this->create_path( $data );
			$last_row = $this->get_last_user_statistic( $data['uid'], $data['fingerprint'], $page_url );
		} else {
			// For a potential create hit, uid and fingerprint are sufficient.
			$last_row = $this->get_last_user_statistic( $data['uid'], $data['fingerprint'] );
		}

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
	 * Sanitize and destructure a URL.
	 *
	 * Ensures the URL is safe and valid, then extracts its components.
	 *
	 * @param string $url The input URL.
	 * @return array{
	 *     scheme: string,
	 *     host: string,
	 *     path: string,
	 *     parameters: string
	 * }
	 */
	public function sanitize_url( ?string $url ): array {
		$url_destructured = [
			'scheme'     => 'https',
			'host'       => '',
			'path'       => '',
			'parameters' => '',
		];
		if ( ! function_exists( 'wp_kses_bad_protocol' ) ) {
			require_once ABSPATH . '/wp-includes/kses.php';
		}
		$sanitized_url = filter_var( $url, FILTER_SANITIZE_URL );
		// Validate the URL.
		if ( ! filter_var( $sanitized_url, FILTER_VALIDATE_URL ) ) {
			return $url_destructured;
		}

		if ( ! function_exists( 'wp_parse_url' ) ) {
			require_once ABSPATH . '/wp-includes/http.php';
		}
		$url = wp_parse_url( esc_url_raw( $sanitized_url ) );
		if ( isset( $url['host'] ) ) {
			$url_destructured['host']        = $url['host'];
			$url_destructured['scheme']      = $url['scheme'];
			$url_destructured['path']        = trailingslashit( $url['path'] );
			$url_destructured['parameters']  = $url['query'] ?? '';
			$url_destructured['parameters'] .= $url['fragment'] ?? '';
		}
		return $url_destructured;
	}

	/**
	 * Sanitize uid
	 */
	public function sanitize_uid( ?string $uid ): string {
		if ( $uid === null || strlen( $uid ) === 0 || ! preg_match( '/^[a-z0-9-]*/', $uid ) ) {
			return '';
		}

		return $uid;
	}

	/**
	 * Sanitize fingerprint
	 */
	public function sanitize_fingerprint( ?string $fingerprint ): string {
		if ( $fingerprint === null || strlen( $fingerprint ) === 0 || ! preg_match( '/^[a-z0-9-]*/', $fingerprint ) ) {
			return '';
		}

		return 'f-' . $fingerprint;
	}

	/**
	 * Sanitize referrer
	 */
	public function sanitize_referrer( ?string $referrer ): string {
		if ( ! defined( 'BURST_PATH' ) ) {
			$dir     = plugin_dir_path( __FILE__ );
			$src_pos = strpos( $dir, '/includes/' );
			$dir     = $src_pos !== false ? substr( $dir, 0, $src_pos + 1 ) : $dir;
			define( 'BURST_PATH', $dir );
		}
		$referrer = filter_var( $referrer, FILTER_SANITIZE_URL );
		// we use wp_parse_url so we don't need to load a wp file here.
        //phpcs:ignore
		$referrer_host = parse_url( $referrer, PHP_URL_HOST );
		$current_host  = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'];
		// don't track if referrer is the same as current host.
		// if referrer_url starts with current_host, then it is not a referrer.
		if ( empty( $referrer_host ) || strpos( $referrer_host, $current_host ) === 0 ) {
			return '';
		}

		$ref_spam_list = file( BURST_PATH . 'helpers/referrer-spam-list/spammers.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
		$ref_spam_list = apply_filters( 'burst_referrer_spam_list', $ref_spam_list );
		if ( array_search( $referrer_host, $ref_spam_list, true ) ) {
			return 'spammer';
		}
		if ( ! function_exists( 'wp_kses_bad_protocol' ) ) {
			require_once ABSPATH . '/wp-includes/kses.php';
		}

		return $referrer ? trailingslashit( esc_url_raw( $referrer ) ) : '';
	}

	/**
	 * Sanitize time on page
	 */
	public function sanitize_time_on_page( ?string $time_on_page ): int {
		return (int) $time_on_page;
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
		$active_client_side_goals    = $this->get_active_goals( false );
		$active_client_side_goal_ids = wp_list_pluck( $active_client_side_goals, 'ID' );
		// only keep active goals ids.
		$completed_goals = array_intersect( $completed_goals, $active_client_side_goal_ids );
		// remove duplicates.
		$completed_goals = array_unique( $completed_goals );
		// make sure all values are integers.
		return array_map( 'absint', $completed_goals );
	}

	/**
	 * Get cached value for lookup table id
	 */
	public function get_lookup_table_id_cached( string $item, ?string $value ): int {
		if ( isset( $this->look_up_table_ids[ $item ][ $value ] ) ) {
			return $this->look_up_table_ids[ $item ][ $value ];
		}

		$id = self::get_lookup_table_id( $item, $value );
		$this->look_up_table_ids[ $item ][ $value ] = $id;
		return $id;
	}

	/**
	 * Get the id of the lookup table for the given item and value.
	 */
	public static function get_lookup_table_id( string $item, ?string $value ): int {
		if ( empty( $value ) ) {
			return 0;
		}

		$possible_items = [ 'browser', 'browser_version', 'platform', 'device' ];
		if ( ! in_array( $item, $possible_items, true ) ) {
			return 0;
		}

		// check if $value exists in table burst_$item.
		$id = wp_cache_get( 'burst_' . $item . '_' . $value, 'burst' );
		if ( ! $id ) {
			global $wpdb;
			$id = $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}burst_{$item}s WHERE name = %s LIMIT 1", $value ) );
			if ( ! $id ) {
				// doesn't exist, so insert it.
				$wpdb->insert(
					$wpdb->prefix . "burst_{$item}s",
					[
						'name' => $value,
					]
				);
				$id = $wpdb->insert_id;
			}
			wp_cache_set( 'burst_' . $item . '_' . $value, $id, 'burst' );
		}
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
	 * @param string $uid         The user identifier.
	 * @param string $fingerprint A unique browser/device fingerprint.
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
	public function get_last_user_statistic( string $uid, string $fingerprint, string $page_url = '' ): array {
		global $wpdb;
		// if fingerprint is send get the last user statistic with the same fingerprint.
		$search_uid = $fingerprint ?: $uid;
		if ( strlen( $search_uid ) === 0 ) {
			return [];
		}
		$where = '';
		if ( $page_url !== '' ) {
			$destructured_url = $this->sanitize_url( $page_url );
			$parameters       = $destructured_url['parameters'];
			$where            = ! empty( $parameters ) ? $wpdb->prepare( ' AND parameters = %s', $parameters ) : '';
		}

		$data = $wpdb->get_row(
			$wpdb->prepare(
				"select ID, session_id, parameters, time_on_page, bounce, page_url
      from {$wpdb->prefix}burst_statistics
                     where uid = %s AND time > %s {$where} ORDER BY ID DESC limit 1",
				$search_uid,
				strtotime( '-30 minutes' )
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
