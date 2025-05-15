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
	/**
	 * Constructor
	 */
	public function __construct() {
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
		$sanitized_data = apply_filters( 'burst_before_track_hit', apply_filters_deprecated( 'before_burst_track_hit', [ $sanitized_data ], '2.0.1', 'burst_before_track_hit', 'before_burst_track_hit is deprecated, use burst_before_track_hit instead' ) );

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

		$sanitized_data = apply_filters( 'burst_before_track_hit', $sanitized_data );
		$session_arr    = [
			'last_visited_url' => $this->create_path( $sanitized_data ),
			'goal_id'          => false,
			'country_code'     => $sanitized_data['country_code'] ?? '',
		];
		unset( $sanitized_data['country_code'] );
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
			$sanitized_data['first_time_visit'] = $this->get_first_time_visit( $sanitized_data['uid'] );
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

		// update total pageviews count.
		// we don't do this on high traffic sites.
		if ( ! get_option( 'burst_is_high_traffic_site' ) ) {
			$page_url             = isset( $sanitized_data['page_url'] ) ? esc_url_raw( $sanitized_data['host'] . $sanitized_data['page_url'] ) : '';
			$page_views_to_update = get_option( 'burst_pageviews_to_update', [] );
			if ( ! in_array( $page_url, $page_views_to_update, true ) ) {
				$page_views_to_update[ $page_url ] = 1;
			} else {
				++$page_views_to_update[ $page_url ];
			}
			update_option( 'burst_pageviews_to_update', $page_views_to_update );
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

		if ( IP::is_ip_blocked() ) {
			http_response_code( 200 );

			return 'ip blocked';
		}

		// The data is encoded in JSON and decoded twice to get the array.
		$data = json_decode( json_decode( $request, true ), true );
		$this->track_hit( $data );
		http_response_code( 200 );

		return 'success';
	}

	/**
	 * Burst Statistics rest_api endpoint for collecting hits
	 */
	public function rest_track_hit( \WP_REST_Request $request ): \WP_REST_Response {
		if ( Ip::is_ip_blocked() ) {
			// @phpstan-ignore-next-line.
			$status_code = WP_DEBUG ? 202 : 200;

			return new \WP_REST_Response( 'Burst Statistics: Your IP is blocked from tracking.', $status_code );
		}
		// should be decoded, although phpstan says otherwise.
		// @phpstan-ignore-next-line.
		$data = json_decode( $request->get_json_params(), true );
		if ( isset( $data['request'] ) && $data['request'] === 'test' ) {
			return new \WP_REST_Response( [ 'success' => 'test' ], 200 );
		}
		$this->track_hit( $data );

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
		$sanitized_data['uid']         = $this->sanitize_uid( $data['uid'] );
		$sanitized_data['fingerprint'] = $this->sanitize_fingerprint( $data['fingerprint'] );
		$sanitized_data['referrer']    = $this->sanitize_referrer( $data['referrer_url'] );

		// if new lookup tables upgrade is not completed, use legacy columns.
		$_use_lookup_tables = ! get_option( 'burst_db_upgrade_create_lookup_tables' );
		if ( $_use_lookup_tables ) {
			// new lookup table structure.
			// already sanitized.
			$sanitized_data['browser_id'] = self::get_lookup_table_id( 'browser', $user_agent_data['browser'] );
			// already sanitized.
			$sanitized_data['browser_version_id'] = self::get_lookup_table_id( 'browser_version', $user_agent_data['browser_version'] );
			// already sanitized.
			$sanitized_data['platform_id'] = self::get_lookup_table_id( 'platform', $user_agent_data['platform'] );
			// already sanitized.
			$sanitized_data['device_id'] = self::get_lookup_table_id( 'device', $user_agent_data['device'] );
		} else {
			// legacy, until lookup tables are created. Drop this part on next update.
			$sanitized_data['browser']         = $user_agent_data['browser'];
			$sanitized_data['browser_version'] = $user_agent_data['browser_version'];
			$sanitized_data['platform']        = $user_agent_data['platform'];
			$sanitized_data['device']          = $user_agent_data['device'];
		}

		$sanitized_data['time_on_page'] = $this->sanitize_time_on_page( $data['time_on_page'] );
		$sanitized_data['bounce']       = 1;

		return $sanitized_data;
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
		$_use_lookup_tables = ! get_option( 'burst_db_upgrade_create_lookup_tables' );
		if ( $_use_lookup_tables ) {
			$is_update_hit = $data['browser_id'] === 0 && $data['browser_version_id'] === 0 && $data['platform_id'] === 0 && $data['device_id'] === 0;
		} else {
			$is_update_hit = empty( $data['browser'] ) && empty( $data['browser_version'] ) && empty( $data['platform'] ) && empty( $data['device'] );
		}

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
		// we don't use wp_parse_url so we don't need to load an additional wp file.
        // phpcs:ignore
		$url = parse_url( esc_url_raw( $sanitized_url ) );
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
			$src_pos = strpos( $dir, '/src/' );
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
		// only keep active goals ids.
		$completed_goals = array_intersect( $completed_goals, self::get_active_goals_ids() );
		// remove duplicates.
		$completed_goals = array_unique( $completed_goals );
		// make sure all values are integers.
		return array_map( 'absint', $completed_goals );
	}

	/**
	 * Get cached value for lookup table id
	 */
	public function get_lookup_table_id_cached( string $item, string $value ): int {
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
	public static function get_lookup_table_id( string $item, string $value ): int {
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
		return apply_filters(
			'burst_tracking_options',
			[
				'tracking' => [
					'isInitialHit'        => true,
					'lastUpdateTimestamp' => 0,
					'beacon_url'          => self::get_beacon_url(),
				],
				'options'  => [
					'cookieless'            => $this->get_option_int( 'enable_cookieless_tracking' ),
					'pageUrl'               => get_permalink(),
					'beacon_enabled'        => (int) $this->beacon_enabled(),
					'do_not_track'          => $this->get_option_int( 'enable_do_not_track' ),
					'enable_turbo_mode'     => $this->get_option_int( 'enable_turbo_mode' ),
					'track_url_change'      => $this->get_option_int( 'track_url_change' ),
					'cookie_retention_days' => apply_filters( 'burst_cookie_retention_days', 30 ),
				],
				'goals'    => [
					'completed' => [],
					'scriptUrl' => apply_filters( 'burst_goals_script_url', BURST_URL . '/assets/js/build/burst-goals.js?v=' . BURST_VERSION ),
					'active'    => self::get_active_goals(),
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
	 * Get all active goals from the database.
	 *
	 * @param bool $server_side Whether to fetch only server-side goals.
	 * @return array<array<string, mixed>> List of active goals as associative arrays.
	 */
	public static function get_active_goals( bool $server_side = false ): array {
		if ( defined( 'BURST_INSTALL_TABLES_RUNNING' ) ) {
			return [];
		}

		global $wpdb;
		$goals = wp_cache_get( "burst_active_goals_$server_side", 'burst' );
		if ( ! $goals ) {
			$server_side = $server_side ? 'AND server_side = 1' : 'AND server_side = 0';
			$goals       = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE status = 'active' {$server_side}", ARRAY_A );
			wp_cache_set( "burst_active_goals_$server_side", $goals, 'burst', 10 );
		}

		return $goals;
	}

	/**
	 * Get a list of active goal IDs.
	 *
	 * @param bool $server_side Whether to return only server-side goals.
	 * @return array<int> List of goal IDs.
	 */
	public function get_active_goals_ids( bool $server_side = false ): array {
		$active_goals = self::get_active_goals( $server_side );
		return wp_list_pluck( $active_goals, 'ID' );
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
		$server_goals           = self::get_active_goals( true );
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
	public function get_first_time_visit( string $burst_uid ): int {
		global $wpdb;
		// Check if uid is already in the database in the past 30 days for a different sessions_id.
		$after_time         = time() - MONTH_IN_SECONDS;
		$sql                = $wpdb->prepare(
			"SELECT EXISTS(SELECT 1 FROM {$wpdb->prefix}burst_statistics WHERE uid = %s AND time > %s LIMIT 1)",
			$burst_uid,
			$after_time
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
