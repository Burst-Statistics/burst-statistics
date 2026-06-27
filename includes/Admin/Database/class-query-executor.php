<?php
/**
 * Query Executor
 *
 * Handles caching, single-flight locking, timeout cooldown, deadlock retry,
 * and stress-test telemetry for Statistics queries.
 *
 * @package Burst\Admin\Database
 */

namespace Burst\Admin\Database;

use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Executes a pre-built SQL string with production-grade infrastructure:
 * object-cache result caching, single-flight leader/follower coordination,
 * timeout cooldown markers, deadlock retry, and optional stress-test telemetry.
 *
 * Usage:
 *   $rows = Query_Executor::create()
 *       ->fingerprint( $qd->get_id() )
 *       ->cache_ttl( 30 )
 *       ->cache_group( 'burst_stats_query_results' )
 *       ->single_flight( true )
 *       ->single_flight_wait_ms( 1200 )
 *       ->single_flight_lock_ttl( 32 )
 *       ->timeout_ms( 30000 )
 *       ->run( $sql, 'get', 'OBJECT' );
 */
class Query_Executor {
	use Helper;
	use Database_Helper;

	private string $fingerprint         = '';
	private int $cache_ttl              = 30;
	private string $cache_group         = 'burst_stats_query_results';
	private bool $single_flight         = false;
	private int $single_flight_wait_ms  = 1200;
	private int $single_flight_lock_ttl = 0;
	private int $timeout_ms             = 30000;
	private int $date_range_days        = 0;
	private int $timeout_cooldown_ttl   = 0;

	/**
	 * Whether the last run() hit a MySQL execution timeout. A timeout returns
	 * the same empty result as a genuinely empty table, so callers that
	 * paginate (e.g. the COLLECT pass) must check this to avoid mistaking a
	 * failed page for the end of the data.
	 */
	public bool $timed_out = false;

	/**
	 * Create a new Query_Executor instance.
	 */
	public static function create(): self {
		return new self();
	}

	/**
	 * Set the unique fingerprint for cache key derivation.
	 *
	 * @param string $id Unique fingerprint for cache key derivation.
	 */
	public function fingerprint( string $id ): self {
		$this->fingerprint = $id;
		return $this;
	}

	/**
	 * Set the result cache TTL in seconds.
	 *
	 * @param int $seconds Result cache TTL in seconds (0 = disable cache).
	 */
	public function cache_ttl( int $seconds ): self {
		$this->cache_ttl = max( 0, $seconds );
		return $this;
	}

	/**
	 * Set the object cache group name.
	 *
	 * @param string $group Object cache group name.
	 */
	public function cache_group( string $group ): self {
		$this->cache_group = $group;
		return $this;
	}

	/**
	 * Enable or disable single-flight leader/follower deduplication.
	 *
	 * @param bool $on Enable single-flight deduplication.
	 */
	public function single_flight( bool $on ): self {
		$this->single_flight = $on;
		return $this;
	}

	/**
	 * Set how long a follower polls waiting for the leader's result.
	 *
	 * @param int $ms Follower poll duration in milliseconds.
	 */
	public function single_flight_wait_ms( int $ms ): self {
		$this->single_flight_wait_ms = max( 0, $ms );
		return $this;
	}

	/**
	 * Set the single-flight lock TTL in seconds.
	 *
	 * @param int $seconds Lock TTL; leader releases on completion or expiry.
	 */
	public function single_flight_lock_ttl( int $seconds ): self {
		$this->single_flight_lock_ttl = max( 0, $seconds );
		return $this;
	}

	/**
	 * Set the cooldown TTL applied after a timeout to prevent thundering-herd retries.
	 *
	 * @param int $seconds Cooldown duration in seconds.
	 */
	public function timeout_cooldown_ttl( int $seconds ): self {
		$this->timeout_cooldown_ttl = max( 0, $seconds );
		return $this;
	}

	/**
	 * Set the maximum query execution time in milliseconds.
	 *
	 * @param int $ms Maximum execution time in milliseconds.
	 */
	public function timeout_ms( int $ms ): self {
		$this->timeout_ms = max( 0, $ms );
		return $this;
	}

	/**
	 * Set the number of days in the query's date range.
	 *
	 * @param int $days Number of days in the date range.
	 */
	public function date_range_days( int $days ): self {
		$this->date_range_days = max( 0, $days );
		return $this;
	}

	/**
	 * Execute a pre-built SQL string via the requested wpdb method.
	 *
	 * @param string $sql         Fully prepared SQL string (timeout hint already applied).
	 * @param string $method      One of: 'get', 'get_row', 'get_var', 'get_col'.
	 * @param string $output_type OBJECT | ARRAY_A | ARRAY_N (ignored for get_var / get_col).
	 * @return mixed  array|object for 'get'; object|array|null for 'get_row';
	 *                int|float|string|null for 'get_var'; array|null for 'get_col'.
	 *
	 * Mixed return: the wpdb result type depends on $method (get/get_row/get_var/get_col), so it cannot be narrowed to a single type.
	 */
	public function run( string $sql, string $method, string $output_type = 'OBJECT' ): mixed {
		global $wpdb;

		$this->timed_out   = false;
		$is_single_row     = ( 'get_row' === $method );
		$stress_iterations = $this->get_stress_test_query_iterations();
		$cache_key         = '';
		$lock              = null;

		if ( $this->cache_ttl > 0 && 0 === $stress_iterations ) {
			$cache_key = $this->get_query_cache_key( $sql, $output_type, $is_single_row );

			if ( $this->is_query_timeout_cached( $cache_key, $this->cache_group ) ) {
				return $this->empty_result( $method );
			}

			$cached = wp_cache_get( $cache_key, $this->cache_group );
			if ( false !== $cached ) {
				return $cached;
			}

			if ( $this->single_flight ) {
				$resolved_lock_ttl = $this->single_flight_lock_ttl > 0
					? $this->single_flight_lock_ttl
					: max( 5, (int) ceil( $this->timeout_ms / 1000 ) + 2 );
				$lock              = $this->acquire_query_single_flight_lock(
					$cache_key,
					$this->timeout_ms,
					$resolved_lock_ttl
				);

				if ( ! $lock['acquired'] ) {
					$cached_after_wait = $this->wait_for_query_cache_fill(
						$cache_key,
						$this->cache_group,
						$this->single_flight_wait_ms
					);

					if ( false !== $cached_after_wait ) {
						return $cached_after_wait;
					}

					// Leader is running; bail to avoid duplicate heavy query.
					return $this->empty_result( $method );
				}
			}
		}

		try {
			$start_time = microtime( true );

			if ( $stress_iterations > 0 ) {
				$result = $this->run_stress_iterations( $wpdb, $sql, $method, $output_type, $stress_iterations );
				$this->log_stress_test_execution_time( $start_time, microtime( true ), $sql );
				$this->log_stress_test_result_signature( $result, $sql, $method );
				return $result;
			}

			$result   = $this->execute( $wpdb, $sql, $method, $output_type );
			$end_time = microtime( true );

			if ( $this->is_timeout_error( $wpdb->last_error ) ) {
				$this->timed_out = true;
				self::error_log( 'Burst query timed out in ' . $method . ' for fingerprint ' . $this->fingerprint );

				if ( $this->cache_ttl > 0 && '' !== $cache_key ) {
					$cooldown_ttl = $this->timeout_cooldown_ttl > 0
						? $this->timeout_cooldown_ttl
						: max( 30, (int) ceil( $this->timeout_ms / 1000 ) );
					$this->cache_query_timeout_marker( $cache_key, $this->cache_group, $cooldown_ttl );
				}

				return $this->empty_result( $method );
			}

			$this->store_query_execution_time( $sql, $start_time, $end_time, $this->fingerprint );

			if ( $this->cache_ttl > 0 && '' !== $cache_key && $this->is_cacheable_result( $result, $method ) ) {
				wp_cache_set( $cache_key, $result, $this->cache_group, $this->cache_ttl );
			}

			return $result;

		} finally {
			if ( is_array( $lock ) && ! empty( $lock['acquired'] ) ) {
				$this->release_query_single_flight_lock( $lock );
			}
		}
	}

	/**
	 * Dispatch to the correct wpdb method.
	 *
	 * Mixed return: forwards the wpdb result whose type depends on $method (get/get_row/get_var/get_col); cannot be narrowed.
	 */
	private function execute( \wpdb $wpdb, string $sql, string $method, string $output_type ): mixed {
		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared -- $sql is pre-built and sanitized by Statistics::build_raw_sql() + add_query_timeout_hint().
		switch ( $method ) {
			case 'get_row':
				return $wpdb->get_row( $sql, $output_type );
			case 'get_var':
				return $wpdb->get_var( $sql );
			case 'get_col':
				return $wpdb->get_col( $sql );
			default:
				return $wpdb->get_results( $sql, $output_type );
		}
		// phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Run a query repeatedly for stress-test benchmarking.
	 *
	 * Mixed return: returns the last execute() result, whose type depends on $method; cannot be narrowed.
	 */
	private function run_stress_iterations( \wpdb $wpdb, string $sql, string $method, string $output_type, int $iterations ): mixed {
		$result = $this->empty_result( $method );
		for ( $i = 0; $i < $iterations; $i++ ) {
			$result = $this->execute( $wpdb, $sql, $method, $output_type );
		}
		return $result;
	}

	/**
	 * Return the method-appropriate empty/null sentinel for early-exit paths.
	 */
	private function empty_result( string $method ): ?array {
		return ( 'get' === $method ) ? [] : null;
	}

	/**
	 * Determine whether a result is worth caching (mirrors current Statistics logic).
	 *
	 * Mixed $result: receives a run() result whose type depends on the wpdb method (array|object|scalar|null); cannot be narrowed.
	 */
	private function is_cacheable_result( mixed $result, string $method ): bool {
		if ( 'get' === $method ) {
			return ! empty( $result );
		}
		return null !== $result;
	}

	/**
	 * Resolve stress-test iterations from a runtime constant.
	 */
	private function get_stress_test_query_iterations(): int {
		if ( ! defined( 'BURST_STRESS_TEST_QUERIES' ) ) {
			return 0;
		}

		if ( ! $this->is_dashboard_rest_request() ) {
			return 0;
		}

		return max( 0, (int) constant( 'BURST_STRESS_TEST_QUERIES' ) );
	}

	/**
	 * Determine if the current request is a REST request initiated by the frontend dashboard.
	 */
	private function is_dashboard_rest_request(): bool {
		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
			return false;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		$decoded_uri = rawurldecode( $request_uri );

		return ( strpos( $decoded_uri, '/burst/v1/' ) !== false );
	}

	/**
	 * Log total query execution time during stress-test mode.
	 */
	private function log_stress_test_execution_time( float $start, float $end, string $sql ): void {
		$query_time = $end - $start;
		self::error_log( 'Query execution time: ' . $query_time . ' ' . $sql );
	}

	/**
	 * Log a deterministic signature of the stress-test query output for baseline comparisons.
	 *
	 * Mixed $result: receives a run() result whose type depends on the wpdb method (array|object|scalar|null); cannot be narrowed.
	 */
	private function log_stress_test_result_signature( mixed $result, string $sql, string $result_type ): void {
		$normalized_sql = preg_replace( '/\s+/', ' ', trim( $sql ) );
		$sql_hash       = substr( hash( 'sha256', (string) $normalized_sql ), 0, 16 );
		$normalized     = $this->normalize_stress_result_for_hash( $result );
		$json_payload   = wp_json_encode( $normalized );
		$result_hash    = hash( 'sha256', (string) $json_payload );
		$result_count   = $this->count_stress_result_items( $result );

		self::error_log(
			sprintf(
				'Query result signature: sql_hash=%s result_hash=%s count=%d type=%s',
				$sql_hash,
				$result_hash,
				$result_count,
				$result_type
			)
		);
	}

	/**
	 * Normalize result data for deterministic hashing.
	 *
	 * Mixed in/out: recurses over an arbitrary wpdb result (object|array|scalar|null) and returns the same shape normalized — genuinely polymorphic.
	 */
	private function normalize_stress_result_for_hash( mixed $value ): mixed {
		if ( is_object( $value ) ) {
			$value = get_object_vars( $value );
		}

		if ( is_array( $value ) ) {
			if ( $this->is_assoc_array( $value ) ) {
				ksort( $value );
			}

			foreach ( $value as $key => $item ) {
				$value[ $key ] = $this->normalize_stress_result_for_hash( $item );
			}
		}

		return $value;
	}

	/**
	 * Determine if an array has string keys.
	 */
	private function is_assoc_array( array $value ): bool {
		return array_keys( $value ) !== range( 0, count( $value ) - 1 );
	}

	/**
	 * Count top-level result items for stress output logging.
	 *
	 * Mixed $result: receives a run() result whose type depends on the wpdb method (array|object|scalar|null); cannot be narrowed.
	 */
	private function count_stress_result_items( mixed $result ): int {
		if ( is_array( $result ) ) {
			return count( $result );
		}

		if ( null === $result ) {
			return 0;
		}

		return 1;
	}

	/**
	 * Store query execution time for slow query analysis.
	 *
	 * @param string $sql         The executed SQL query.
	 * @param float  $start       Start time in seconds.
	 * @param float  $end         End time in seconds.
	 * @param string $fingerprint Deterministic hash identifying the query shape.
	 */
	private function store_query_execution_time( string $sql, float $start, float $end, string $fingerprint ): void {
		global $wpdb;

		if ( $this->get_stress_test_query_iterations() > 0 ) {
			return;
		}

		$execution_time  = $end - $start;
		$sql_hash        = $fingerprint;
		$date_range_days = $this->date_range_days;

		if ( $date_range_days > 365 ) {
			return;
		}

		// Check if query exists and was updated recently.
		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}burst_query_stats WHERE sql_hash = %s",
				$sql_hash
			)
		);

		if ( $existing ) {
			$time_since_last_update = time() - $existing->last_updated;
			if ( $time_since_last_update < WEEK_IN_SECONDS ) {
				return;
			}

			$updated = $this->run_query_stats_write(
				static function () use ( $wpdb, $existing, $execution_time, $date_range_days, $sql_hash ) {
					return $wpdb->update(
						$wpdb->prefix . 'burst_query_stats',
						[
							'avg_execution_time' => ( $existing->avg_execution_time * $existing->execution_count + $execution_time ) / ( $existing->execution_count + 1 ),
							'max_execution_time' => max( $existing->max_execution_time, $execution_time ),
							'min_execution_time' => min( $existing->min_execution_time, $execution_time ),
							'execution_count'    => $existing->execution_count + 1,
							'last_updated'       => time(),
							'date_range_days'    => $date_range_days,
						],
						[ 'sql_hash' => $sql_hash ],
						[ '%f', '%f', '%f', '%d', '%s', '%d' ],
						[ '%s' ]
					);
				}
			);

			if ( ! $updated ) {
				return;
			}
		} else {
			$inserted = $this->run_query_stats_write(
				static function () use ( $wpdb, $sql_hash, $sql, $execution_time, $date_range_days ) {
					return $wpdb->query(
						$wpdb->prepare(
							"INSERT IGNORE INTO {$wpdb->prefix}burst_query_stats
                (sql_hash, sql_query, avg_execution_time, max_execution_time, min_execution_time, execution_count, last_updated, date_range_days)
                VALUES (%s, %s, %f, %f, %f, %d, %d, %d)",
							$sql_hash,
							$sql,
							$execution_time,
							$execution_time,
							$execution_time,
							1,
							time(),
							$date_range_days
						)
					);
				}
			);

			if ( ! $inserted ) {
				return;
			}
		}

		// Prune to keep only the 100 slowest queries.
		$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_query_stats" );
		if ( $count > 100 ) {
			$this->run_query_stats_write(
				static function () use ( $wpdb ) {
					return $wpdb->query(
						"DELETE FROM {$wpdb->prefix}burst_query_stats
					WHERE ID NOT IN (
						SELECT ID FROM (
							SELECT ID FROM {$wpdb->prefix}burst_query_stats
							ORDER BY avg_execution_time DESC
							LIMIT 100
						) AS top
					)"
					);
				}
			);
		}
	}

	/**
	 * Execute query_stats write operations with deadlock retries and suppressed DB-error output.
	 */
	private function run_query_stats_write( callable $write_operation ): bool {
		global $wpdb;

		$max_attempts = 3;

		for ( $attempt = 1; $attempt <= $max_attempts; $attempt++ ) {
			$previous_suppress = $wpdb->suppress_errors( true );
			$wpdb->last_error  = '';
			$operation_result  = $write_operation();
			$error_message     = $this->get_wpdb_last_error_message();
			$wpdb->suppress_errors( $previous_suppress );

			if ( false !== $operation_result && '' === $error_message ) {
				return true;
			}

			if ( '' === $error_message ) {
				self::error_log( 'Query stats write failed without a database error message.' );
				return false;
			}

			if ( ! $this->is_deadlock_db_error( $error_message ) ) {
				self::error_log( 'Query stats write failed: ' . $error_message );
				return false;
			}

			if ( $attempt < $max_attempts ) {
				usleep( $attempt * 50000 );
			}
		}

		self::error_log( 'Skipping query_stats write after repeated deadlock retries.' );
		return false;
	}

	/**
	 * Retrieve the current wpdb error string.
	 */
	private function get_wpdb_last_error_message(): string {
		global $wpdb;

		return is_string( $wpdb->last_error ) ? $wpdb->last_error : '';
	}

	/**
	 * Detect MySQL deadlock error messages.
	 */
	private function is_deadlock_db_error( string $error_message ): bool {
		return strpos( strtolower( $error_message ), 'deadlock found when trying to get lock' ) !== false;
	}

	/**
	 * Try to become the leader request for a query cache key.
	 *
	 * @param string $cache_key  Cache key identifying the query.
	 * @param int    $timeout_ms Query timeout in ms (used only for logging context).
	 * @param int    $lock_ttl   Lock lifetime in seconds (pre-resolved by caller).
	 */
	private function acquire_query_single_flight_lock( string $cache_key, int $timeout_ms, int $lock_ttl ): array {
		$lock_group = 'burst_stats_query_locks';
		$lock_key   = 'lock_' . $cache_key;
		$owner      = function_exists( 'wp_generate_uuid4' )
			? wp_generate_uuid4()
			: uniqid( 'burst_lock_', true );
		$acquired   = wp_cache_add( $lock_key, $owner, $lock_group, $lock_ttl );

		return [
			'acquired'   => (bool) $acquired,
			'owner'      => $owner,
			'lock_key'   => $lock_key,
			'lock_group' => $lock_group,
		];
	}

	/**
	 * Release single-flight lock if this request still owns it.
	 */
	private function release_query_single_flight_lock( array $lock ): void {
		if ( empty( $lock['owner'] ) || empty( $lock['lock_key'] ) || empty( $lock['lock_group'] ) ) {
			return;
		}

		$current_owner = wp_cache_get( $lock['lock_key'], $lock['lock_group'] );
		if ( $current_owner === $lock['owner'] ) {
			wp_cache_delete( $lock['lock_key'], $lock['lock_group'] );
		}
	}

	/**
	 * Follower requests briefly poll cache for a leader-written result.
	 *
	 * Mixed return: returns whatever a leader cached for this query (type depends on the wpdb method) or false on miss; cannot be narrowed.
	 */
	private function wait_for_query_cache_fill( string $cache_key, string $cache_group, int $wait_ms ): mixed {
		if ( $wait_ms <= 0 ) {
			return false;
		}

		$started_at   = microtime( true );
		$sleep_us     = 50000;
		$max_sleep_us = 200000;

		while ( ( microtime( true ) - $started_at ) * 1000 < $wait_ms ) {
			usleep( $sleep_us );

			$cached = wp_cache_get( $cache_key, $cache_group );
			if ( false !== $cached ) {
				return $cached;
			}

			$sleep_us = min( $max_sleep_us, (int) ( $sleep_us * 1.5 ) );
		}

		return false;
	}

	/**
	 * Build a deterministic cache key from SQL and output type.
	 *
	 * Auth context (share-link viewer flag) is folded into the key as defense-in-depth.
	 * Strict-mode SQL already differs from non-strict (injected restrictions, blocked
	 * raw clauses) so cross-role cache collisions are not normally possible — but if
	 * two roles happen to compile to identical SQL, this prevents any cache reuse
	 * across privilege boundaries.
	 */
	private function get_query_cache_key( string $sql, string $output_type, bool $single_row ): string {
		$auth_context = ( function_exists( 'is_user_logged_in' ) && is_user_logged_in() ) ? 'auth' : 'anon';
		if ( function_exists( 'wp_get_current_user' ) ) {
			if ( self::is_shareable_link_viewer() ) {
				$auth_context = 'viewer';
			}
		}
		$hash = hash( 'sha256', $sql . '|' . $output_type . '|' . ( $single_row ? 'row' : 'results' ) . '|' . $auth_context );

		return 'burst_query_' . $hash;
	}

	/**
	 * Cache a short-lived timeout marker to prevent immediate repeated retries.
	 *
	 * @param string $cache_key    Cache key for the timed-out query.
	 * @param string $cache_group  Cache group.
	 * @param int    $cooldown_ttl Pre-resolved cooldown TTL in seconds.
	 */
	private function cache_query_timeout_marker( string $cache_key, string $cache_group, int $cooldown_ttl ): void {
		if ( $cooldown_ttl <= 0 ) {
			return;
		}

		wp_cache_set( $cache_key . ':timeout', 1, $cache_group, $cooldown_ttl );
	}

	/**
	 * Check if this query recently timed out and is in cooldown.
	 */
	private function is_query_timeout_cached( string $cache_key, string $cache_group ): bool {
		return false !== wp_cache_get( $cache_key . ':timeout', $cache_group );
	}

	/**
	 * Detect if the database reported a timeout/interruption for the last query.
	 */
	private function is_timeout_error( string $last_error ): bool {
		if ( '' === $last_error ) {
			return false;
		}

		$normalized_error = strtolower( $last_error );

		return str_contains( $normalized_error, 'max_execution_time' )
			|| str_contains( $normalized_error, 'maximum statement execution time exceeded' )
			|| str_contains( $normalized_error, 'query execution was interrupted' )
			|| str_contains( $normalized_error, 'error 3024' )
			|| str_contains( $normalized_error, 'error 1317' );
	}
}
