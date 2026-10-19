<?php
namespace Burst\Frontend\Events;

use Burst\Admin\Database\Query;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Events {
	use Database_Helper;
	use Helper;

	private const MAX_EVENTS_PER_HIT              = 10;
	private const MAX_EVENTS_PER_VISITOR_PER_HOUR = 300;
	private const MAX_UNIQUE_EVENT_NAMES          = 500;
	private const OVERFLOW_BUCKET                 = '(other)';
	private const MAX_EVENT_VALUE                 = 3.402823466E+38;

	/**
	 * Per-instance name-to-id memo, per blog, so a name recurring across the
	 * events of one hit costs nothing. Mirrors Tracking::$lookup_table_cache;
	 * reuse beyond this instance comes from the object cache.
	 *
	 * @var array<int, array<string, int>>
	 */
	private array $name_id_cache = [];

	/**
	 * Registered unconditionally, unlike Admin\Events\Events::init(): a
	 * payment gateway's refund webhook (or similar) is exactly where
	 * do_action( 'burst_event' ) fires from, with no admin access.
	 */
	public function init(): void {
		add_action( 'burst_event', [ $this, 'handle_server_event' ], 10, 3 );
	}

	/**
	 * Server-side entry point for custom events.
	 *
	 * The public shape is do_action( 'burst_event', $name, $properties ).
	 * The value-first form remains supported for a numeric event value:
	 * do_action( 'burst_event', $name, $value, $properties ).
	 * Resolves the visitor via the burst_uid cookie and attaches the event to
	 * their most recent statistic row.
	 *
	 * mixed, deliberately: this is a public do_action() any plugin can fire,
	 * and a narrower type turns a wrong argument — an order id like 'ord_8f3'
	 * where a numeric value is expected — into a TypeError that 500s the
	 * caller's webhook. Anything unusable is dropped here instead.
	 *
	 * @param mixed $name                Event name; ignored unless a string.
	 * @param mixed $value_or_properties Optional numeric value, or properties in the public two-argument form.
	 * @param mixed $properties          Optional flat properties (Pro; dropped in free).
	 */
	public function handle_server_event( mixed $name, mixed $value_or_properties = null, mixed $properties = [] ): void {
		if ( ! is_string( $name ) || ! $this->get_option_bool( 'enable_custom_events' ) ) {
			return;
		}

		$value = null;
		if ( is_array( $value_or_properties ) ) {
			$properties = $value_or_properties;
		} elseif ( is_numeric( $value_or_properties ) ) {
			$value = (float) $value_or_properties;
		}
		if ( ! is_array( $properties ) ) {
			$properties = [];
		}

		$uid = $this->get_burst_uid();
		if ( empty( $uid ) ) {
			return;
		}

		$statistic    = \Burst\burst_loader()->frontend->tracking->get_last_user_statistic( $uid );
		$statistic_id = $statistic['ID'] ?? 0;
		if ( ! $statistic_id ) {
			return;
		}

		$events = $this->sanitize_events(
			[
				[
					'name'       => $name,
					'value'      => $value,
					'properties' => $properties,
				],
			]
		);
		if ( empty( $events ) ) {
			return;
		}

		// get_last_user_statistic() doesn't select uid_id, so resolve it directly
		// from $uid — otherwise the rate limit's key is always '', silently
		// disabling MAX_EVENTS_PER_VISITOR_PER_HOUR for every server-side event.
		$this->record_events( (int) $statistic_id, $events, $this->resolve_uid_id( $uid ) );
	}

	/**
	 * Sanitize raw events from the client or handle_server_event(): normalized
	 * name, optional numeric value, optional flat scalar properties (capped
	 * key count and value length, no nesting). Drops malformed events.
	 *
	 * @param array<mixed> $raw_events Raw {name, value, properties} values.
	 * @return array<int, array{name: string, value: float|null, properties: array<string, string>}>
	 */
	public function sanitize_events( array $raw_events ): array {
		$sanitized = [];
		foreach ( array_slice( $raw_events, 0, self::MAX_EVENTS_PER_HIT ) as $raw_event ) {
			if ( ! is_array( $raw_event ) || ! isset( $raw_event['name'] ) || ! is_string( $raw_event['name'] ) ) {
				continue;
			}
			$name = self::normalize_event_name( $raw_event['name'] );
			if ( $name === '' ) {
				continue;
			}

			$value = null;
			// burst_events.value is a single-precision FLOAT: INF/NAN print as
			// invalid SQL and fail the whole bulk insert, and anything past the
			// column's range would be stored clamped rather than as sent.
			if ( isset( $raw_event['value'] ) && is_numeric( $raw_event['value'] ) && abs( (float) $raw_event['value'] ) <= self::MAX_EVENT_VALUE ) {
				$value = (float) $raw_event['value'];
			}

			// Neutral [] default, filled in by Pro: free has no properties table
			// and no listener for burst_event_properties_recorded, so it must
			// neither sanitize nor carry properties — an event without them
			// stays on the bulk-insert path below.
			$properties = apply_filters( 'burst_sanitize_event_properties', [], $raw_event['properties'] ?? null );

			$sanitized[] = [
				'name'       => $name,
				'value'      => $value,
				'properties' => $properties,
			];
		}
		return $sanitized;
	}

	/**
	 * Canonicalize a raw event name/goal hook: lowercase, [a-z0-9_-] only,
	 * capped at 64 chars. Shared by sanitize_events() and
	 * Pro\Frontend\Events\Events::match_custom_event_goals() so a goal's hook always
	 * matches the name its event was recorded under.
	 */
	public static function normalize_event_name( string $name ): string {
		return substr( sanitize_key( trim( $name ) ), 0, 64 );
	}

	/**
	 * Persist already-sanitized events for one statistic hit, after applying
	 * the per-visitor rate limit and the unique-name cardinality cap.
	 *
	 * Bare events (no value/properties) are bulk-inserted. An event carrying
	 * either is inserted individually so its row ID is known, then the hit's
	 * properties are passed once via burst_event_properties_recorded for Pro to persist —
	 * never a Burst\Pro\... reference here, only the hook.
	 *
	 * @param int                                                                                   $statistic_id The burst_statistics row these events belong to.
	 * @param array<int, array{name: string, value: float|null, properties: array<string, string>}> $events       Sanitized events (see sanitize_events()).
	 * @param int                                                                                   $uid_id       Visitor dictionary id used for the rolling-hour rate limit.
	 */
	public function record_events( int $statistic_id, array $events, int $uid_id ): void {
		if ( empty( $events ) || $statistic_id <= 0 || $uid_id <= 0 ) {
			return;
		}

		global $wpdb;
		$time = time();

		$events = $this->apply_visitor_rate_limit( $uid_id, $events, $time );
		if ( empty( $events ) ) {
			return;
		}

		// One lookup for the hit's distinct names, instead of a SELECT per event.
		$name_records = $this->resolve_allowed_names( array_column( $events, 'name' ) );

		$bulk_values     = [];
		$recorded_events = [];
		foreach ( $events as $event ) {
			$canonical_name = $event['name'];
			$name_record    = $name_records[ $canonical_name ] ?? null;
			if ( null === $name_record || $name_record['id'] <= 0 ) {
				self::error_log( 'Failed to record a custom event: its name could not be stored. ' . $this->redacted_db_error() );
				continue;
			}

			$value             = $event['value'];
			$value_sql         = null === $value ? 'NULL' : $wpdb->prepare( '%f', $value );
			$bulk_values[]     = $wpdb->prepare( '(%d, %d, %d, %d,', $statistic_id, $uid_id, $time, $name_record['id'] ) . $value_sql . ')';
			$recorded_events[] = [
				'id'             => 0,
				'name'           => $name_record['name'],
				'canonical_name' => $canonical_name,
				'value'          => $value,
				'properties'     => $event['properties'],
			];
		}

		if ( empty( $bulk_values ) ) {
			return;
		}

		// Every event goes in this one insert, properties or not: learning a
		// row id per event cost a single-row insert each, which on a hit where
		// all events carry properties was an insert per event.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- each tuple is prepared above.
		$result = $wpdb->query( "INSERT INTO {$wpdb->prefix}burst_events (statistic_id, uid_id, time, name_id, value) VALUES " . implode( ',', $bulk_values ) );
		if ( false === $result ) {
			self::error_log( 'Failed to record ' . count( $bulk_values ) . ' custom events: ' . $this->redacted_db_error() );
			return;
		}

		// One call for the whole hit, so Pro resolves and stores every event's
		// properties in a handful of batched queries instead of per event.
		$event_properties = $this->map_properties_to_event_ids( $statistic_id, (int) $wpdb->insert_id, $recorded_events );
		if ( ! empty( $event_properties ) ) {
			do_action( 'burst_event_properties_recorded', $event_properties );
		}

		foreach ( $recorded_events as $recorded_event ) {
			do_action( 'burst_event_recorded', $statistic_id, $recorded_event['name'], $recorded_event['value'] );
			do_action( 'burst_event_name_recorded', $statistic_id, $recorded_event['canonical_name'], $recorded_event['value'] );
		}
	}

	/**
	 * Pair the hit's property-carrying events with the row ids the bulk insert
	 * created, as [ event id => properties ] for burst_event_properties_recorded.
	 *
	 * The ids are read back with one bounded SELECT rather than derived from
	 * insert_id arithmetic: InnoDB does reserve a contiguous block for a simple
	 * multi-row insert, but the step is auto_increment_increment, which is 2 or
	 * 3 on Galera and master-master setups. Reading the block costs one indexed
	 * query and holds on every configuration.
	 *
	 * @param int                              $statistic_id    The hit the events belong to.
	 * @param int                              $first_insert_id wpdb::$insert_id from the bulk insert: the block's first id.
	 * @param array<int, array<string, mixed>> $recorded_events Events in insert order (see record_events()).
	 * @return array<int, array<string, string>> Properties keyed by burst_events ID; empty when none carry properties.
	 */
	private function map_properties_to_event_ids( int $statistic_id, int $first_insert_id, array $recorded_events ): array {
		$has_properties = false;
		foreach ( $recorded_events as $recorded_event ) {
			if ( ! empty( $recorded_event['properties'] ) ) {
				$has_properties = true;
				break;
			}
		}
		if ( ! $has_properties || $first_insert_id <= 0 ) {
			return [];
		}

		global $wpdb;
		$query = Query::create()
			->select( 'ID' )
			->from( 'burst_events' )
			->where( 'statistic_id', $statistic_id, '=', '%d' )
			->where( 'ID', $first_insert_id, '>=', '%d' )
			->order_by( 'ID' )
			->limit( count( $recorded_events ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query::prepare_sql() binds all values through wpdb::prepare().
		$ids = $wpdb->get_col( $query->prepare_sql() );

		// A short read means the block can't be matched to the events reliably,
		// so the properties of this hit are skipped rather than stored against
		// the wrong rows.
		if ( count( $ids ) !== count( $recorded_events ) ) {
			self::error_log( 'Failed to record custom event properties: the inserted event ids could not be resolved.' );
			return [];
		}

		$event_properties = [];
		foreach ( $recorded_events as $index => $recorded_event ) {
			if ( ! empty( $recorded_event['properties'] ) ) {
				$event_properties[ (int) $ids[ $index ] ] = $recorded_event['properties'];
			}
		}
		return $event_properties;
	}

	/**
	 * Trim events to the visitor's approximate rolling-hour budget. Concurrent
	 * requests may overshoot by their per-hit cap, avoiding a blocking visitor lock.
	 *
	 * @param int                                                                                   $uid_id Visitor dictionary id the budget is keyed on.
	 * @param array<int, array{name: string, value: float|null, properties: array<string, string>}> $events Candidate events for this hit.
	 * @param int                                                                                   $time   Timestamp used for the rolling-hour window and inserts.
	 * @return array<int, array{name: string, value: float|null, properties: array<string, string>}> Events allowed under the remaining budget.
	 */
	private function apply_visitor_rate_limit( int $uid_id, array $events, int $time ): array {
		global $wpdb;
		$query = Query::create()
			->select( 'COUNT(*)' )
			->from( 'burst_events' )
			->where( 'uid_id', $uid_id, '=', '%d' )
			->where_between( 'time', $time - HOUR_IN_SECONDS, $time, '%d' );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query::prepare_sql() binds all values through wpdb::prepare().
		$count  = (int) $wpdb->get_var( $query->prepare_sql() );
		$budget = self::MAX_EVENTS_PER_VISITOR_PER_HOUR - $count;
		if ( $budget <= 0 ) {
			return [];
		}

		return array_slice( $events, 0, $budget );
	}

	/**
	 * Resolve the hit's event names to dictionary ids, enforcing the
	 * unique-name cardinality cap. Known names resolve from the per-request
	 * memo or the object cache, so with a persistent object cache a hit of
	 * known names costs no query at all; whatever is left is resolved with one
	 * IN query for the whole hit. No lock is taken for a known name, so a
	 * concurrent beacon never demotes one to the overflow bucket.
	 *
	 * @param string[] $names Canonical event names of this hit, duplicates allowed.
	 * @return array<string, array{id: int, name: string}> Dictionary record keyed by the canonical name.
	 */
	private function resolve_allowed_names( array $names ): array {
		$records = [];
		$unknown = [];
		foreach ( array_unique( $names ) as $name ) {
			$name_id = $this->get_cached_name_id( $name );
			if ( $name_id > 0 ) {
				$records[ $name ] = [
					'id'   => $name_id,
					'name' => $name,
				];
				continue;
			}
			$unknown[] = $name;
		}

		if ( ! empty( $unknown ) ) {
			$records += $this->resolve_unknown_names( $unknown );
		}

		return $records;
	}

	/**
	 * Resolve the hit's names that neither cache layer knew, with one indexed
	 * IN query for the whole set before any first-sight name takes the lock.
	 *
	 * @param string[] $names Names not resolved from the per-request memo or the object cache.
	 * @return array<string, array{id: int, name: string}>
	 */
	private function resolve_unknown_names( array $names ): array {
		$records = $this->select_name_ids( $names );

		$first_sight = array_values( array_diff( $names, array_keys( $records ) ) );
		if ( ! empty( $first_sight ) ) {
			$records += $this->store_first_sight_names( $first_sight );
		}

		return $records;
	}

	/**
	 * Read the dictionary ids of a set of names with one indexed IN query,
	 * memoizing whatever it finds.
	 *
	 * @param string[] $names Names to look up.
	 * @return array<string, array{id: int, name: string}> Records for the names that exist.
	 */
	private function select_name_ids( array $names ): array {
		global $wpdb;

		$query = Query::create()
			->select( [ 'ID', 'name' ] )
			->from( 'burst_event_names' )
			->where_in( 'name', $names );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query::prepare_sql() binds all values through wpdb::prepare().
		$rows = $wpdb->get_results( $query->prepare_sql(), ARRAY_A );

		$records = [];
		foreach ( (array) $rows as $row ) {
			$this->set_cached_name_id( (string) $row['name'], (int) $row['ID'] );
			$records[ (string) $row['name'] ] = [
				'id'   => (int) $row['ID'],
				'name' => (string) $row['name'],
			];
		}
		return $records;
	}

	/**
	 * Store the hit's names seen for the first time, enforcing the unique-name
	 * cardinality cap. The site-wide lock, the cardinality count and the
	 * dictionary write are taken once for the whole hit, not per name, so a
	 * page firing several new events costs one lock cycle. Concurrent requests
	 * cannot both claim the last available slots. The lock is waited for
	 * briefly, first-sight names only: the holder is almost always a concurrent
	 * hit writing these same names, so after it the names resolve as known
	 * ones, and only what it did not write goes to the overflow bucket, because
	 * without a name id the event cannot be recorded at all. Once the cap is
	 * reached that verdict is cached, so a site at its limit stops paying the
	 * lock and the count. The overflow bucket is separate from the 500
	 * developer-supplied names.
	 *
	 * @param string[] $names Names absent from the dictionary.
	 * @return array<string, array{id: int, name: string}>
	 */
	private function store_first_sight_names( array $names ): array {
		global $wpdb;

		if ( (bool) wp_cache_get( self::names_full_cache_key(), 'burst' ) ) {
			return $this->overflow_records( $names );
		}

		$name_lock = 'burst_event_names_' . get_current_blog_id();
		if ( ! $this->acquire_db_lock( $name_lock, 1 ) ) {
			// Still contended after the wait: re-read once, since the holder was
			// inserting names, and bucket only those it did not write.
			$records = $this->select_name_ids( $names );
			$missing = array_values( array_diff( $names, array_keys( $records ) ) );
			return $records + $this->overflow_records( $missing );
		}

		try {
			$query = Query::create()
				->select( 'COUNT(*)' )
				->from( 'burst_event_names' )
				->where( 'name', self::OVERFLOW_BUCKET, '!=' );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query::prepare_sql() binds all values through wpdb::prepare().
			$unique_name_count = (int) $wpdb->get_var( $query->prepare_sql() );
			$available         = max( 0, self::MAX_UNIQUE_EVENT_NAMES - $unique_name_count );
			if ( 0 === $available ) {
				// Literal TTL (seconds): time constants aren't guaranteed on the
				// SHORTINIT beacon path, matching Tracking::get_lookup_table_id().
				wp_cache_set( self::names_full_cache_key(), 1, 'burst', 300 );
				return $this->overflow_records( $names );
			}

			$to_store = array_slice( $names, 0, $available );
			$values   = [];
			foreach ( $to_store as $name ) {
				$values[] = $wpdb->prepare( '(%s)', $name );
			}
			// IODKU makes concurrent first sights of the same name converge on
			// one row, the way the property-value dictionary is written.
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- each tuple is prepared above.
			$result = $wpdb->query( "INSERT INTO {$wpdb->prefix}burst_event_names (name) VALUES " . implode( ',', $values ) . ' ON DUPLICATE KEY UPDATE ID = ID' );
			if ( false === $result ) {
				self::error_log( 'Failed to store ' . count( $values ) . ' custom event names: ' . $this->redacted_db_error() );
				return $this->overflow_records( $names );
			}

			// One read for every name just written, instead of per name.
			$records = $this->select_name_ids( $to_store );

			return $records + $this->overflow_records( array_slice( $names, $available ) );
		} finally {
			$this->release_db_lock( $name_lock );
		}
	}

	/**
	 * Point a set of names at the overflow bucket's dictionary row.
	 *
	 * @param string[] $names Names that did not fit under the cap, or could not be stored.
	 * @return array<string, array{id: int, name: string}>
	 */
	private function overflow_records( array $names ): array {
		if ( empty( $names ) ) {
			return [];
		}

		$overflow = $this->resolve_overflow_bucket();
		return array_fill_keys( $names, $overflow );
	}

	/**
	 * Resolve the overflow bucket's dictionary row, cached like any other name
	 * so a capped site doesn't look it up again on every event.
	 *
	 * @return array{id: int, name: string}
	 */
	private function resolve_overflow_bucket(): array {
		$name_id = $this->get_cached_name_id( self::OVERFLOW_BUCKET );
		if ( $name_id > 0 ) {
			return [
				'id'   => $name_id,
				'name' => self::OVERFLOW_BUCKET,
			];
		}

		$record = $this->resolve_event_name( self::OVERFLOW_BUCKET );
		if ( $record['id'] > 0 ) {
			$this->set_cached_name_id( self::OVERFLOW_BUCKET, $record['id'] );
		}
		return $record;
	}

	/**
	 * Name-to-id from the per-request memo, falling back to the object cache,
	 * the way Tracking::get_lookup_table_id() resolves browser and platform.
	 *
	 * @return int Dictionary id, or zero when neither layer knows the name.
	 */
	private function get_cached_name_id( string $name ): int {
		$blog_id = get_current_blog_id();
		if ( isset( $this->name_id_cache[ $blog_id ][ $name ] ) ) {
			return $this->name_id_cache[ $blog_id ][ $name ];
		}

		$name_id = (int) wp_cache_get( self::name_cache_key( $name ), 'burst' );
		if ( $name_id > 0 ) {
			$this->name_id_cache[ $blog_id ][ $name ] = $name_id;
		}
		return $name_id;
	}

	/**
	 * Memoize a resolved name for this request and for the object cache.
	 */
	private function set_cached_name_id( string $name, int $name_id ): void {
		$this->name_id_cache[ get_current_blog_id() ][ $name ] = $name_id;
		// Literal TTL (seconds): time constants aren't guaranteed on the
		// SHORTINIT beacon path, matching Tracking::get_lookup_table_id().
		wp_cache_set( self::name_cache_key( $name ), $name_id, 'burst', 300 );
	}

	/**
	 * Object-cache key for one event name's dictionary id.
	 */
	private static function name_cache_key( string $name ): string {
		return 'burst_event_name_lookup_' . crc32( $name );
	}

	/**
	 * Object-cache key for the "the name dictionary is at its cap" verdict.
	 */
	private static function names_full_cache_key(): string {
		return 'burst_event_names_full_' . get_current_blog_id();
	}

	/**
	 * Resolve an event dictionary row, creating it race-safely when absent.
	 *
	 * @return array{id: int, name: string}
	 */
	private function resolve_event_name( string $name ): array {
		$created = false;
		return [
			'id'   => $this->resolve_dictionary_id( 'burst_event_names', 'name', $name, $created ),
			'name' => $name,
		];
	}
}
