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

use Burst\Admin\Statistics\Page_Weight_Store;
use Burst\Frontend\Endpoint;
use Burst\Frontend\Events\Events;
use Burst\Frontend\Ip\Ip;
use Burst\Frontend\Search\Search;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use Burst\UserAgentParser\UserAgentParser;

class Tracking {
	use Database_Helper;
	use Helper;
	use Sanitize;

	public string $beacon_enabled;
	public array $lookup_table_cache = [];
	public array $goals              = [];
	private ?Events $events_handler  = null;

	/**
	 * Maximum number of completed goals accepted from a single hit.
	 *
	 * A real page view completes only a handful of goals; the cap bounds the
	 * work a single anonymous request can trigger, since every reported id
	 * becomes a row in one INSERT on burst_goal_statistics.
	 */
	private const MAX_COMPLETED_GOALS_PER_HIT = 50;

	/**
	 * Session columns a later hit fills in when the first hit of the session
	 * left them empty: a GeoIP lookup or user agent parse that failed, or a
	 * session that started without a referrer. get_last_user_statistic()
	 * selects them so session_needs_update() can compare.
	 */
	private const SESSION_BACKFILL_COLUMNS = [ 'referrer', 'city_code', 'browser_id', 'browser_version_id', 'platform_id', 'device_id' ];

	/**
	 * Register the GeoIP enrichment on construction.
	 *
	 * Done in the constructor (not init) so it also applies on the SHORTINIT beacon
	 * endpoint, which instantiates `new Tracking()` directly but never calls init().
	 */
	public function __construct() {
		if ( ! has_filter( 'burst_before_track_hit', [ self::class, 'add_geoip_location_data' ] ) ) {
			add_filter( 'burst_before_track_hit', [ self::class, 'add_geoip_location_data' ], 10, 3 );
		}
	}

	/**
	 * Enrich the tracked hit with location data.
	 *
	 * The reader class is resolved lazily (at hit time): free uses the core Country
	 * reader, Pro swaps in its City reader via the burst_geoip_handler filter.
	 *
	 * @param array<string, mixed>      $arr          The tracking data.
	 * @param string                    $hit_type     The type of hit.
	 * @param array<string, mixed>|null $previous_hit Previous hit data, if any.
	 * @return array<string, mixed>
	 */
	public static function add_geoip_location_data( array $arr, string $hit_type, ?array $previous_hit ): array {
		$handler = apply_filters( 'burst_geoip_handler', Tracking_GeoIp::class );
		return $handler::add_location_data( $arr, $hit_type, $previous_hit );
	}

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'rest_api_init', [ $this, 'register_track_hit_route' ] );
		// Runs before the priority 10 create_js_file: that callback rebuilds the
		// combined tracking script from get_active_goals(), which would otherwise
		// hand it the goal list as it was before this request changed it.
		add_action( 'burst_after_updated_goals', [ $this, 'clear_goals_cache' ], 1 );
		High_Traffic_Buffer::init();
	}

	/**
	 * Drop the memoized and cached active goals after a goal has been written.
	 */
	public function clear_goals_cache(): void {
		$this->goals = [];
		wp_cache_delete( 'burst_active_goals_all', 'burst' );
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
	 * Burst Statistics endpoint for collecting hits.
	 *
	 * @param array<string, mixed> $data     Hit data payload. Mixed values represent diverse hit fields (integers, strings, booleans, arrays).
	 * @param int                  $hit_time Server timestamp at which the hit was received, set by the high-traffic buffer for
	 *                                       hits ingested later. 0 means now. Never taken from the payload, so a client cannot
	 *                                       date its own hits.
	 * @return string Result status.
	 */
	public function track_hit( array $data, int $hit_time = 0 ): string {
		$sanitized = $this->sanitize_hit( $data, $hit_time );
		if ( is_string( $sanitized ) ) {
			return $sanitized;
		}

		$resolved = $this->resolve_hit( $sanitized );
		if ( is_string( $resolved ) ) {
			return $resolved;
		}

		return $this->persist_hit( $resolved );
	}

	/**
	 * Validate and sanitize raw hit payload and environment.
	 *
	 * @param array<string, mixed> $data               Hit data payload.
	 * @param int                  $hit_time           Server timestamp for the hit, 0 for current time.
	 * @param bool                 $resolve_lookup_ids Whether to resolve lookup table IDs immediately.
	 * @return array<string, mixed>|string Sanitized tracking data on success, or rejection reason string.
	 */
	public function sanitize_hit( array $data, int $hit_time = 0, bool $resolve_lookup_ids = true ): array|string {
		$hit_time    = $hit_time > 0 ? $hit_time : time();
		$is_test_hit = $this->is_test_hit( $data['url'] ?? '' );
		if ( Ip::is_ip_blocked() && ! $is_test_hit ) {
			return 'ip blocked';
		}

		$sanitized_data = $this->prepare_tracking_data( $data, $resolve_lookup_ids );

		if ( $this->blocked_by_custom_block_rules( $sanitized_data ) ) {
			self::error_log( 'Custom block rule prevented tracking.' );
			return 'blocked by custom rule';
		}

		if ( 'spammer' === $sanitized_data['referrer'] ) {
			self::error_log( 'Referrer spam prevented.' );
			return 'referrer is spam';
		}

		if ( '' === $sanitized_data['uid'] && '' === $sanitized_data['fingerprint'] ) {
			self::error_log( 'Hit without uid or fingerprint rejected.' );
			return 'missing identity';
		}

		$sanitized_data['hit_time'] = $hit_time;

		return $sanitized_data;
	}

	/**
	 * Resolve hit context: classify hit type, match sessions, resolve dictionaries and schema columns.
	 *
	 * @param array<string, mixed>      $sanitized_data Sanitized hit data array from sanitize_hit().
	 * @param array<string, mixed>|null $previous_hit   Previous hit data, if already looked up.
	 * @param string|null               $hit_type       Hit type ('create' or 'update'), or null to auto-detect.
	 * @return array<string, mixed>|string Resolved hit context array on success, or failure string.
	 */
	public function resolve_hit( array $sanitized_data, ?array $previous_hit = null, ?string $hit_type = null ): array|string {
		$hit_time = (int) ( $sanitized_data['hit_time'] ?? time() );

		if ( null === $hit_type ) {
			$result = $this->get_hit_type( $sanitized_data, $hit_time );
			if ( empty( $result ) ) {
				return 'failed to determine hit type';
			}
			$hit_type     = $result['hit_type'];
			$previous_hit = $result['last_row'];
		}

		if ( $this->is_feature_enabled( 'co2' ) ) {
			Page_Weight_Store::maybe_store_sample( $sanitized_data, $hit_type, $previous_hit ?? [] );
		}

		$filtered_previous_hit = $previous_hit ?? [];
		$sanitized_data        = apply_filters( 'burst_before_track_hit', $sanitized_data, $hit_type, $filtered_previous_hit );

		$session = [
			'city_code'          => $sanitized_data['city_code'] ?? '',
			'referrer'           => $sanitized_data['referrer'],
			'bounce'             => $sanitized_data['bounce'] ?? 1,
			'browser_id'         => $sanitized_data['browser_id'] ?? 0,
			'browser_version_id' => $sanitized_data['browser_version_id'] ?? 0,
			'platform_id'        => $sanitized_data['platform_id'] ?? 0,
			'device_id'          => $sanitized_data['device_id'] ?? 0,
		];
		$session = apply_filters( 'burst_session_data', $session, $sanitized_data, $filtered_previous_hit, $hit_type );

		$search_term           = $sanitized_data['search_term'] ?? '';
		$events                = $sanitized_data['events'] ?? [];
		$external_link_url     = $sanitized_data['external_link_url'] ?? '';
		$external_link_urls    = $sanitized_data['external_link_urls'] ?? ( '' !== $external_link_url ? [ $external_link_url ] : [] );
		$should_load_ecommerce = ! empty( $sanitized_data['should_load_ecommerce'] );

		unset(
			$sanitized_data['city_code'],
			$sanitized_data['referrer'],
			$sanitized_data['bounce'],
			$sanitized_data['external_link_url'],
			$sanitized_data['external_link_urls'],
			$sanitized_data['browser_id'],
			$sanitized_data['browser_version_id'],
			$sanitized_data['platform_id'],
			$sanitized_data['device_id'],
			$sanitized_data['browser'],
			$sanitized_data['browser_version'],
			$sanitized_data['platform'],
			$sanitized_data['device'],
			$sanitized_data['search_term'],
			$sanitized_data['events'],
			$sanitized_data['should_load_ecommerce'],
			$sanitized_data['hit_time'],
			$sanitized_data['is_create']
		);
		$statistic = $sanitized_data;

		$destructured    = $this->sanitize_url( $statistic['host'] );
		$host            = $destructured['host'] ?? '';
		$normalized_host = preg_replace( '/^www\./i', '', $host );
		$is_multi_domain = get_option( 'burst_is_multi_domain' );

		if ( ! $is_multi_domain ) {
			$first_domain = get_option( 'burst_first_domain' );
			if ( empty( $first_domain ) ) {
				update_option( 'burst_is_multi_domain', false );
				update_option( 'burst_first_domain', $normalized_host, true );
			} elseif ( $first_domain !== $normalized_host ) {
				update_option( 'burst_is_multi_domain', true );
			}
		}

		if ( $this->get_option_bool( 'filtering_by_domain' ) ) {
			$session['host'] = $host;
		}

		$flag_pageview  = ( $statistic['page_type'] ?? '' ) !== '404' && $this->tracking_schema_at_least( '3.7.1' );
		$session_action = 'none';

		if ( isset( $previous_hit ) && ! empty( $previous_hit['session_id'] ) ) {
			$statistic['session_id'] = (int) $previous_hit['session_id'];
			if ( $flag_pageview && 0 === (int) ( $previous_hit['has_pageview'] ?? 1 ) ) {
				$session['has_pageview'] = 1;
			}
			if ( $this->session_needs_update( $previous_hit, $session ) ) {
				unset( $session['bounce'] );
				$session_action = 'update';
			}
		} elseif ( null === $previous_hit ) {
			$session_action = 'create';
			if ( $flag_pageview ) {
				$session['has_pageview'] = 1;
			}
			if ( $this->tracking_schema_current() ) {
				$session['start_time'] = $hit_time;
				$identity              = (string) ( $statistic['fingerprint'] ?: $statistic['uid'] );
				$session['uid_id']     = $this->resolve_uid_id( $identity );
				if ( $this->uid_dictionary_seeded() ) {
					$session['first_time_visit'] = $this->uid_created_this_request( $identity ) ? 1 : 0;
				}
			}
		}

		if ( ! empty( $statistic['fingerprint'] ) && empty( $statistic['uid'] ) ) {
			$this->store_fingerprint_in_session( (string) $statistic['fingerprint'], $should_load_ecommerce );
			$statistic['uid'] = $statistic['fingerprint'];
		}
		unset( $statistic['fingerprint'] );

		if ( $this->tracking_schema_current() ) {
			$statistic['uid_id'] = $this->resolve_uid_id( (string) $statistic['uid'] );
			unset( $statistic['uid'] );
		} else {
			unset( $statistic['max_scroll'], $statistic['dwell_zones'] );
		}

		$previous_page_url = $previous_hit['page_url'] ?? '';
		$new_page_url      = $statistic['page_url'];

		if ( $this->get_option_bool( 'track_url_change' ) ) {
			$previous_page_url .= ( $previous_hit['parameters'] ?? '' ) . '#' . ( $previous_hit['fragment'] ?? '' );
			$new_page_url      .= $statistic['parameters'] . '#' . $statistic['fragment'];
		}
		$is_same_url = $previous_page_url === $new_page_url;

		if ( 'create' === $hit_type ) {
			$page_id = (int) ( $statistic['page_id'] ?? 0 );
			if ( $page_id >= 0
				&& ( $statistic['page_type'] ?? '' ) !== '404'
				&& '' !== (string) ( $statistic['page_url'] ?? '' ) ) {
				$statistic['page_id'] = $this->resolve_page_id( (string) $statistic['page_url'], $page_id );
			}
			$statistic['time'] = $hit_time;
		}

		return [
			'hit_type'           => $hit_type,
			'statistic'          => $statistic,
			'session'            => $session,
			'session_action'     => $session_action,
			'previous_hit'       => $previous_hit,
			'is_same_url'        => $is_same_url,
			'search_term'        => $search_term,
			'events'             => $events,
			'external_link_urls' => $external_link_urls,
			'hit_time'           => $hit_time,
		];
	}

	/**
	 * Persist resolved hit to the database (sessions, statistics, goals, external links, events).
	 *
	 * @param array<string, mixed> $resolved Resolved hit data array from resolve_hit().
	 * @return string Result status ('success').
	 */
	public function persist_hit( array $resolved ): string {
		$statistic      = (array) ( $resolved['statistic'] ?? [] );
		$session        = (array) ( $resolved['session'] ?? [] );
		$session_action = (string) ( $resolved['session_action'] ?? '' );
		$hit_type       = (string) ( $resolved['hit_type'] ?? '' );
		$previous_hit   = isset( $resolved['previous_hit'] ) && is_array( $resolved['previous_hit'] ) ? $resolved['previous_hit'] : null;
		$is_same_url    = ! empty( $resolved['is_same_url'] );
		$search_term    = (string) ( $resolved['search_term'] ?? '' );
		$events         = (array) ( $resolved['events'] ?? [] );
		$ext_urls       = (array) ( $resolved['external_link_urls'] ?? [] );
		$statistic_id   = 0;

		if ( 'create' === $session_action ) {
			$statistic['session_id'] = $this->create_session( $session );
		} elseif ( 'update' === $session_action && ! empty( $statistic['session_id'] ) ) {
			$this->update_session( (int) $statistic['session_id'], $session );
		}

		if ( 'update' === $hit_type ) {
			$this->handle_statistic_updated(
				$statistic,
				$previous_hit,
				$ext_urls,
				$events,
				$is_same_url
			);
		} elseif ( 'create' === $hit_type ) {
			do_action( 'burst_before_create_statistic', $statistic );
			$insert_id = $this->create_statistic( $statistic );
			if ( $insert_id > 0 ) {
				$this->handle_statistic_created(
					$insert_id,
					$statistic,
					$search_term,
					$ext_urls,
					$events
				);
			}
		}

		return 'success';
	}

	/**
	 * Update an existing statistic row and execute side effects.
	 *
	 * Combines cumulative time_on_page with previous hit, updates the row,
	 * and executes goals, external links, and custom events.
	 *
	 * @param array<string, mixed> $statistic          Statistic row data (raw).
	 * @param array<string, mixed> $previous_hit       Previous hit data.
	 * @param array<string>        $external_link_urls List of external link URLs to record.
	 * @param array<mixed>         $events             Custom events array.
	 * @param bool                 $is_same_url        Whether the hit is for the same URL as previous hit.
	 * @return bool True if statistic was updated, false otherwise.
	 */
	public function handle_statistic_updated( array $statistic, array $previous_hit, array $external_link_urls = [], array $events = [], bool $is_same_url = true ): bool {
		if ( ! $is_same_url && ! empty( $previous_hit['session_id'] ) ) {
			return false;
		}

		if ( empty( $previous_hit['ID'] ) ) {
			return false;
		}

		$stat_id                   = (int) $previous_hit['ID'];
		$statistic['time_on_page'] = (int) ( $statistic['time_on_page'] ?? 0 ) + (int) ( $previous_hit['time_on_page'] ?? 0 );
		$statistic['ID']           = $stat_id;

		$updated = $this->update_statistic( $statistic );

		if ( $stat_id > 0 ) {
			$this->handle_hit_side_effects( $stat_id, $statistic, $external_link_urls, $events );
		}

		return $updated;
	}

	/**
	 * Handle goals, external links, and custom events for a stored statistic row.
	 *
	 * @param int                  $statistic_id       Statistic row ID.
	 * @param array<string, mixed> $statistic          Statistic row data.
	 * @param array<string>        $external_link_urls List of external link URLs to record.
	 * @param array<mixed>         $events             Custom events array.
	 */
	public function handle_hit_side_effects( int $statistic_id, array $statistic, array $external_link_urls = [], array $events = [] ): void {
		if ( $statistic_id <= 0 ) {
			return;
		}

		if ( $this->is_feature_enabled( 'goals' ) ) {
			$raw_goals       = (array) ( $statistic['completed_goals'] ?? [] );
			$completed_goals = $this->get_completed_goals(
				$raw_goals,
				(string) ( $statistic['page_url'] ?? '' ),
				(int) ( $statistic['page_id'] ?? 0 )
			);
			if ( ! empty( $completed_goals ) ) {
				$this->create_goal_statistic( $statistic_id, $completed_goals );
			}
		}

		foreach ( $external_link_urls as $url ) {
			if ( '' !== (string) $url ) {
				do_action( 'burst_track_external_link', $statistic_id, (string) $url );
			}
		}

		if ( ! empty( $events ) ) {
			$this->events()->record_events( $statistic_id, $events, (int) ( $statistic['uid_id'] ?? 0 ) );
		}
	}

	/**
	 * Run post-insert actions and side effects for a created statistic.
	 *
	 * Sets the generated ID, records search terms, fires burst_after_create_statistic,
	 * stores page weight sample if present, and registers goals, external links, and custom events.
	 *
	 * @param int                  $statistic_id       Created statistic ID.
	 * @param array<string, mixed> $statistic          Statistic row data.
	 * @param string               $search_term        Search term, if any.
	 * @param array<string>        $external_link_urls External link URLs to record.
	 * @param array<mixed>         $events             Custom events array.
	 */
	public function handle_statistic_created( int $statistic_id, array $statistic, string $search_term = '', array $external_link_urls = [], array $events = [] ): void {
		$statistic['ID'] = $statistic_id;
		if ( '' !== $search_term ) {
			$frontend_search = new Search();
			$frontend_search->init();
			$statistic['search_term'] = $search_term;
		}

		if ( ! empty( $statistic['page_weight_bytes'] ) && $this->is_feature_enabled( 'co2' ) && class_exists( 'Burst\Admin\Statistics\Page_Weight_Store' ) ) {
			Page_Weight_Store::maybe_store_sample(
				$statistic,
				'update',
				$statistic
			);
		}

		do_action( 'burst_after_create_statistic', $statistic_id, $statistic );
		$this->handle_hit_side_effects( $statistic_id, $statistic, $external_link_urls, $events );
	}

	/**
	 * Process a batch of buffered hit entries.
	 *
	 * Reads up to N lines, sanitizes with prepare_tracking_data, drops blocked IPs/bots,
	 * merges in-batch updates into create hits, resolves dictionaries in bulk (1 query per dictionary),
	 * looks up previous hits and session matching for all UIDs at once, and persists in one transaction.
	 *
	 * @param array<int, array<string, mixed>> $entries Raw buffered hit records.
	 * @return int Number of buffered hits ingested.
	 * @throws \Throwable Re-throws any exception after rolling back transaction.
	 */
	public function process_hit_batch( array $entries ): int {
		if ( empty( $entries ) ) {
			return 0;
		}

		$valid_hits    = [];
		$backup_server = $_SERVER;

		// 1. Sanitize all entries with sanitize_hit(), dropping invalid or blocked hits.
		foreach ( $entries as $entry ) {
			$payload = $entry['payload'] ?? null;
			if ( ! is_array( $payload ) ) {
				continue;
			}

			try {
				if ( ! empty( $entry['remote_addr'] ) ) {
					$_SERVER['REMOTE_ADDR'] = (string) $entry['remote_addr'];
				}
				if ( ! empty( $entry['headers'] ) && is_array( $entry['headers'] ) ) {
					foreach ( $entry['headers'] as $header_name => $header_value ) {
						$_SERVER[ (string) $header_name ] = (string) $header_value;
					}
				}

				$hit_time  = (int) ( $entry['time'] ?? 0 );
				$sanitized = $this->sanitize_hit( $payload, $hit_time, false );
				if ( is_array( $sanitized ) ) {
					$valid_hits[] = $sanitized;
				}
			} catch ( \Throwable $e ) {
				// Malformed hit entry in buffer; drop it and continue with remaining entries.
				continue;
			} finally {
				$_SERVER = $backup_server;
			}
		}

		if ( empty( $valid_hits ) ) {
			return 0;
		}

		// 2. In-batch update hit merging: merge update hits into their create hit within the batch.
		$merged_hits    = [];
		$active_creates = [];
		$active_updates = [];

		foreach ( $valid_hits as $hit ) {
			$is_update_hit = 0 === (int) ( $hit['browser_id'] ?? 0 )
				&& 0 === (int) ( $hit['browser_version_id'] ?? 0 )
				&& 0 === (int) ( $hit['platform_id'] ?? 0 )
				&& 0 === (int) ( $hit['device_id'] ?? 0 )
				&& '' === (string) ( $hit['browser'] ?? '' )
				&& '' === (string) ( $hit['browser_version'] ?? '' )
				&& '' === (string) ( $hit['platform'] ?? '' )
				&& '' === (string) ( $hit['device'] ?? '' );

			$identity = (string) ( $hit['fingerprint'] ?: $hit['uid'] );
			$url_key  = (string) ( $hit['page_url'] ?? '' ) . '?' . (string) ( $hit['parameters'] ?? '' ) . '#' . (string) ( $hit['fragment'] ?? '' );
			$pair_key = $identity . '|' . $url_key;

			if ( ! $is_update_hit ) {
				// New create hit: registers as the active create hit for this visitor + page.
				$idx                         = count( $merged_hits );
				$hit['is_create']            = true;
				$hit['external_link_urls']   = ! empty( $hit['external_link_url'] ) ? [ $hit['external_link_url'] ] : [];
				$merged_hits[ $idx ]         = $hit;
				$active_creates[ $pair_key ] = $idx;
				unset( $active_updates[ $pair_key ] );
			} elseif ( isset( $active_creates[ $pair_key ] ) ) {
				// Merge update into the active create hit in this batch.
				$target_idx                                  = $active_creates[ $pair_key ];
				$merged_hits[ $target_idx ]['time_on_page'] += (int) ( $hit['time_on_page'] ?? 0 );
				$merged_hits[ $target_idx ]['max_scroll']    = max( (int) ( $merged_hits[ $target_idx ]['max_scroll'] ?? 0 ), (int) ( $hit['max_scroll'] ?? 0 ) );
				if ( ! empty( $hit['dwell_zones'] ) ) {
					$merged_hits[ $target_idx ]['dwell_zones'] = $hit['dwell_zones'];
				}
				if ( ! empty( $hit['page_weight_bytes'] ) ) {
					$merged_hits[ $target_idx ]['page_weight_bytes'] = (int) $hit['page_weight_bytes'];
				}
				if ( ! empty( $hit['completed_goals'] ) ) {
					$merged_hits[ $target_idx ]['completed_goals'] = array_values(
						array_unique( array_merge( $merged_hits[ $target_idx ]['completed_goals'] ?? [], $hit['completed_goals'] ) )
					);
				}
				if ( ! empty( $hit['external_link_url'] ) ) {
					$merged_hits[ $target_idx ]['external_link_urls'][] = $hit['external_link_url'];
				}
				if ( ! empty( $hit['events'] ) ) {
					$merged_hits[ $target_idx ]['events'] = array_merge( $merged_hits[ $target_idx ]['events'] ?? [], $hit['events'] );
				}
			} elseif ( isset( $active_updates[ $pair_key ] ) ) {
				// Merge update into prior standalone update hit in this batch.
				$target_idx                                  = $active_updates[ $pair_key ];
				$merged_hits[ $target_idx ]['time_on_page'] += (int) ( $hit['time_on_page'] ?? 0 );
				$merged_hits[ $target_idx ]['max_scroll']    = max( (int) ( $merged_hits[ $target_idx ]['max_scroll'] ?? 0 ), (int) ( $hit['max_scroll'] ?? 0 ) );
				if ( ! empty( $hit['dwell_zones'] ) ) {
					$merged_hits[ $target_idx ]['dwell_zones'] = $hit['dwell_zones'];
				}
				if ( ! empty( $hit['page_weight_bytes'] ) ) {
					$merged_hits[ $target_idx ]['page_weight_bytes'] = (int) $hit['page_weight_bytes'];
				}
				if ( ! empty( $hit['completed_goals'] ) ) {
					$merged_hits[ $target_idx ]['completed_goals'] = array_values(
						array_unique( array_merge( $merged_hits[ $target_idx ]['completed_goals'] ?? [], $hit['completed_goals'] ) )
					);
				}
				if ( ! empty( $hit['external_link_url'] ) ) {
					$merged_hits[ $target_idx ]['external_link_urls'][] = $hit['external_link_url'];
				}
				if ( ! empty( $hit['events'] ) ) {
					$merged_hits[ $target_idx ]['events'] = array_merge( $merged_hits[ $target_idx ]['events'] ?? [], $hit['events'] );
				}
			} else {
				// Standalone update hit without prior create in this batch.
				$idx                         = count( $merged_hits );
				$hit['is_create']            = false;
				$hit['external_link_urls']   = ! empty( $hit['external_link_url'] ) ? [ $hit['external_link_url'] ] : [];
				$merged_hits[ $idx ]         = $hit;
				$active_updates[ $pair_key ] = $idx;
			}
		}

		// 3. Resolve all dictionary IDs with one query per dictionary per batch.
		$uids             = [];
		$page_urls        = [];
		$browsers         = [];
		$browser_versions = [];
		$platforms        = [];
		$devices          = [];
		$referrers        = [];

		foreach ( $merged_hits as $m_hit ) {
			$identity = (string) ( $m_hit['fingerprint'] ?: $m_hit['uid'] );
			if ( '' !== $identity ) {
				$uids[] = $identity;
			}
			if ( ! empty( $m_hit['page_url'] ) ) {
				$page_urls[] = (string) $m_hit['page_url'];
			}
			if ( ! empty( $m_hit['browser'] ) ) {
				$browsers[] = (string) $m_hit['browser'];
			}
			if ( ! empty( $m_hit['browser_version'] ) ) {
				$browser_versions[] = (string) $m_hit['browser_version'];
			}
			if ( ! empty( $m_hit['platform'] ) ) {
				$platforms[] = (string) $m_hit['platform'];
			}
			if ( ! empty( $m_hit['device'] ) ) {
				$devices[] = (string) $m_hit['device'];
			}
			if ( ! empty( $m_hit['referrer'] ) && 'spammer' !== $m_hit['referrer'] ) {
				$referrers[] = (string) $m_hit['referrer'];
			}
		}

		$this->bulk_resolve_lookup_table( 'browser', $browsers );
		$this->bulk_resolve_lookup_table( 'browser_version', $browser_versions );
		$this->bulk_resolve_lookup_table( 'platform', $platforms );
		$this->bulk_resolve_lookup_table( 'device', $devices );
		$this->bulk_resolve_lookup_table( 'referrer', $referrers );
		$this->bulk_resolve_uids( $uids );
		$this->bulk_resolve_page_urls( $page_urls );

		foreach ( $merged_hits as &$m_hit ) {
			if ( ! empty( $m_hit['browser'] ) ) {
				$m_hit['browser_id'] = $this->lookup_table_cache['browser'][ $m_hit['browser'] ] ?? 0;
			}
			if ( ! empty( $m_hit['browser_version'] ) ) {
				$m_hit['browser_version_id'] = $this->lookup_table_cache['browser_version'][ $m_hit['browser_version'] ] ?? 0;
			}
			if ( ! empty( $m_hit['platform'] ) ) {
				$m_hit['platform_id'] = $this->lookup_table_cache['platform'][ $m_hit['platform'] ] ?? 0;
			}
			if ( ! empty( $m_hit['device'] ) ) {
				$m_hit['device_id'] = $this->lookup_table_cache['device'][ $m_hit['device'] ] ?? 0;
			}
		}
		unset( $m_hit );

		// 4. Look up previous hits and session matching for all UIDs at once.
		$resolved_uid_ids = [];
		$min_time         = time();
		foreach ( $merged_hits as $m_hit ) {
			$identity = (string) ( $m_hit['fingerprint'] ?: $m_hit['uid'] );
			$uid_id   = $this->resolve_uid_id( $identity );
			if ( $uid_id > 0 ) {
				$resolved_uid_ids[ $uid_id ] = true;
			}
			$t = (int) ( $m_hit['hit_time'] ?? time() );
			if ( $t < $min_time ) {
				$min_time = $t;
			}
		}

		$recent_by_uid = [];
		if ( ! empty( $resolved_uid_ids ) ) {
			$recent_by_uid = $this->bulk_get_recent_statistics( array_keys( $resolved_uid_ids ), $min_time - ( 30 * MINUTE_IN_SECONDS ) );
		}

		$resolved_actions        = [];
		$pending_new_sessions    = [];
		$pending_session_updates = [];

		foreach ( $merged_hits as $m_hit ) {
			$identity  = (string) ( $m_hit['fingerprint'] ?: $m_hit['uid'] );
			$uid_id    = $this->resolve_uid_id( $identity );
			$hit_time  = (int) ( $m_hit['hit_time'] ?? time() );
			$is_create = ! empty( $m_hit['is_create'] );

			$user_history = $recent_by_uid[ $uid_id ] ?? [];
			$previous_hit = null;
			$hit_type     = $is_create ? 'create' : 'update';

			if ( ! $is_create ) {
				// For update hits: find matching previous hit with same parameters and fragment within 30 min.
				$destructured = $this->sanitize_url( $m_hit['host'] . $this->create_path( $m_hit ) );
				$params       = $destructured['parameters'];
				$fragment     = (string) ( $m_hit['fragment'] ?? '' );

				foreach ( $user_history as $hist_row ) {
					if ( (int) $hist_row['time'] > ( $hit_time - 30 * MINUTE_IN_SECONDS )
						&& (string) $hist_row['parameters'] === $params
						&& ( '' === $fragment || (string) $hist_row['fragment'] === $fragment )
					) {
						$previous_hit = $hist_row;
						break;
					}
				}

				if ( null === $previous_hit ) {
					// No matching previous row found for update hit; skip to prevent orphaned update.
					continue;
				}
			} else {
				// For create hits: find most recent hit within 30 min to reuse its session_id.
				foreach ( $user_history as $hist_row ) {
					if ( (int) $hist_row['time'] > ( $hit_time - 30 * MINUTE_IN_SECONDS ) && ( ! empty( $hist_row['session_id'] ) || isset( $hist_row['temp_session_idx'] ) ) ) {
						$previous_hit = $hist_row;
						break;
					}
				}
			}

			// Resolve hit context using shared resolve_hit().
			$resolved = $this->resolve_hit( $m_hit, $previous_hit, $hit_type );
			if ( is_string( $resolved ) ) {
				continue;
			}

			// Handle session allocation for batch persistence.
			if ( 'create' === $resolved['session_action'] ) {
				$temp_sess_idx                = count( $pending_new_sessions );
				$pending_new_sessions[]       = $resolved['session'];
				$resolved['temp_session_idx'] = $temp_sess_idx;
			} elseif ( isset( $previous_hit['temp_session_idx'] ) ) {
				$resolved['temp_session_idx'] = $previous_hit['temp_session_idx'];
			} elseif ( 'update' === $resolved['session_action'] && ! empty( $resolved['statistic']['session_id'] ) ) {
				$pending_session_updates[ (int) $resolved['statistic']['session_id'] ] = $resolved['session'];
			}

			$resolved_actions[] = $resolved;

			// Update in-memory user history so subsequent hits from this visitor in the same batch see it.
			$current_simulated_row = [
				'ID'                 => 0,
				'session_id'         => $resolved['statistic']['session_id'] ?? 0,
				'temp_session_idx'   => $resolved['temp_session_idx'] ?? null,
				'parameters'         => $resolved['statistic']['parameters'] ?? '',
				'fragment'           => $resolved['statistic']['fragment'] ?? '',
				'time'               => $hit_time,
				'time_on_page'       => $resolved['statistic']['time_on_page'] ?? 0,
				'page_url'           => $resolved['statistic']['page_url'] ?? '',
				'page_id'            => $resolved['statistic']['page_id'] ?? 0,
				'uid_id'             => $uid_id,
				'has_pageview'       => $resolved['session']['has_pageview'] ?? 1,
				'bounce'             => 1,
				'host'               => $resolved['session']['host'] ?? '',
				'start_time'         => $resolved['session']['start_time'] ?? $hit_time,
				'referrer'           => $resolved['session']['referrer'] ?? '',
				'city_code'          => $resolved['session']['city_code'] ?? 0,
				'browser_id'         => $resolved['session']['browser_id'] ?? 0,
				'browser_version_id' => $resolved['session']['browser_version_id'] ?? 0,
				'platform_id'        => $resolved['session']['platform_id'] ?? 0,
				'device_id'          => $resolved['session']['device_id'] ?? 0,
			];
			if ( ! isset( $recent_by_uid[ $uid_id ] ) ) {
				$recent_by_uid[ $uid_id ] = [];
			}
			array_unshift( $recent_by_uid[ $uid_id ], $current_simulated_row );
		}

		// 5. Write in one transaction: one multi-row INSERT for new sessions, one INSERT for new statistics, then remaining updates.
		global $wpdb;
		$wpdb->query( 'START TRANSACTION' );

		try {
			// A. Insert new sessions.
			$first_session_id = 0;
			if ( ! empty( $pending_new_sessions ) ) {
				$first_session_id = $this->batch_insert_sessions( $pending_new_sessions );
			}

			// Assign generated session IDs to resolved create actions.
			$create_stats = [];
			$update_stats = [];
			$increment    = $this->get_auto_increment_increment();

			foreach ( $resolved_actions as &$action ) {
				if ( isset( $action['temp_session_idx'] ) ) {
					$action['statistic']['session_id'] = $first_session_id + ( $action['temp_session_idx'] * $increment );
					unset( $action['temp_session_idx'] );
				}

				if ( 'create' === $action['hit_type'] ) {
					$create_stats[] = $action;
				} else {
					$update_stats[] = $action;
				}
			}
			unset( $action );

			// B. Update existing sessions if needed.
			foreach ( $pending_session_updates as $sess_id => $sess_data ) {
				$this->update_session( $sess_id, $sess_data );
			}

			// C. Multi-row INSERT for new statistics.
			$first_stat_id      = 0;
			$valid_create_stats = [];
			$stats_to_insert    = [];
			if ( ! empty( $create_stats ) ) {
				foreach ( $create_stats as $c_action ) {
					$norm_stat = $this->normalize_statistic_data( $c_action['statistic'] );
					if ( null !== $norm_stat ) {
						$valid_create_stats[] = $c_action;
						$stats_to_insert[]    = $norm_stat;
					}
				}
				$create_stats = $valid_create_stats;

				foreach ( $create_stats as $c_action ) {
					do_action( 'burst_before_create_statistic', $c_action['statistic'] );
				}

				if ( ! empty( $stats_to_insert ) ) {
					$first_stat_id = $this->batch_insert_statistics( $stats_to_insert );
				}
			}

			// D. Execute remaining updates on existing statistics.
			$updated_count = 0;
			foreach ( $update_stats as $u_action ) {
				if ( $this->handle_statistic_updated(
					$u_action['statistic'],
					$u_action['previous_hit'],
					$u_action['external_link_urls'],
					$u_action['events'],
					! empty( $u_action['is_same_url'] )
				) ) {
					++$updated_count;
				}
			}

			// E. Trigger actions and side effects for create hits.
			foreach ( $create_stats as $c_idx => $c_action ) {
				$stat_id = $first_stat_id + ( $c_idx * $increment );
				$this->handle_statistic_created(
					$stat_id,
					$c_action['statistic'],
					(string) ( $c_action['search_term'] ?? '' ),
					(array) ( $c_action['external_link_urls'] ?? [] ),
					(array) ( $c_action['events'] ?? [] )
				);
			}

			$wpdb->query( 'COMMIT' );
		} catch ( \Throwable $e ) {
			$wpdb->query( 'ROLLBACK' );
			throw $e;
		}

		return count( $create_stats ) + $updated_count;
	}

	/**
	 * Bulk resolve names to IDs for a lookup table (burst_browsers, burst_devices, etc.).
	 *
	 * Populates $this->lookup_table_cache and inserts any missing values with INSERT IGNORE.
	 *
	 * @param string        $item   Lookup table item name (browser, browser_version, platform, device, referrer).
	 * @param array<string> $values List of string values to resolve.
	 */
	public function bulk_resolve_lookup_table( string $item, array $values ): void {
		$possible_items = [ 'browser', 'browser_version', 'platform', 'device', 'referrer' ];
		if ( ! in_array( $item, $possible_items, true ) ) {
			return;
		}

		$values = array_values( array_unique( array_filter( array_map( 'strval', $values ), static fn( string $v ): bool => '' !== $v ) ) );
		if ( empty( $values ) ) {
			return;
		}

		$missing = [];
		foreach ( $values as $val ) {
			if ( ! isset( $this->lookup_table_cache[ $item ][ $val ] ) ) {
				$cache_key = self::lookup_cache_key( $item, $val );
				$cached_id = wp_cache_get( $cache_key, 'burst' );
				if ( false !== $cached_id && (int) $cached_id > 0 ) {
					$this->lookup_table_cache[ $item ][ $val ] = (int) $cached_id;
				} else {
					$missing[] = $val;
				}
			}
		}

		if ( empty( $missing ) ) {
			return;
		}

		global $wpdb;
		$table        = $wpdb->prefix . "burst_{$item}s";
		$placeholders = implode( ', ', array_fill( 0, count( $missing ), '%s' ) );

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$existing = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, name FROM {$table} WHERE name IN ( {$placeholders} )", $missing ),
			ARRAY_A
		);
		// phpcs:enable

		$found_names = [];
		foreach ( (array) $existing as $row ) {
			$id   = (int) $row['ID'];
			$name = (string) $row['name'];
			$this->lookup_table_cache[ $item ][ $name ] = $id;
			$found_names[ $name ]                       = true;
			wp_cache_set( self::lookup_cache_key( $item, $name ), $id, 'burst', 300 );
		}

		$to_insert = array_values( array_diff( $missing, array_keys( $found_names ) ) );
		if ( empty( $to_insert ) ) {
			return;
		}

		$insert_placeholders = [];
		$insert_args         = [];
		foreach ( $to_insert as $insert_val ) {
			$insert_placeholders[] = '(%s)';
			$insert_args[]         = $insert_val;
		}

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (name) VALUES " . implode( ', ', $insert_placeholders ),
				$insert_args
			)
		);

		$re_placeholders = implode( ', ', array_fill( 0, count( $to_insert ), '%s' ) );
		$inserted        = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, name FROM {$table} WHERE name IN ( {$re_placeholders} )", $to_insert ),
			ARRAY_A
		);
		// phpcs:enable

		foreach ( (array) $inserted as $row ) {
			$id   = (int) $row['ID'];
			$name = (string) $row['name'];
			$this->lookup_table_cache[ $item ][ $name ] = $id;
			wp_cache_set( self::lookup_cache_key( $item, $name ), $id, 'burst', 300 );
		}
	}

	/**
	 * Bulk resolve visitor UID strings to IDs in burst_uids.
	 *
	 * Populates self::$uid_dictionary_cache and records new UIDs in self::$uids_created_this_request.
	 *
	 * @param array<string> $uids List of visitor UIDs.
	 */
	public function bulk_resolve_uids( array $uids ): void {
		$uids = array_values( array_unique( array_filter( array_map( 'strval', $uids ), static fn( string $u ): bool => '' !== $u ) ) );
		if ( empty( $uids ) ) {
			return;
		}

		$blog_id = get_current_blog_id();
		$missing = [];

		foreach ( $uids as $uid ) {
			if ( ! isset( self::$uid_dictionary_cache[ $blog_id ][ $uid ] ) ) {
				$cache_key = self::uid_id_cache_key( $uid );
				$found     = false;
				$cached    = wp_cache_get( $cache_key, 'burst', false, $found );
				if ( $found && false !== $cached && (int) $cached > 0 ) {
					self::$uid_dictionary_cache[ $blog_id ][ $uid ] = (int) $cached;
				} else {
					$missing[] = $uid;
				}
			}
		}

		if ( empty( $missing ) ) {
			return;
		}

		global $wpdb;
		$table        = $wpdb->prefix . 'burst_uids';
		$placeholders = implode( ', ', array_fill( 0, count( $missing ), '%s' ) );

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$existing = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, uid FROM {$table} WHERE uid IN ( {$placeholders} )", $missing ),
			ARRAY_A
		);
		// phpcs:enable

		$found_uids = [];
		foreach ( (array) $existing as $row ) {
			$id  = (int) $row['ID'];
			$uid = (string) $row['uid'];
			self::$uid_dictionary_cache[ $blog_id ][ $uid ] = $id;
			$found_uids[ $uid ]                             = true;
			wp_cache_set( self::uid_id_cache_key( $uid ), $id, 'burst', 300 );
		}

		$to_insert = array_values( array_diff( $missing, array_keys( $found_uids ) ) );
		if ( empty( $to_insert ) ) {
			return;
		}

		$insert_placeholders = [];
		$insert_args         = [];
		foreach ( $to_insert as $insert_uid ) {
			$insert_placeholders[] = '(%s)';
			$insert_args[]         = $insert_uid;
		}

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (uid) VALUES " . implode( ', ', $insert_placeholders ),
				$insert_args
			)
		);

		$re_placeholders = implode( ', ', array_fill( 0, count( $to_insert ), '%s' ) );
		$inserted        = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, uid FROM {$table} WHERE uid IN ( {$re_placeholders} )", $to_insert ),
			ARRAY_A
		);
		// phpcs:enable

		foreach ( (array) $inserted as $row ) {
			$id  = (int) $row['ID'];
			$uid = (string) $row['uid'];
			self::$uid_dictionary_cache[ $blog_id ][ $uid ]      = $id;
			self::$uids_created_this_request[ $blog_id ][ $uid ] = true;
			wp_cache_set( self::uid_id_cache_key( $uid ), $id, 'burst', 300 );
		}
	}

	/**
	 * Bulk resolve page URL paths to dictionary IDs in burst_page_urls.
	 *
	 * Populates self::$page_dictionary_cache so resolve_page_id() resolves with 0 queries.
	 *
	 * @param array<string> $page_urls List of page URL paths.
	 */
	public function bulk_resolve_page_urls( array $page_urls ): void {
		$page_urls = array_values( array_unique( array_filter( array_map( 'strval', $page_urls ), static fn( string $p ): bool => '' !== $p ) ) );
		if ( empty( $page_urls ) ) {
			return;
		}

		$blog_id = get_current_blog_id();
		$missing = [];

		foreach ( $page_urls as $url ) {
			if ( ! isset( self::$page_dictionary_cache[ $blog_id ][ $url ] ) ) {
				$cached = wp_cache_get( $this->page_id_cache_key( $url ), 'burst' );
				if ( false !== $cached ) {
					self::$page_dictionary_cache[ $blog_id ][ $url ] = (int) $cached;
				} else {
					$missing[] = $url;
				}
			}
		}

		if ( empty( $missing ) ) {
			return;
		}

		global $wpdb;
		$table        = $wpdb->prefix . 'burst_page_urls';
		$placeholders = implode( ', ', array_fill( 0, count( $missing ), '%s' ) );

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$existing = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, page_url, page_id FROM {$table} WHERE page_url IN ( {$placeholders} )", $missing ),
			ARRAY_A
		);
		// phpcs:enable

		$found_urls = [];
		foreach ( (array) $existing as $row ) {
			$id      = (int) $row['ID'];
			$url     = (string) $row['page_url'];
			$page_id = (int) $row['page_id'];
			$known   = $page_id > 0 ? $page_id : -$id;
			self::$page_dictionary_cache[ $blog_id ][ $url ] = $known;
			$found_urls[ $url ]                              = true;
			wp_cache_set( $this->page_id_cache_key( $url ), $known, 'burst', 300 );
		}

		$to_insert = array_values( array_diff( $missing, array_keys( $found_urls ) ) );
		if ( empty( $to_insert ) ) {
			return;
		}

		$insert_placeholders = [];
		$insert_args         = [];
		foreach ( $to_insert as $insert_url ) {
			$insert_placeholders[] = '(%s, 0)';
			$insert_args[]         = $insert_url;
		}

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (page_url, page_id) VALUES " . implode( ', ', $insert_placeholders ),
				$insert_args
			)
		);

		$re_placeholders = implode( ', ', array_fill( 0, count( $to_insert ), '%s' ) );
		$inserted        = $wpdb->get_results(
			$wpdb->prepare( "SELECT ID, page_url, page_id FROM {$table} WHERE page_url IN ( {$re_placeholders} )", $to_insert ),
			ARRAY_A
		);
		// phpcs:enable

		foreach ( (array) $inserted as $row ) {
			$id      = (int) $row['ID'];
			$url     = (string) $row['page_url'];
			$page_id = (int) $row['page_id'];
			$known   = $page_id > 0 ? $page_id : -$id;
			self::$page_dictionary_cache[ $blog_id ][ $url ] = $known;
			wp_cache_set( $this->page_id_cache_key( $url ), $known, 'burst', 300 );
		}
	}

	/**
	 * Bulk look up recent statistics and session rows for a list of UID IDs.
	 *
	 * @param array<int> $uid_ids           List of resolved uid_ids.
	 * @param int        $time_window_start Minimum timestamp threshold.
	 * @return array<int, array<int, array<string, mixed>>> History rows grouped by uid_id.
	 */
	public function bulk_get_recent_statistics( array $uid_ids, int $time_window_start ): array {
		if ( empty( $uid_ids ) ) {
			return [];
		}

		global $wpdb;
		$placeholders    = implode( ', ', array_fill( 0, count( $uid_ids ), '%d' ) );
		$host_select     = $this->get_option_bool( 'filtering_by_domain' ) ? ', sess.host' : '';
		$pageview_select = $this->tracking_schema_at_least( '3.7.1' ) ? ', sess.has_pageview' : '';
		$session_select  = $this->tracking_schema_current()
			? ', sess.' . implode( ', sess.', self::SESSION_BACKFILL_COLUMNS ) . ', sess.source, sess.source_category'
			: '';

		$params = array_merge( $uid_ids, [ $time_window_start ] );

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT
					s.ID,
					s.session_id,
					s.parameters,
					s.fragment,
					s.time_on_page,
					s.time,
					sess.bounce,
					s.page_url,
					s.page_id,
					s.uid_id
					{$host_select}
					{$pageview_select}
					{$session_select}
				FROM {$wpdb->prefix}burst_statistics s
				LEFT JOIN {$wpdb->prefix}burst_sessions sess ON s.session_id = sess.ID
				WHERE s.uid_id IN ( {$placeholders} )
				  AND s.time > %d
				ORDER BY s.ID DESC",
				$params
			),
			ARRAY_A
		);
		// phpcs:enable

		$grouped = [];
		foreach ( (array) $rows as $row ) {
			$grouped[ (int) $row['uid_id'] ][] = $row;
		}

		return $grouped;
	}

	/**
	 * Insert multiple session rows in a single multi-row query.
	 *
	 * @param array<int, array<string, mixed>> $sessions List of session data arrays to insert.
	 * @return int ID of the first inserted session row.
	 * @throws \RuntimeException If the batch insert fails or returns no insert ID.
	 */
	public function batch_insert_sessions( array $sessions ): int {
		global $wpdb;
		if ( empty( $sessions ) ) {
			return 0;
		}

		$columns = [
			'start_time',
			'uid_id',
			'first_time_visit',
			'bounce',
			'has_pageview',
			'browser_id',
			'browser_version_id',
			'platform_id',
			'device_id',
			'referrer',
			'host',
			'city_code',
			'source',
			'source_category',
			'source_mapped',
		];

		$row_placeholders = [];
		$values           = [];
		foreach ( $sessions as $session ) {
			$session             = $this->normalize_session_data( $session );
			$has_referrer        = ! empty( $session['referrer'] );
			$ref_placeholder     = $has_referrer ? '%s' : 'NULL';
			$has_source          = ! empty( $session['source'] );
			$src_placeholder     = $has_source ? '%s' : 'NULL';
			$has_source_cat      = ! empty( $session['source_category'] );
			$src_cat_placeholder = $has_source_cat ? '%s' : 'NULL';

			$row_placeholders[] = "(%d, %d, %d, %d, %d, %d, %d, %d, %d, {$ref_placeholder}, %s, %d, {$src_placeholder}, {$src_cat_placeholder}, %d)";

			$values[] = (int) ( $session['start_time'] ?? time() );
			$values[] = (int) ( $session['uid_id'] ?? 0 );
			$values[] = (int) ( $session['first_time_visit'] ?? 0 );
			$values[] = (int) ( $session['bounce'] ?? 1 );
			$values[] = (int) ( $session['has_pageview'] ?? 0 );
			$values[] = (int) ( $session['browser_id'] ?? 0 );
			$values[] = (int) ( $session['browser_version_id'] ?? 0 );
			$values[] = (int) ( $session['platform_id'] ?? 0 );
			$values[] = (int) ( $session['device_id'] ?? 0 );
			if ( $has_referrer ) {
				$values[] = (string) $session['referrer'];
			}
			$values[] = (string) ( $session['host'] ?? '' );
			$values[] = (int) ( $session['city_code'] ?? 0 );
			if ( $has_source ) {
				$values[] = (string) $session['source'];
			}
			if ( $has_source_cat ) {
				$values[] = (string) $session['source_category'];
			}
			$values[] = (int) ( $session['source_mapped'] ?? 0 );
		}

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
		$sql    = "INSERT INTO {$wpdb->prefix}burst_sessions (`" . implode( '`, `', $columns ) . '`) VALUES ' . implode( ', ', $row_placeholders );
		$result = $wpdb->query( $wpdb->prepare( $sql, $values ) );
		// phpcs:enable

		if ( false === $result || ! empty( $wpdb->last_error ) || $wpdb->insert_id <= 0 ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			throw new \RuntimeException( 'Failed batch insert into ' . $wpdb->prefix . 'burst_sessions: ' . ( $wpdb->last_error ?: 'no insert id' ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Insert multiple statistic rows in a single multi-row query.
	 *
	 * @param array<int, array<string, mixed>> $statistics List of statistic data arrays to insert.
	 * @return int ID of the first inserted statistic row.
	 * @throws \RuntimeException If the batch insert fails or returns no insert ID.
	 */
	public function batch_insert_statistics( array $statistics ): int {
		global $wpdb;
		if ( empty( $statistics ) ) {
			return 0;
		}

		$columns = [
			'page_url',
			'page_id',
			'page_type',
			'time',
			'uid_id',
			'time_on_page',
			'max_scroll',
			'dwell_zones',
			'parameters',
			'fragment',
			'session_id',
		];

		$row_placeholders = [];
		$values           = [];
		$max_time         = 0;

		foreach ( $statistics as $stat ) {
			$t                  = (int) ( $stat['time'] ?? time() );
			$max_time           = max( $max_time, $t );
			$has_dwell          = ! empty( $stat['dwell_zones'] );
			$dwell_placeholder  = $has_dwell ? '%s' : 'NULL';
			$row_placeholders[] = "(%s, %d, %s, %d, %d, %d, %d, {$dwell_placeholder}, %s, %s, %d)";

			$values[] = (string) ( $stat['page_url'] ?? '' );
			$values[] = (int) ( $stat['page_id'] ?? 0 );
			$values[] = (string) ( $stat['page_type'] ?? '' );
			$values[] = $t;
			$values[] = (int) ( $stat['uid_id'] ?? 0 );
			$values[] = (int) ( $stat['time_on_page'] ?? 0 );
			$values[] = (int) ( $stat['max_scroll'] ?? 0 );
			if ( $has_dwell ) {
				$values[] = (string) $stat['dwell_zones'];
			}
			$values[] = (string) ( $stat['parameters'] ?? '' );
			$values[] = (string) ( $stat['fragment'] ?? '' );
			$values[] = (int) ( $stat['session_id'] ?? 0 );
		}

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
		$sql    = "INSERT INTO {$wpdb->prefix}burst_statistics (`" . implode( '`, `', $columns ) . '`) VALUES ' . implode( ', ', $row_placeholders );
		$result = $wpdb->query( $wpdb->prepare( $sql, $values ) );
		// phpcs:enable

		if ( false === $result || ! empty( $wpdb->last_error ) || $wpdb->insert_id <= 0 ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			throw new \RuntimeException( 'Failed batch insert into ' . $wpdb->prefix . 'burst_statistics: ' . ( $wpdb->last_error ?: 'no insert id' ) );
		}

		$first_id = (int) $wpdb->insert_id;
		if ( $max_time > 0 ) {
			$this->stamp_last_hit_time( $max_time );
		}

		return $first_id;
	}

	/**
	 * Create a path from the sanitized data.
	 */
	public function create_path( array $sanitized_data ): string {
		return empty( $sanitized_data['parameters'] ) ? $sanitized_data['page_url'] : $sanitized_data['page_url'] . '?' . $sanitized_data['parameters'];
	}

	/**
	 * Apply custom block rules to the sanitized data. Rules can be simple strings or regex patterns. Examples of regex patterns:
	 * /text-in-url[0-9]+/i
	 * /^https:\/\/domain\./
	 * /facebook(bot|crawler)/i
	 *
	 * @param array $sanitized_data The sanitized tracking data.
	 * @return bool If the request should be blocked.
	 */
	private function blocked_by_custom_block_rules( array $sanitized_data ): bool {
		$block_rules = (string) $this->get_option( 'custom_block_rules' );
		if ( empty( $block_rules ) ) {
			return false;
		}

		$page_url   = $sanitized_data['host'] . $this->create_path( $sanitized_data );
		$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
		$referrer   = $sanitized_data['referrer'];

		// Explode by new line, trim each line and filter out empty lines.
		$block_rules_array = array_filter(
			array_map( 'trim', explode( "\n", $block_rules ) ),
			fn( $rule ) => $rule !== ''
		);
		foreach ( $block_rules_array as $rule ) {
			// Check if rule looks like regex (starts and ends with / and has valid delimiters).
			$is_regex = preg_match( '/^\/.*\/[imsxu]*$/', $rule );

			if ( $is_regex ) {
				$fields_to_check = [
					$page_url,
					$referrer,
					$user_agent,
				];

				foreach ( $fields_to_check as $field ) {
                    // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Intentionally suppressing errors for user-provided regex patterns.
					$match_result = @preg_match( $rule, $field );

					// Check for regex errors (returns false on invalid pattern).
					if ( $match_result === false ) {
						self::error_log( sprintf( 'Invalid regex pattern in custom block rules: %s', $rule ) );
						// Skip to next rule.
						break;
					}

					// Check for match.
					if ( $match_result === 1 ) {
						return true;
					}
				}
			} elseif ( stripos( $page_url, $rule ) !== false ||
				stripos( $referrer, $rule ) !== false ||
				stripos( $user_agent, $rule ) !== false
			) {
				return true;
			}
		}

		return false;
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
		$raw_data = $request->get_json_params();

		// API expects JSON string, not pre-parsed array.
		if ( ! is_string( $raw_data ) ) {
			return $this->rest_tracking_response(
				[ 'error' => 'Invalid request format' ],
				400
			);
		}

		$data = json_decode( $raw_data, true );
		if ( isset( $data['request'] ) && $data['request'] === 'test' ) {
			return $this->rest_tracking_response( [ 'success' => 'test' ], 200 );
		}

		if ( is_array( $data ) ) {
			$this->track_hit( $data );
		} else {
			self::error_log( 'The posted data has to be an array. Please check if your Javascript code is cached, using the old version.' );
		}

		return $this->rest_tracking_response( [ 'success' => 'hit_tracked' ], 200 );
	}

	/**
	 * Create a non-cacheable response for the public REST tracking route.
	 *
	 * @param array<string, string> $data   Response data.
	 * @param int                   $status HTTP status code.
	 */
	private function rest_tracking_response( array $data, int $status ): \WP_REST_Response {
		$response = new \WP_REST_Response( $data, $status );
		$headers  = apply_filters( 'burst_tracking_response_headers', wp_get_nocache_headers() );
		unset( $headers['Last-Modified'] );
		foreach ( $headers as $header => $value ) {
			$response->header( $header, $value );
		}

		return $response;
	}

	/**
	 * Verify if this is a test hit, using nonce verification to prevent bypassing the ip block.
	 */
	private function is_test_hit( string $url ): bool {
		if ( empty( $url ) ) {
			return false;
		}

		$test_hit = str_contains( $url, 'burst_test_hit' );
		if ( ! $test_hit ) {
			return false;
		}
		// extract nonce from url.
		$nonce = null;

		// wp_parse_url() isn't available in shortinit.
        // phpcs:ignore
		$parsed = parse_url( $url );

		if ( isset( $parsed['query'] ) ) {
			parse_str( $parsed['query'], $query_params );
			$nonce = $query_params['nonce'] ?? null;
		}
		$stored_token = get_transient( 'burst_onboarding_token' );
		if ( empty( $stored_token ) || empty( $nonce ) ) {
			return false;
		}
		return hash_equals( $stored_token, $nonce );
	}

	/**
	 * Prepare and sanitize raw tracking data from the client for storage.
	 *
	 * @param array<string, mixed> $data Raw tracking data input.
	 * @param bool                 $resolve_lookup_ids Whether to eagerly resolve lookup table IDs.
	 * @return array{
	 *     completed_goals: array<int>,
	 *     parameters: string,
	 *     page_url: string,
	 *     host: string,
	 *     uid: string,
	 *     fingerprint: string,
	 *     referrer: string,
	 *     external_link_url: string,
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
	public function prepare_tracking_data( array $data, bool $resolve_lookup_ids = true ): array {
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
			'external_link_url'     => null,
			'user_agent'            => null,
			'time_on_page'          => null,
			'completed_goals'       => null,
			'events'                => null,
			'page_id'               => null,
			'page_type'             => null,
			'should_load_ecommerce' => false,
			'page_weight_bytes'     => 0,
		];
		$data     = wp_parse_args( $data, $defaults );

		$privacy_level = $this->get_option( 'privacy_level', 'cookie' );
		if ( $privacy_level === 'private_mode' ) {
			$data['fingerprint'] = null;
			$data['uid']         = $this->get_private_uid();
		}

		// update array.
		$sanitized_data                    = [];
		$destructured_url                  = $this->sanitize_url( $data['url'] );
		$completed_goals                   = ( $this->is_feature_enabled( 'goals' ) && is_array( $data['completed_goals'] ?? null ) ) ? $data['completed_goals'] : [];
		$sanitized_data['completed_goals'] = $this->sanitize_completed_goal_ids( $completed_goals );
		// required.
		$sanitized_data['parameters'] = $destructured_url['parameters'];
		// The fragment column is varchar(255); cap it so a strict sql_mode never rejects the whole hit.
		$sanitized_data['fragment'] = substr( $destructured_url['fragment'], 0, 255 );
		// required.
		$sanitized_data['page_url'] = $destructured_url['path'];
		$sanitized_data['host']     = $destructured_url['scheme'] . '://' . $destructured_url['host'];
		// required.
		$sanitized_data['uid']                = $this->sanitize_uid( $data['uid'] );
		$sanitized_data['fingerprint']        = $this->sanitize_fingerprint( $data['fingerprint'] );
		$sanitized_data['referrer']           = $this->sanitize_referrer( $data['referrer_url'] );
		$sanitized_data['external_link_url']  = $this->sanitize_external_link_url( $data['external_link_url'] );
		$sanitized_data['browser']            = $user_agent_data['browser'];
		$sanitized_data['browser_version']    = $user_agent_data['browser_version'];
		$sanitized_data['platform']           = $user_agent_data['platform'];
		$sanitized_data['device']             = $user_agent_data['device'];
		$sanitized_data['browser_id']         = $resolve_lookup_ids ? self::get_lookup_table_id( 'browser', $user_agent_data['browser'] ) : 0;
		$sanitized_data['browser_version_id'] = $resolve_lookup_ids ? self::get_lookup_table_id( 'browser_version', $user_agent_data['browser_version'] ) : 0;
		$sanitized_data['platform_id']        = $resolve_lookup_ids ? self::get_lookup_table_id( 'platform', $user_agent_data['platform'] ) : 0;
		$sanitized_data['device_id']          = $resolve_lookup_ids ? self::get_lookup_table_id( 'device', $user_agent_data['device'] ) : 0;
		$sanitized_data['time_on_page']       = $this->sanitize_time_on_page( $data['time_on_page'] );
		$sanitized_data['bounce']             = 1;
		$sanitized_data['page_id']            = (int) $data['page_id'];
		$sanitized_data['page_type']          = $this->sanitize_page_identifier( $data['page_type'] );
		if ( ! $this->is_feature_enabled( 'scroll_depth' ) ) {
			$sanitized_data['max_scroll']  = 0;
			$sanitized_data['dwell_zones'] = '';
		} else {
			$sanitized_data['max_scroll']  = isset( $data['max_scroll'] ) ? min( 100, max( 0, (int) $data['max_scroll'] ) ) : 0;
			$sanitized_data['dwell_zones'] = $this->sanitize_dwell_zones( $data['dwell_zones'] ?? '' );
		}
		$sanitized_data['should_load_ecommerce'] = filter_var( $data['should_load_ecommerce'], FILTER_VALIDATE_BOOLEAN );
		$sanitized_data['search_term']           = isset( $data['search_term'] ) ? sanitize_text_field( wp_unslash( (string) $data['search_term'] ) ) : '';
		$sanitized_data['page_weight_bytes']     = (int) $data['page_weight_bytes'];
		// Opt-in: a cached page or a hand-crafted beacon can still send events after the site turned them off.
		$raw_events               = $this->get_option_bool( 'enable_custom_events' ) && is_array( $data['events'] ?? null ) ? $data['events'] : [];
		$sanitized_data['events'] = empty( $raw_events ) ? [] : $this->events()->sanitize_events( $raw_events );

		return $sanitized_data;
	}

	/**
	 * Get the frontend events handler only when a hit actually contains events.
	 */
	private function events(): Events {
		if ( null === $this->events_handler ) {
			$this->events_handler = new Events();
		}
		return $this->events_handler;
	}

	/**
	 * Generate a private mode UID.
	 */
	private function get_private_uid(): string {
		$ip   = Ip::get_ip_address();
		$ua   = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
		$salt = $this->get_rotating_salt();
		return hash( 'sha256', $ip . $ua . $salt );
	}

	/**
	 * Get the rotating salt for private mode tracking.
	 */
	private function get_rotating_salt(): string {
		$option_name = 'burst_rotating_salt';
		$stored      = get_option( $option_name, [] );
		$today       = gmdate( 'Y-m-d' );

		if ( ! is_array( $stored ) || empty( $stored['salt'] ) || empty( $stored['date'] ) || $stored['date'] !== $today ) {
			$salt   = bin2hex( random_bytes( 32 ) );
			$stored = [
				'date' => $today,
				'salt' => $salt,
			];
			update_option( $option_name, $stored, false );
		}

		return $stored['salt'];
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
	 * Sanitize tracked external link URL.
	 */
	private function sanitize_external_link_url( ?string $external_link_url ): string {
		if ( empty( $external_link_url ) ) {
			return '';
		}

		$url = esc_url_raw( $external_link_url, [ 'http', 'https' ] );
		if ( empty( $url ) ) {
			return '';
		}

		$parsed = wp_parse_url( $url );
		if ( empty( $parsed['scheme'] ) || empty( $parsed['host'] ) ) {
			return '';
		}

		if ( ! in_array( $parsed['scheme'], [ 'http', 'https' ], true ) ) {
			return '';
		}

		return $url;
	}

	/**
	 * Determines if the current hit is an update or create operation and retrieves the last matching row if applicable.
	 *
	 * @param array<string, mixed> $data     Data for the current hit.
	 * @param int                  $hit_time Server timestamp of the hit; the 30-minute session window is measured from it.
	 * @return array{
	 *     hit_type?: 'create'|'update',
	 *     last_row?: array<string, mixed>|null
	 * } Associative array containing hit type and last row (if any), or an empty array if not applicable.
	 */
	public function get_hit_type( array $data, int $hit_time = 0 ): array {
		// Determine if it is an update hit based on the absence of certain data points.
		$is_update_hit = $data['browser_id'] === 0 && $data['browser_version_id'] === 0 && $data['platform_id'] === 0 && $data['device_id'] === 0;

		// Attempt to get the last user statistic based on the presence or absence of certain conditions.
		$page_url = $is_update_hit ? $data['host'] . $this->create_path( $data ) : '';
		$fragment = $is_update_hit ? (string) ( $data['fragment'] ?? '' ) : '';
		$uid      = $data['fingerprint'] ?: $data['uid'];
		$last_row = $this->get_last_user_statistic( $uid, $page_url, $fragment, $hit_time );

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
	 * A session row only needs an update when session-level attributes actually change
	 * (e.g. has_pageview flipping 0 → 1, host changing in multi-domain setups, a
	 * column the first hit left empty that this hit can fill, or custom session
	 * attributes). Navigation between pages within the same session records hits
	 * in burst_statistics but does not alter burst_sessions attributes.
	 *
	 * @param array $previous_hit     Previous hit data from burst_statistics (may include session columns via JOIN).
	 * @param array $new_session_data New session data to be written.
	 * @return bool True if update is needed, false if data hasn't changed.
	 */
	public function session_needs_update( array $previous_hit, array $new_session_data ): bool {
		// If we don't have previous hit data, update to be safe.
		if ( empty( $previous_hit ) ) {
			return true;
		}

		// The has_pageview flag is only present when it flips 0 → 1 (see
		// track_hit()); that transition must reach the row.
		if ( isset( $new_session_data['has_pageview'] ) ) {
			return true;
		}

		// Check host (only relevant for multi-domain with filtering enabled).
		// Note: host will only be in previous_hit if JOIN was performed.
		if ( isset( $previous_hit['host'] ) && isset( $new_session_data['host'] ) ) {
			$old_host = $previous_hit['host'] ?? '';
			$new_host = $new_session_data['host'];

			if ( $old_host !== $new_host ) {
				// Host changed (cross-domain navigation).
				return true;
			}
		}

		// Fill in what the first hit could not resolve. Only an empty stored
		// value counts: a value that differs is the session's own and stays.
		// A column missing from previous_hit (not selected) is skipped.
		foreach ( self::SESSION_BACKFILL_COLUMNS as $column ) {
			if ( array_key_exists( $column, $previous_hit ) && empty( $previous_hit[ $column ] ) && ! empty( $new_session_data[ $column ] ) ) {
				return true;
			}
		}

		/**
		 * Filter whether the session needs to be updated.
		 *
		 * Allows Pro extensions (such as mid-session campaign/source attribution changes)
		 * to flag that the session row should be updated in the database.
		 *
		 * @param bool  $needs_update     Whether the session needs an update.
		 * @param array $previous_hit     Previous hit data.
		 * @param array $new_session_data New session data.
		 */
		return (bool) apply_filters( 'burst_session_needs_update', false, $previous_hit, $new_session_data );
	}

	/**
	 * Sanitize completed goal IDs.
	 *
	 * Casts every value to a positive integer, drops zero/duplicate ids and caps
	 * the total. The endpoint is unauthenticated, so the cap keeps a single hit
	 * from turning an arbitrarily large client array into one oversized INSERT.
	 *
	 * @param array<int, mixed> $completed_goals Array of goal IDs from the client.
	 * @return array<int> Cleaned list of unique, positive goal IDs as integers.
	 */
	public function sanitize_completed_goal_ids( array $completed_goals ): array {
		$completed_goals = array_map( 'absint', $completed_goals );
		// Drop the zeros left by absint on non-numeric input.
		$completed_goals = array_filter( $completed_goals, static fn ( int $id ): bool => $id > 0 );
		$completed_goals = array_values( array_unique( $completed_goals ) );
		return array_slice( $completed_goals, 0, self::MAX_COMPLETED_GOALS_PER_HIT );
	}

	/**
	 * Get the id of the lookup table for the given item and value.
	 *
	 * Resolves a single value with a targeted query instead of loading the whole
	 * lookup table into memory. The table can only grow by one row per hit (one
	 * distinct value), the same ceiling as the statistics table, but a large
	 * table must never make the tracking hot path more expensive - so lookups are
	 * bounded regardless of table size, backed by a per-request memo and a
	 * per-value object cache.
	 */
	public function get_lookup_table_id( string $item, ?string $value ): int {
		if ( empty( $value ) ) {
			return 0;
		}

		$possible_items = [ 'browser', 'browser_version', 'platform', 'device' ];
		if ( ! in_array( $item, $possible_items, true ) ) {
			return 0;
		}

		// Per-request memo: a value that recurs within one request costs no query.
		if ( isset( $this->lookup_table_cache[ $item ][ $value ] ) ) {
			return $this->lookup_table_cache[ $item ][ $value ];
		}

		// Per-value object cache: a warm cache resolves without touching the DB.
		// Short TTL so admin cleanups (see App::clear_spam_browsers) self-heal.
		$cache_key = self::lookup_cache_key( $item, $value );
		$id        = wp_cache_get( $cache_key, 'burst' );

		if ( false === $id ) {
			$id = $this->resolve_lookup_table_id( $item, $value );
			if ( $id > 0 ) {
				// Literal TTL (seconds): time constants aren't guaranteed on the
				// SHORTINIT beacon path, matching get_active_goals() above.
				wp_cache_set( $cache_key, $id, 'burst', 300 );
			}
		}

		$id = (int) $id;
		if ( $id > 0 ) {
			$this->lookup_table_cache[ $item ][ $value ] = $id;
		}

		return $id;
	}

	/**
	 * Build the object-cache key for a single lookup value.
	 *
	 * @param string $item  Validated lookup type.
	 * @param string $value The looked-up value.
	 */
	public static function lookup_cache_key( string $item, string $value ): string {
		return 'burst_' . $item . '_lookup_' . crc32( $value );
	}

	/**
	 * Find (or create) the lookup-table row ID for a single value.
	 *
	 * Targeted SELECT first, INSERT only on a miss. INSERT IGNORE plus the UNIQUE
	 * index on `name` makes concurrent inserts of the same value race-safe: the
	 * loser's insert is ignored and the winning id is re-read.
	 *
	 * @param string $item  Validated lookup type (browser|browser_version|platform|device).
	 * @param string $value The value to resolve.
	 */
	private function resolve_lookup_table_id( string $item, string $value ): int {
		global $wpdb;
		$table = $wpdb->prefix . "burst_{$item}s";

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table derived from the validated $item safe list; value is prepared.
		$id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$table} WHERE name = %s LIMIT 1", $value ) );
		if ( $id > 0 ) {
			return $id;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table derived from the validated $item safe list; value is prepared.
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$table} (name) VALUES (%s)", $value ) );
		$id = (int) $wpdb->insert_id;
		if ( $id > 0 ) {
			return $id;
		}

		// Insert was ignored (a concurrent request already created the row): re-read it.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table derived from the validated $item safe list; value is prepared.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$table} WHERE name = %s ORDER BY ID ASC LIMIT 1", $value ) );
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
	 *         track_external_links: int,
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
					'initialized'         => false,
					'lastUpdateTimestamp' => 0,
					'currentUrl'          => null,
					'beacon_url'          => self::get_beacon_url(),
					'ajaxUrl'             => admin_url( 'admin-ajax.php' ),
				],
				'options'  => [
					'privacy_level'                => $this->get_option( 'privacy_level', 'cookie' ),
					'cookieless'                   => ( $this->get_option( 'privacy_level', 'cookie' ) !== 'cookie' ) ? 1 : 0,
					'pageUrl'                      => get_permalink(),
					'beacon_enabled'               => (int) $this->beacon_enabled(),
					'do_not_track'                 => $this->get_option_int( 'enable_do_not_track' ),
					'enable_turbo_mode'            => $this->get_option_int( 'enable_turbo_mode' ),
					'track_url_change'             => $this->get_option_int( 'track_url_change' ),
					'track_external_links'         => $this->get_option_int( 'track_external_links' ),
					'enable_custom_events'         => $this->get_option_int( 'enable_custom_events' ),
					// Pro enables automatic capture only after the site opts in.
					'track_gtag_events'            => 0,
					'track_gtag_custom_parameters' => 0,
					'track_downloads'              => 0,
					'page_weight_sample_rate'      => $this->is_feature_enabled( 'co2' ) ? Page_Weight_Store::get_sample_rate() : 0,
					'cookie_retention_days'        => apply_filters( 'burst_cookie_retention_days', 30 ),
					'page_id'                      => is_singular() ? (int) get_queried_object_id() : 0,
					'consent_api_active'           => \Burst\Admin\Tasks::is_wp_consent_api_active() ? 1 : 0,
					'debug'                        => defined( 'BURST_DEBUG' ) && \BURST_DEBUG ? 1 : 0,
				],
				'goals'    => [
					'completed' => [],
					'scriptUrl' => apply_filters( 'burst_goals_script_url', BURST_URL . 'assets/js/build/burst-goals.js?v=' . $script_version ),
					'active'    => $this->is_feature_enabled( 'goals' ) ? $this->get_active_goals( [ 'clicks', 'views' ] ) : [],
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
			if ( ! in_array( $type, [ 'hook', 'visits', 'clicks', 'views', 'event' ], true ) ) {
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
			if ( false === $all_goals ) {
				// The beacon uses installed tables directly; keep schema probes off its hot path.
				if ( ! ( defined( 'SHORTINIT' ) && SHORTINIT ) && ! $this->table_exists( 'burst_goals' ) ) {
					return [];
				}
				global $wpdb;
				// Single query: fetch ALL active goals (no type condition).
				$results   = $wpdb->get_results(
					"SELECT * FROM {$wpdb->prefix}burst_goals WHERE status = 'active'",
					ARRAY_A
				);
				$all_goals = is_array( $results ) ? $results : [];
				// Cache full set for reuse across calls (literal TTL for SHORTINIT).
				wp_cache_set( 'burst_active_goals_all', $all_goals, 'burst', 60 );
			}
			// Memoize for this request.
			$this->goals['all'] = (array) $all_goals;
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
	 * @param int    $page_id Post ID of the tracked page, as sent in the hit payload. 0 if unknown.
	 * @return bool Returns true if the goal is completed, false otherwise.
	 */
	public function goal_is_completed( int $goal_id, string $page_url, array $goals, int $page_id = 0 ): bool {
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
				// Match on the post ID of the tracked page. Runs on the tracking
				// endpoints (REST and the SHORTINIT beacon), so there is no main
				// query here — is_singular()/get_queried_object_id() are unusable
				// and the beacon doesn't even load them.
				if ( ! empty( $goal['page_id'] ) && $page_id > 0 && (int) $goal['page_id'] === $page_id ) {
					return true;
				}
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
	 * @param int        $page_id                Post ID of the tracked page, 0 if unknown.
	 * @return array<int> List of completed goal IDs.
	 */
	public function get_completed_goals( array $completed_client_goals, string $page_url, int $page_id = 0 ): array {
		$completed_server_goals = [];
		$server_goals           = $this->get_active_goals( [ 'visits' ] );
		// if server side goals exist.
		if ( count( $server_goals ) > 0 ) {
			// loop through server side goals.
			foreach ( $server_goals as $goal ) {
				// if goal is completed.
				if ( $this->goal_is_completed( $goal['ID'], $page_url, $server_goals, $page_id ) ) {
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
	 * @param string $fragment    Optional. URL fragment of the hit; when given the row must carry the same fragment.
	 * @param int    $reference_time Optional. Server timestamp of the hit the 30-minute window is measured from; 0 means now.
	 * @return array{
	 *     ID?: int,
	 *     session_id?: int,
	 *     parameters?: string,
	 *     fragment?: string,
	 *     time_on_page?: int,
	 *     bounce?: int,
	 *     has_pageview?: int,
	 *     page_url?: string,
	 *     page_id?: int,
	 *     host?: string,
	 *     referrer?: string|null,
	 *     city_code?: int|null,
	 *     browser_id?: int,
	 *     browser_version_id?: int,
	 *     platform_id?: int,
	 *     device_id?: int,
	 *     source?: string|null,
	 *     source_category?: string|null
	 * } Associative array of the last user statistic, or empty array if none found.
	 */
	public function get_last_user_statistic( string $uid, string $page_url = '', string $fragment = '', int $reference_time = 0 ): array {
		if ( strlen( $uid ) === 0 ) {
			return [];
		}
		$need_session_data = $this->get_option_bool( 'filtering_by_domain' );

		global $wpdb;
		$where = '';
		if ( $page_url !== '' ) {
			$destructured_url = $this->sanitize_url( $page_url );
			$parameters       = $destructured_url['parameters'];
			$where            = ! empty( $parameters ) ? $wpdb->prepare( ' AND s.parameters = %s', $parameters ) : '';
			if ( $fragment !== '' ) {
				$where .= $wpdb->prepare( ' AND s.fragment = %s', $fragment );
			}
		}

		$ref_time = $reference_time > 0 ? $reference_time : time();
		$where   .= $wpdb->prepare( ' AND s.time > %d', $ref_time - ( 30 * MINUTE_IN_SECONDS ) );

		// Once the 3.7.0 table init has run, rows are matched on the permanent
		// uid_id column — translate the browser-supplied uid string first.
		// resolve_uid_id() caches per request, so this is free for the later
		// resolves in the same hit. Hits written before the init carry uid_id
		// 0 and are not matched: one session boundary per visitor active at
		// the upgrade moment, accepted. Before the init rows are matched on
		// the legacy varchar uid column.
		$uid_column = 's.uid';
		if ( $this->tracking_schema_current() ) {
			$resolved = $this->resolve_uid_id( $uid );
			// A failed resolve must not match rows stored under uid_id 0:
			// different visitors would merge onto one row within the
			// 30-minute window. Treat the hit as a new visitor instead.
			if ( 0 === $resolved ) {
				return [];
			}
			$uid        = (string) $resolved;
			$uid_column = 's.uid_id';
		}

		$host_select = $need_session_data ? ', sess.host' : '';
		// sessions.has_pageview exists from the 3.7.1 table init on; read it
		// so track_hit() can flag the 0 → 1 transition without a second query.
		$pageview_select = $this->tracking_schema_at_least( '3.7.1' ) ? ', sess.has_pageview' : '';
		// The stored session attributes let session_needs_update() skip the
		// session write when a hit changes nothing (back-fill columns here,
		// source/source_category for the Pro attribution check). Gated on the
		// 3.7.0 table init, whose dbDelta guarantees the columns exist.
		$session_select = $this->tracking_schema_current()
			? ', sess.' . implode( ', sess.', self::SESSION_BACKFILL_COLUMNS ) . ', sess.source, sess.source_category'
			: '';

		$last_row = $wpdb->get_row(
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where, $host_select, $pageview_select and $session_select are from trusted prepared parts or fixed column names, $uid_column is a fixed column name.
			$wpdb->prepare(
				"SELECT
                s.ID,
                s.session_id,
                s.parameters,
                s.fragment,
                s.time_on_page,
                sess.bounce,
                s.page_url,
                s.page_id
                {$host_select}
                {$pageview_select}
                {$session_select}
            FROM {$wpdb->prefix}burst_statistics s
            LEFT JOIN {$wpdb->prefix}burst_sessions sess ON s.session_id = sess.ID
            WHERE {$uid_column} = %s {$where}
            ORDER BY s.ID DESC
            LIMIT 1",
				$uid
			)
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		return $last_row ? (array) $last_row : [];
	}

	/**
	 * Get the MySQL auto_increment_increment value for multi-row ID calculations.
	 *
	 * In Galera or multi-primary replication setups, auto_increment_increment is > 1.
	 * Multi-row INSERT generates IDs stepping by this increment rather than consecutive integers.
	 */
	public function get_auto_increment_increment(): int {
		global $wpdb;
		$increment = (int) $wpdb->get_var( 'SELECT @@auto_increment_increment' );
		return $increment > 0 ? $increment : 1;
	}

	/**
	 * Normalize session data row before insertion.
	 *
	 * Removes empty values from the session array.
	 *
	 * @param array<string, mixed> $data Session data row.
	 * @return array<string, mixed> Normalized session row.
	 */
	public function normalize_session_data( array $data ): array {
		return $this->remove_empty_values( $data );
	}

	/**
	 * Normalize statistic data row before insertion.
	 *
	 * Strips host, cleans empty values, and validates required fields.
	 *
	 * @param array<string, mixed> $data Statistic data row.
	 * @return array<string, mixed>|null Normalized row, or null if required values are missing.
	 */
	public function normalize_statistic_data( array $data ): ?array {
		unset( $data['host'] );
		$data = $this->remove_empty_values( $data );

		if ( ! $this->required_values_set( $data ) ) {
			// phpcs:ignore
			self::error_log( 'Missing required values for statistic creation. Data: ' . print_r( $data, true ) );
			return null;
		}

		return $data;
	}

	/**
	 * Create session in {prefix}_burst_sessions
	 */
	public function create_session( array $data ): int {
		global $wpdb;
		$data = $this->normalize_session_data( $data );
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
	 * @return int The newly created statistic ID on success, or 0 on failure.
	 */
	public function create_statistic( array $data ): int {
		global $wpdb;
		$normalized = $this->normalize_statistic_data( $data );
		if ( null === $normalized ) {
			return 0;
		}

		$inserted = $wpdb->insert( $wpdb->prefix . 'burst_statistics', $normalized );
		if ( $inserted === false ) {
			self::error_log( 'Failed to create statistic. Error: ' . $wpdb->last_error );
			return 0;
		}

		// Read the id before stamping: the first stamp adds its option with an
		// INSERT, which overwrites $wpdb->insert_id with the option id.
		$statistic_id = (int) $wpdb->insert_id;
		$this->stamp_last_hit_time( (int) ( $normalized['time'] ?? time() ) );

		return $statistic_id;
	}

	/**
	 * Record the newest hit's timestamp in the burst_last_hit_time option, at most
	 * once per hour. Tracking_Health::has_recent_hits() reads this stamp so the
	 * loopback re-test backoff and the dashboard tracking notice never have to run
	 * a statistics query on requests without the admin bootstrap. Autoloaded on
	 * purpose: this runs on the beacon hot path, where alloptions is already
	 * loaded and a non-autoloaded read would add a query per hit.
	 *
	 * @param int $time Unix timestamp of the hit being recorded.
	 */
	private function stamp_last_hit_time( int $time ): void {
		if ( $time - (int) get_option( 'burst_last_hit_time', 0 ) > HOUR_IN_SECONDS ) {
			update_option( 'burst_last_hit_time', $time, true );
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
	 * Create goal statistic in {prefix}_burst_goal_statistics.
	 *
	 * Every writer of goal conversions ends here (the tracker, the hook goals
	 * tracker, Pro's custom event goals and the headless hook route), so the
	 * essentials mode check lives here instead of at each caller.
	 *
	 * @param int        $statistic_id The statistic the goals were completed on.
	 * @param array<int> $goal_ids     The completed goal IDs.
	 */
	public function create_goal_statistic( int $statistic_id, array $goal_ids ): void {
		if ( empty( $goal_ids ) || ! $this->is_feature_enabled( 'goals' ) ) {
			return;
		}

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
	 * Skips removal for the 'parameters' key. Also unsets 'completed_goals' and 'page_weight_bytes'.
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

		unset( $data['completed_goals'], $data['page_weight_bytes'] );
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
		$is_valid  = false;

		// Non-file session handlers (redis, memcached, database, custom) don't
		// use a filesystem path, so the directory checks below don't apply and
		// the uploads fallback would break a working setup. Detect those either
		// by the save handler or by a URL-style save path such as "redis://" or
		// "tcp://host:port" and leave the configured session storage untouched.
		$is_file_handler = 'files' === ini_get( 'session.save_handler' );
		$is_url_path     = is_string( $save_path ) && preg_match( '~^[a-z][a-z0-9+.-]*://~i', $save_path );

		if ( ! $is_file_handler || $is_url_path ) {
			$is_valid = true;
		} elseif ( ! empty( $save_path ) ) {
			// Silence open_basedir warnings: outside the allowed paths these
			// return false, which correctly triggers the uploads fallback below.
			// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_is_writable -- Suppressing potential open_basedir warnings for edge cases.
			$is_valid = @is_dir( $save_path ) && @is_writable( $save_path );
		}

		if ( ! $is_valid ) {
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
	 * Check if required values are set. The identity is a resolved dictionary
	 * id (uid_id), or the legacy uid string while the pre-3.7.0 write set is
	 * still in use (see tracking_schema_current()); a uid_id of 0 is stripped
	 * by remove_empty_values() and never counts as an identity.
	 */
	public function required_values_set( array $data ): bool {
		return (
			( isset( $data['uid'] ) || ! empty( $data['uid_id'] ) ) &&
			isset( $data['page_url'] ) &&
			isset( $data['parameters'] )
		);
	}
}
