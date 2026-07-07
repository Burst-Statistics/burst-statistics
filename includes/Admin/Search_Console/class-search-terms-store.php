<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Helper;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Stores Google Search Console search-term rows in burst_search_terms.
 *
 * Idempotency is per (date, property): a re-sync of a day deletes that day's
 * rows for the property and re-inserts the full result set, so repeated runs
 * never duplicate. The dashboard reads only from this table; the API is never
 * called on dashboard load.
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
	}

	/**
	 * Create the table on demand if it is missing, so the cron sync works before
	 * the next plugin upgrade has run the install hook.
	 */
	public function maybe_install(): void {
		if ( ! $this->table_exists( self::TABLE ) ) {
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
	}

	/**
	 * Replace a single day's rows for a property (delete-then-insert) so a
	 * re-sync is idempotent. Returns false when the table is missing, so the
	 * caller does not treat the day as synced.
	 *
	 * @param string $date     The day in Y-m-d.
	 * @param string $property The Search Console property (siteUrl).
	 * @param array  $rows     searchAnalytics rows: each has keys[0] = query plus
	 *                         clicks, impressions, ctr, position.
	 */
	public function replace_day( string $date, string $property, array $rows ): bool {
		if ( ! $this->table_exists( self::TABLE ) ) {
			return false;
		}

		global $wpdb;
		$property = $this->trim_191( $property );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; values are prepared.
		$deleted = $wpdb->query( $wpdb->prepare( "DELETE FROM `{$wpdb->prefix}burst_search_terms` WHERE `date` = %s AND `property` = %s", $date, $property ) );
		if ( false === $deleted ) {
			// DELETE errored; skip the INSERT (it would duplicate) and signal a retry.
			return false;
		}

		$placeholders = [];
		$values       = [];
		foreach ( $rows as $row ) {
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
			// A day with no search terms is still a successfully synced day.
			return true;
		}

		$sql = "INSERT INTO `{$wpdb->prefix}burst_search_terms` (`date`,`query`,`property`,`clicks`,`impressions`,`ctr`,`position`) VALUES " . implode( ',', $placeholders );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; row values are prepared.
		$inserted = $wpdb->query( $wpdb->prepare( $sql, $values ) );
		// On an INSERT error the day's rows were already deleted; signal a retry so
		// the cursor does not advance and the day is re-fetched next run.
		return false !== $inserted;
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
		if ( ! $this->table_exists( self::TABLE ) ) {
			return [];
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is interpolated from $wpdb->prefix; values are prepared.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT `query`,
					SUM( `clicks` ) AS clicks,
					SUM( `impressions` ) AS impressions,
					SUM( `clicks` ) / NULLIF( SUM( `impressions` ), 0 ) * 100 AS click_through_rate,
					SUM( `position` * `impressions` ) / NULLIF( SUM( `impressions` ), 0 ) AS position
				FROM `{$wpdb->prefix}burst_search_terms`
				WHERE `property` = %s AND `date` BETWEEN %s AND %s
				GROUP BY `query`
				ORDER BY clicks DESC
				LIMIT %d",
				$property,
				$start_date,
				$end_date,
				$limit
			),
			ARRAY_A
		);

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
