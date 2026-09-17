<?php
namespace Burst\Admin\Import\Helpers;

use Burst\Admin\Import\Import_Manager;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Event_Synthesizer
 *
 * Converts aggregated external metrics into discrete, timestamp-distributed
 * session and hit events compatible with native Burst queries.
 */
class Event_Synthesizer {
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Rows per multi-row INSERT statement.
	 */
	const ROWS_PER_INSERT = 250;

	/**
	 * Default cap on synthesized rows (sessions + hits) a single import
	 * iteration may insert. One aggregated source row can expand into
	 * visitors × pageviews inserts, so without this cap a single GA4/Matomo
	 * day-row with 100k users would be emitted inside one "2 s" chunk.
	 */
	const MAX_EVENTS_PER_ITERATION = 20000;

	/**
	 * In-memory cache of resolved page IDs by URL.
	 *
	 * @var array<string, int>
	 */
	private static array $page_id_cache = [];

	/**
	 * In-memory cache of resolved dimension dictionary IDs, keyed by item then
	 * raw value (device / platform / browser / browser_version).
	 *
	 * @var array<string, array<string, int>>
	 */
	private static array $lookup_id_cache = [];

	/**
	 * Get the cap on synthesized rows per import iteration.
	 */
	public static function get_max_events_per_iteration(): int {
		/**
		 * Filters the maximum number of synthesized rows (sessions + hits) one
		 * import iteration may insert before yielding to the next chunk.
		 *
		 * @param int $max_events Default 20000.
		 */
		return max( 1, (int) apply_filters( 'burst_import_max_events_per_iteration', self::MAX_EVENTS_PER_ITERATION ) );
	}

	/**
	 * Synthesize a complete aggregated row into burst_sessions and burst_statistics.
	 *
	 * Convenience wrapper that emits every visitor of the row in bounded
	 * slices; batch importers that need to yield between slices call
	 * synthesize_slice() directly.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $data Aggregated day metrics.
	 * @param int|null             $cutoff_timestamp Optional boundary timestamp to avoid re-reading options.
	 * @return int Total pageviews synthesized.
	 */
	public function synthesize_aggregated_record( int $import_id, array $data, ?int $cutoff_timestamp = null ): int {
		$pageviews = 0;
		$cursor    = 0;
		do {
			$slice      = $this->synthesize_slice( $import_id, $data, $cursor, self::get_max_events_per_iteration(), $cutoff_timestamp );
			$pageviews += $slice['pageviews'];
			$cursor     = $slice['cursor'];
		} while ( ! $slice['done'] );

		return $pageviews;
	}

	/**
	 * Synthesize part of an aggregated row, resuming at a visitor cursor.
	 *
	 * Emits at most as many visitors as fit in $event_budget rows (one session
	 * plus its hits per visitor), so a huge source row is spread over several
	 * import iterations instead of being inserted at once. The caller stores
	 * the returned cursor in the import state and passes it back until 'done'.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $data Aggregated day metrics.
	 * @param int                  $cursor Visitors of this row already emitted.
	 * @param int                  $event_budget Rows (sessions + hits) that may still be inserted.
	 * @param int|null             $cutoff_timestamp Optional boundary timestamp to avoid re-reading options.
	 * @return array{pageviews: int, events: int, cursor: int, done: bool}
	 */
	public function synthesize_slice( int $import_id, array $data, int $cursor, int $event_budget, ?int $cutoff_timestamp = null ): array {
		$record = $this->prepare_record( $import_id, $data, $cutoff_timestamp );
		if ( null === $record ) {
			return [
				'pageviews' => 0,
				'events'    => 0,
				'cursor'    => 0,
				'done'      => true,
			];
		}

		$visitors        = $record['visitors'];
		$cursor          = max( 0, min( $cursor, $visitors ) );
		$rows_per_visit  = 1 + $record['views_per_visitor'];
		$slice_visitors  = max( 1, intdiv( max( 0, $event_budget ), $rows_per_visit ) );
		$end             = min( $visitors, $cursor + $slice_visitors );
		$views_remaining = $record['pageviews'] - min( $record['pageviews'], $cursor * $record['views_per_visitor'] );

		if ( $cursor >= $visitors || 0 >= $views_remaining ) {
			return [
				'pageviews' => 0,
				'events'    => 0,
				'cursor'    => $visitors,
				'done'      => true,
			];
		}

		$result = $this->emit_visitor_range( $record, $cursor, $end, $views_remaining );

		// The row is exhausted once every visitor has a session or the
		// pageviews are used up (remaining visitors would be hit-less).
		$done = $result['cursor'] >= $visitors || $result['views_remaining'] <= 0;

		return [
			'pageviews' => $result['pageviews'],
			'events'    => $result['events'],
			'cursor'    => $done ? $visitors : $result['cursor'],
			'done'      => $done,
		];
	}

	/**
	 * Normalize an aggregated row and resolve its dictionary ids once, so the
	 * per-visitor emission only has to deal with row generation.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $data Aggregated day metrics.
	 * @param int|null             $cutoff_timestamp Optional boundary timestamp to avoid re-reading options.
	 * @return array<string, mixed>|null Prepared record, or null when the row must be skipped.
	 */
	private function prepare_record( int $import_id, array $data, ?int $cutoff_timestamp ): ?array {
		$date_str = (string) ( $data['date'] ?? '' );
		if ( empty( $date_str ) ) {
			return null;
		}

		// Normalize date string into timestamp at 12:00:00 UTC for the given day.
		$cleaned_date = preg_replace( '/[^0-9]/', '', $date_str ) ?? '';
		if ( 8 === strlen( $cleaned_date ) ) {
			$year  = (int) substr( $cleaned_date, 0, 4 );
			$month = (int) substr( $cleaned_date, 4, 2 );
			$day   = (int) substr( $cleaned_date, 6, 2 );
		} else {
			$ts    = strtotime( $date_str );
			$year  = (int) gmdate( 'Y', $ts );
			$month = (int) gmdate( 'm', $ts );
			$day   = (int) gmdate( 'd', $ts );
		}

		$base_time = gmmktime( 12, 0, 0, $month, $day, $year );

		// Guard: Do not synthesize events on or after the date Burst began tracking.
		if ( null === $cutoff_timestamp ) {
			$cutoff           = Import_Manager::get_burst_tracking_start();
			$cutoff_timestamp = (int) $cutoff['timestamp'];
		}
		if ( $base_time >= $cutoff_timestamp ) {
			return null;
		}

		$page_url = sanitize_text_field( (string) ( $data['page_url'] ?? '/' ) );
		if ( ! str_starts_with( $page_url, '/' ) ) {
			$page_url = '/' . $page_url;
		}

		$pageviews = max( 1, (int) ( $data['pageviews'] ?? 1 ) );
		$visitors  = max( 1, (int) ( $data['visitors'] ?? 1 ) );
		$source    = sanitize_text_field( (string) ( $data['source'] ?? '' ) );

		// Resolve or look up page ID (cached per distinct URL across batch).
		if ( isset( self::$page_id_cache[ $page_url ] ) ) {
			$page_id = self::$page_id_cache[ $page_url ];
		} else {
			$page_id = (int) ( $data['page_id'] ?? 0 );
			if ( 0 === $page_id && function_exists( 'url_to_postid' ) ) {
				$page_id = (int) url_to_postid( home_url( $page_url ) );
			}
			if ( 0 === $page_id ) {
				$page_id = -$this->resolve_page_url_id( $page_url );
			}
			self::$page_id_cache[ $page_url ] = $page_id;
		}

		return [
			'import_id'          => $import_id,
			'cleaned_date'       => $cleaned_date,
			'base_time'          => $base_time,
			'page_url'           => $page_url,
			'page_id'            => $page_id,
			'pageviews'          => $pageviews,
			'visitors'           => $visitors,
			'views_per_visitor'  => max( 1, (int) ceil( $pageviews / $visitors ) ),
			'duration'           => max( 0, (int) ( $data['duration'] ?? 30 ) ),
			'bounce'             => (float) ( $data['bounce_rate'] ?? 0.0 ),
			'source'             => $source,
			'source_category'    => $this->map_source_category( $source ),
			'host'               => sanitize_text_field( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ),
			// Device / platform / browser dictionary lookups (cached per value). A
			// dimension the source export does not carry stays 0 (unset).
			'device_id'          => $this->lookup_dimension_id( 'device', (string) ( $data['device'] ?? 'desktop' ) ),
			'platform_id'        => $this->lookup_dimension_id( 'platform', (string) ( $data['platform'] ?? '' ) ),
			'browser_id'         => $this->lookup_dimension_id( 'browser', (string) ( $data['browser'] ?? '' ) ),
			'browser_version_id' => $this->lookup_dimension_id( 'browser_version', (string) ( $data['browser_version'] ?? '' ) ),
			'uid_id_active'      => $this->uid_id_active(),
		];
	}

	/**
	 * Build the deterministic import uid for one synthesized visitor.
	 *
	 * @param array<string, mixed> $record Prepared record.
	 * @param int                  $v Visitor index within the row.
	 */
	private function visitor_uid( array $record, int $v ): string {
		$uid_hash = substr( hash( 'sha256', "imp_{$record['import_id']}_{$record['cleaned_date']}_{$record['page_url']}_{$v}" ), 0, 32 );
		return "imp{$record['import_id']}-{$uid_hash}";
	}

	/**
	 * Emit sessions and hits for visitors [$from, $to) of a prepared record.
	 *
	 * Works in ROWS_PER_INSERT-sized batches so memory stays bounded by the
	 * batch size rather than by the visitor count of the source row.
	 *
	 * @param array<string, mixed> $record Prepared record.
	 * @param int                  $from First visitor index (inclusive).
	 * @param int                  $to Last visitor index (exclusive).
	 * @param int                  $views_remaining Pageviews not yet assigned to a visitor.
	 * @return array{pageviews: int, events: int, cursor: int, views_remaining: int}
	 */
	private function emit_visitor_range( array $record, int $from, int $to, int $views_remaining ): array {
		global $wpdb;

		$sessions_table   = $wpdb->prefix . 'burst_sessions';
		$statistics_table = $wpdb->prefix . 'burst_statistics';

		$visitors          = (int) $record['visitors'];
		$views_per_visitor = (int) $record['views_per_visitor'];
		$base_time         = (int) $record['base_time'];
		$pageviews_emitted = 0;
		$events            = 0;
		$cursor            = $from;
		$hits_buffer       = [];

		for ( $batch_start = $from; $batch_start < $to && $views_remaining > 0; $batch_start += self::ROWS_PER_INSERT ) {
			$batch_end = min( $to, $batch_start + self::ROWS_PER_INSERT );

			// 1. Resolve the UID dictionary IDs for this batch only.
			$batch_uids = [];
			for ( $v = $batch_start; $v < $batch_end; $v++ ) {
				$batch_uids[ $v ] = $this->visitor_uid( $record, $v );
			}
			$uid_map = $this->batch_resolve_uids( array_values( $batch_uids ) );

			// 2. Sessions.
			$session_rows = [];
			foreach ( $batch_uids as $v => $uid_string ) {
				$session_rows[] = [
					'start_time'         => $base_time - 14400 + ( ( $v % 12 ) * 3600 ),
					'uid_id'             => (int) ( $uid_map[ $uid_string ] ?? 0 ),
					'host'               => $record['host'],
					'referrer'           => $record['source'],
					'device_id'          => $record['device_id'],
					'platform_id'        => $record['platform_id'],
					'browser_id'         => $record['browser_id'],
					'browser_version_id' => $record['browser_version_id'],
					'first_time_visit'   => 1,
					'bounce'             => ( $v / $visitors ) < $record['bounce'] ? 1 : 0,
					'source'             => $record['source'],
					'source_category'    => $record['source_category'],
					'source_mapped'      => 1,
				];
			}

			$first_session_id = $this->insert_rows_batch( $sessions_table, $session_rows );
			$events          += count( $session_rows );

			// 3. Hits, distributed evenly over the batch's sessions.
			$offset = 0;
			foreach ( $batch_uids as $v => $uid_string ) {
				$session_id   = $first_session_id + $offset;
				$uid_id       = (int) ( $uid_map[ $uid_string ] ?? 0 );
				$session_time = $base_time - 14400 + ( ( $v % 12 ) * 3600 );
				++$offset;

				$cur_views          = min( $views_per_visitor, $views_remaining );
				$views_remaining   -= $cur_views;
				$pageviews_emitted += $cur_views;

				for ( $h = 0; $h < $cur_views; $h++ ) {
					$stat_data = [
						'page_url'     => $record['page_url'],
						'page_id'      => $record['page_id'],
						'page_type'    => 'page',
						'time'         => $session_time + ( $h * 60 ),
						'uid_id'       => $uid_id,
						'time_on_page' => $record['duration'],
						'max_scroll'   => 0,
						'dwell_zones'  => '',
						'parameters'   => '',
						'fragment'     => '',
						'session_id'   => $session_id,
					];

					if ( ! $record['uid_id_active'] ) {
						$stat_data['uid'] = $uid_string;
					}

					$hits_buffer[] = $stat_data;

					if ( count( $hits_buffer ) >= self::ROWS_PER_INSERT ) {
						$events += count( $hits_buffer );
						$this->insert_rows_batch( $statistics_table, $hits_buffer );
						$hits_buffer = [];
					}
				}

				$cursor = $v + 1;
				if ( 0 >= $views_remaining ) {
					break;
				}
			}
		}

		if ( ! empty( $hits_buffer ) ) {
			$events += count( $hits_buffer );
			$this->insert_rows_batch( $statistics_table, $hits_buffer );
		}

		return [
			'pageviews'       => $pageviews_emitted,
			'events'          => $events,
			'cursor'          => $cursor,
			'views_remaining' => $views_remaining,
		];
	}

	/**
	 * Resolve a dimension dictionary ID (device / platform / browser /
	 * browser_version) for a raw source value, creating the dictionary row on
	 * first sight and caching per value. Returns 0 for an empty value so the
	 * corresponding session column stays unset for sources that do not carry
	 * that dimension.
	 *
	 * @param string $item  Dimension name.
	 * @param string $value Raw value from the source export.
	 */
	private function lookup_dimension_id( string $item, string $value ): int {
		$value = sanitize_text_field( $value );
		if ( '' === $value ) {
			return 0;
		}
		if ( isset( self::$lookup_id_cache[ $item ][ $value ] ) ) {
			return self::$lookup_id_cache[ $item ][ $value ];
		}
		$id                                       = (int) \Burst\burst_loader()->frontend->tracking->get_lookup_table_id( $item, $value );
		self::$lookup_id_cache[ $item ][ $value ] = $id;
		return $id;
	}

	/**
	 * Batch resolve or create UID dictionary IDs in burst_uids.
	 *
	 * @param array<int, string> $uids UID strings.
	 * @return array<string, int> Map of [ uid_string => id ].
	 */
	private function batch_resolve_uids( array $uids ): array {
		global $wpdb;

		if ( empty( $uids ) ) {
			return [];
		}

		static $local_cache = [];
		$missing            = [];
		$result             = [];

		foreach ( $uids as $uid ) {
			if ( isset( $local_cache[ $uid ] ) ) {
				$result[ $uid ] = $local_cache[ $uid ];
			} else {
				$missing[] = $uid;
			}
		}

		if ( ! empty( $missing ) ) {
			$chunks = array_chunk( array_values( array_unique( $missing ) ), self::ROWS_PER_INSERT );
			foreach ( $chunks as $chunk ) {
				// Multi-row INSERT IGNORE.
				$rows_data = [];
				foreach ( $chunk as $uid_val ) {
					$rows_data[] = [ 'uid' => $uid_val ];
				}
				$this->insert_rows_batch( $wpdb->prefix . 'burst_uids', $rows_data, true );

				// SELECT resolved IDs.
				$placeholders = implode( ', ', array_fill( 0, count( $chunk ), '%s' ) );
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				$fetched = $wpdb->get_results(
					$wpdb->prepare(
						"SELECT uid, ID FROM {$wpdb->prefix}burst_uids WHERE uid IN ($placeholders)",
						...$chunk
					),
					ARRAY_A
				);
				// phpcs:enable

				if ( is_array( $fetched ) ) {
					foreach ( $fetched as $row ) {
						$u_str                 = (string) ( $row['uid'] ?? '' );
						$u_id                  = (int) ( $row['ID'] ?? 0 );
						$local_cache[ $u_str ] = $u_id;
						$result[ $u_str ]      = $u_id;
					}
				}
			}
		}

		return $result;
	}

	/**
	 * Execute a multi-row insert statement.
	 *
	 * @param string                           $table  Table name with prefix.
	 * @param array<int, array<string, mixed>> $rows   Rows to insert.
	 * @param bool                             $ignore Whether to use INSERT IGNORE.
	 * @return int Insert ID from $wpdb->insert_id.
	 */
	private function insert_rows_batch( string $table, array $rows, bool $ignore = false ): int {
		global $wpdb;

		if ( empty( $rows ) ) {
			return 0;
		}

		$first_row = reset( $rows );
		$columns   = array_keys( $first_row );
		$col_list  = '`' . implode( '`, `', array_map( 'sanitize_key', $columns ) ) . '`';
		$verb      = $ignore ? 'INSERT IGNORE INTO' : 'INSERT INTO';

		$sql = "{$verb} `{$table}` ({$col_list}) VALUES\n";

		$value_rows = [];
		foreach ( $rows as $row ) {
			$escaped_values = [];
			foreach ( $columns as $col ) {
				$val = $row[ $col ] ?? null;
				if ( null === $val ) {
					$escaped_values[] = 'NULL';
				} elseif ( is_int( $val ) || is_float( $val ) ) {
					$escaped_values[] = (string) $val;
				} else {
					$escaped_values[] = "'" . $wpdb->_real_escape( (string) $val ) . "'";
				}
			}
			$value_rows[] = '(' . implode( ', ', $escaped_values ) . ')';
		}

		$sql .= implode( ",\n", $value_rows );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$wpdb->query( $sql );

		return (int) $wpdb->insert_id;
	}

	/**
	 * Map source string to Burst standard source category.
	 *
	 * Fires the 'burst_classify_source' filter so Pro can classify via Source_Classifier.
	 * In the free plugin, falls back to a built-in mapping with 'referral' as neutral default
	 * or 'search' when recognized search engine patterns match.
	 *
	 * @param string $source Source name or referrer URL.
	 * @return string Source category (e.g. 'direct', 'referral', 'search').
	 */
	public function map_source_category( string $source ): string {
		$source = trim( $source );
		if ( empty( $source ) || '(direct)' === strtolower( $source ) || 'direct' === strtolower( $source ) ) {
			return 'direct';
		}

		$default_category = 'referral';
		$lower_source     = strtolower( $source );

		if ( str_contains( $lower_source, 'mail.' ) || str_contains( $lower_source, 'outlook' ) || str_contains( $lower_source, 'webmail' ) ) {
			$default_category = 'email';
		} elseif ( str_contains( $lower_source, 'facebook' ) || str_contains( $lower_source, 'instagram' ) || str_contains( $lower_source, 'twitter' ) || str_contains( $lower_source, 't.co' ) || str_contains( $lower_source, 'linkedin' ) || str_contains( $lower_source, 'pinterest' ) || str_contains( $lower_source, 'reddit' ) || str_contains( $lower_source, 'tiktok' ) || str_contains( $lower_source, 'youtube' ) ) {
			$default_category = 'social';
		} elseif ( str_contains( $lower_source, 'google' ) || str_contains( $lower_source, 'bing' ) || str_contains( $lower_source, 'duckduckgo' ) || str_contains( $lower_source, 'yahoo' ) || str_contains( $lower_source, 'baidu' ) || str_contains( $lower_source, 'yandex' ) || str_contains( $lower_source, 'ecosia' ) ) {
			$default_category = 'search';
		}

		/**
		 * Filters the classified source category for an imported source.
		 *
		 * @param string $default_category The fallback category. Default 'referral' or 'search'.
		 * @param string $source           The source name or referrer string.
		 */
		return (string) apply_filters( 'burst_classify_source', $default_category, $source );
	}
}
