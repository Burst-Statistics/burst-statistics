<?php
namespace Burst\Admin\Search_Console;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Traits\Helper;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Stores site-wide Google Search Console search-term rows.
 */
class Search_Terms_Store {
	use Helper;
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Table name without the WordPress prefix.
	 */
	private const TABLE = 'burst_search_terms';

	/**
	 * Maximum search-term rows per INSERT statement.
	 */
	private const INSERT_BATCH_SIZE = 250;

	/**
	 * Create the burst_search_terms table. Hooked to burst_install_tables.
	 */
	public function install_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}burst_search_terms (
				`ID` int NOT NULL AUTO_INCREMENT,
				`date` date NOT NULL,
				`query` varchar(191) NOT NULL,
				`property` varchar(191) NOT NULL,
				`page` varchar(191) NOT NULL DEFAULT '',
				`clicks` int NOT NULL DEFAULT 0,
				`impressions` int NOT NULL DEFAULT 0,
				`ctr` float NOT NULL DEFAULT 0,
				`position` float NOT NULL DEFAULT 0,
				PRIMARY KEY (ID)
			) $charset_collate;"
		);

		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating table burst_search_terms: ' . $wpdb->last_error );
		}

		$this->add_index( self::TABLE, [ 'date' ] );
		$this->add_index( self::TABLE, [ 'property', 'date' ] );
		// query_top() and the Pro page-terms reads filter property + page (site
		// rows have page = '') before the date range, then aggregate
		// query/clicks/impressions/position. Including those columns makes the
		// index covering, so multi-year ranges are served from an index range
		// scan instead of a clustered-PK lookup per matching row.
		$this->add_index( self::TABLE, [ 'property', 'page', 'date', 'query', 'clicks', 'impressions', 'position' ] );
		// The old filter index is a prefix of the covering index and only
		// redundant once that exists — creating it can fail on installs with a
		// small key-length limit, so drop only after verifying.
		if ( $this->index_exists( self::TABLE, 'property_page_date_query_clicks_impressions_position_index' ) ) {
			$this->drop_index( self::TABLE, 'property_page_date_index' );
		}
	}

	/**
	 * Create the table on demand if it is missing, so the cron sync works before
	 * the next plugin upgrade has run the install hook.
	 */
	public function maybe_install(): void {
		if ( ! $this->table_exists( self::TABLE ) || ! $this->column_exists( self::TABLE, 'page' ) ) {
			$this->install_table();
		}
	}

	/**
	 * Remove all stored search-term rows. Used when the site URL we fetch for
	 * changes, so data from the previous site does not linger.
	 */
	public function clear(): void {
		if ( ! $this->table_exists( self::TABLE ) ) {
			return;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; no user data in the query.
		$wpdb->query( "TRUNCATE TABLE `{$wpdb->prefix}burst_search_terms`" );
		update_option( 'burst_search_terms_version', (string) time(), false );
	}

	/**
	 * Return read-only storage coverage for the selected property.
	 *
	 * @param string $property Search Console property.
	 * @return array{table_exists:bool,row_count:int,first_date:string,last_date:string}
	 */
	public function diagnostics( string $property ): array {
		if ( ! $this->table_exists( self::TABLE ) ) {
			return [
				'table_exists' => false,
				'row_count'    => 0,
				'first_date'   => '',
				'last_date'    => '',
			];
		}

		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; property is prepared.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COUNT(*) AS row_count, MIN(`date`) AS first_date, MAX(`date`) AS last_date FROM `{$wpdb->prefix}burst_search_terms` WHERE `property` = %s",
				$property
			),
			ARRAY_A
		);

		return [
			'table_exists' => true,
			'row_count'    => (int) ( $row['row_count'] ?? 0 ),
			'first_date'   => (string) ( $row['first_date'] ?? '' ),
			'last_date'    => (string) ( $row['last_date'] ?? '' ),
		];
	}

	/**
	 * Replace a single day's rows for a property (delete-then-insert) so a
	 * re-sync is idempotent. Returns false when the table is missing, so the
	 * caller does not treat the day as synced. Database errors also return false,
	 * leaving the sync cursor on this day so the next run replaces it again.
	 *
	 * @param string $date     The day in Y-m-d.
	 * @param string $property The Search Console property (siteUrl).
	 * @param array  $rows     searchAnalytics rows: each has keys[0] = query plus
	 *                         clicks, impressions, ctr, position.
	 */
	public function replace_day( string $date, string $property, array $rows ): bool {
		if ( ! $this->table_exists( self::TABLE ) || ! $this->column_exists( self::TABLE, 'page' ) ) {
			return false;
		}

		global $wpdb;
		$property = $this->trim_191( $property );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is internal and values are prepared.
		$deleted = $wpdb->query( $wpdb->prepare( "DELETE FROM `{$wpdb->prefix}burst_search_terms` WHERE `date` = %s AND `property` = %s AND `page` = ''", $date, $property ) );
		if ( false === $deleted ) {
			return false;
		}

		$row_count = count( $rows );
		for ( $offset = 0; $offset < $row_count; $offset += self::INSERT_BATCH_SIZE ) {
			$placeholders = [];
			$values       = [];
			$row_batch    = array_slice( $rows, $offset, self::INSERT_BATCH_SIZE );
			foreach ( $row_batch as $row ) {
				$query = isset( $row['keys'][0] ) ? $this->trim_191( (string) $row['keys'][0] ) : '';
				if ( '' === $query ) {
					continue;
				}
				$placeholders[] = '(%s,%s,%s,%d,%d,%f,%f)';
				array_push(
					$values,
					$date,
					$query,
					$property,
					(int) ( $row['clicks'] ?? 0 ),
					(int) ( $row['impressions'] ?? 0 ),
					(float) ( $row['ctr'] ?? 0 ),
					(float) ( $row['position'] ?? 0 )
				);
			}

			if ( empty( $placeholders ) ) {
				continue;
			}

			$sql = "INSERT INTO `{$wpdb->prefix}burst_search_terms` (`date`,`query`,`property`,`clicks`,`impressions`,`ctr`,`position`) VALUES " . implode( ',', $placeholders );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; row values are prepared.
			$inserted = $wpdb->query( $wpdb->prepare( $sql, $values ) );
			if ( false === $inserted ) {
				return false;
			}
		}

		// Bump the cache salt query_top() mixes into its cache key, so the
		// hour-long (empty results included) cache never pins a pre-sync
		// answer after new data lands — worst during the initial backfill.
		update_option( 'burst_search_terms_version', (string) time(), false );

		return true;
	}

	/**
	 * Top search queries for a property over a date range, aggregated across days.
	 *
	 * Clicks and impressions are summed; click_through_rate is recomputed from the summed totals
	 * as a percentage (0-100, the scale the UI's formatPercentage expects);
	 * position is the impression-weighted average (matching how Search Console
	 * aggregates), so neither is a naive average of daily ratios.
	 *
	 * @param string $property   The Search Console property (siteUrl).
	 * @param string $start_date Range start (inclusive), Y-m-d.
	 * @param string $end_date   Range end (inclusive), Y-m-d.
	 * @param int    $limit      Max rows.
	 * @return array<int, array{query:string,clicks:int,impressions:int,click_through_rate:float,position:float}>
	 */
	public function query_top( string $property, string $start_date, string $end_date, int $limit = 100 ): array {
		if ( ! $this->table_exists( self::TABLE ) || ! $this->column_exists( self::TABLE, 'page' ) ) {
			return [];
		}
		$property = $this->trim_191( $property );

		$query = Query::create()
			->select(
				[
					'query',
					'SUM(clicks) AS clicks',
					'SUM(impressions) AS impressions',
					'SUM(clicks) / NULLIF(SUM(impressions), 0) * 100 AS click_through_rate',
					'SUM(position * impressions) / NULLIF(SUM(impressions), 0) AS position',
				]
			)
			->from( self::TABLE )
			->where( 'property', $property )
			->where( 'page', '' )
			->where_between( 'date', $start_date, $end_date )
			->group_by( 'query' )
			->order_by_raw( 'SUM(clicks) DESC' )
			->limit( $limit );

		$rows = Query_Executor::create()
			->fingerprint( 'gsc_site_queries' )
			// Search Console data lags ~2 days and only changes when the sync
			// writes, so an hour of caching is safe (consistent with the
			// closed-range TTL in Statistics_Query) — including empty ranges,
			// which would otherwise re-run the full scan on every load while
			// the sync is still backfilling.
			->cache_ttl( HOUR_IN_SECONDS )
			->cache_empty_results( true )
			->cache_salt( (string) get_option( 'burst_search_terms_version' ) )
			->run( $query->prepare_sql(), 'get', ARRAY_A );

		if ( ! is_array( $rows ) ) {
			return [];
		}

		return array_map(
			static function ( array $row ): array {
				return [
					'query'              => (string) $row['query'],
					'clicks'             => (int) $row['clicks'],
					'impressions'        => (int) $row['impressions'],
					'click_through_rate' => (float) $row['click_through_rate'],
					'position'           => round( (float) $row['position'], 1 ),
				];
			},
			$rows
		);
	}

	/**
	 * Truncate a value to the 191-char indexed-column width (utf8mb4 safe).
	 *
	 * @param string $value Value to truncate.
	 */
	private function trim_191( string $value ): string {
		return function_exists( 'mb_substr' ) ? mb_substr( $value, 0, 191 ) : substr( $value, 0, 191 );
	}
}
