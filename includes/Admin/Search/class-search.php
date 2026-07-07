<?php
namespace Burst\Admin\Search;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Search {
	use Admin_Helper;
	use Database_Helper;
	use Helper;

	/**
	 * Register install hooks
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_searches_table' ], 10 );
		add_action( 'burst_install_tables', [ $this, 'install_statistics_searches_table' ], 10 );
		add_action( 'burst_monthly', [ $this, 'cleanup_single_occurrence_searches' ] );
		add_action( 'burst_daily', [ $this, 'cleanup_pending_searches' ] );
		add_filter( 'burst_get_data', [ $this, 'get_search_terms_data' ], 10, 3 );
		add_filter( 'burst_datatable_config', [ $this, 'register_search_terms_datatable' ] );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_search_terms_tab_mapping' ] );
		add_filter( 'burst_datatable_pre_data', [ $this, 'get_search_terms_datatable_data' ], 10, 2 );
	}

	/**
	 * Remove search strings that occurred only once in the past month.
	 * Hooked to `burst_monthly`.
	 */
	public function cleanup_single_occurrence_searches(): void {
		global $wpdb;

		if ( ! $this->table_exists( 'burst_searches' ) || ! $this->table_exists( 'burst_statistics_searches' ) ) {
			return;
		}

		$window_start = time() - MONTH_IN_SECONDS;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
		$wpdb->query(
			$wpdb->prepare(
				"DELETE s FROM {$wpdb->prefix}burst_searches s
				INNER JOIN (
					SELECT search_id
					FROM {$wpdb->prefix}burst_statistics_searches
					WHERE statistic_id IS NOT NULL
					GROUP BY search_id
					HAVING COUNT(*) = 1 AND MAX(created) >= %d
				) one_off ON one_off.search_id = s.ID",
				$window_start
			)
		);

		$orphans_removed = $wpdb->query(
			"DELETE ss FROM {$wpdb->prefix}burst_statistics_searches ss
			LEFT JOIN {$wpdb->prefix}burst_searches s ON s.ID = ss.search_id
			WHERE s.ID IS NULL"
		);
		// phpcs:enable
	}

	/**
	 * Register the search-terms datatable (metrics allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by datatable id.
	 * @return array Config including the search-terms datatable.
	 */
	public function register_search_terms_datatable( array $config ): array {
		$config['search-terms'] = [
			'metrics'    => [ 'term', 'volume', 'results' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Map the search-terms datatable to the engagement tab for shared viewer access control.
	 *
	 * @param array<string, string> $map Datatable ID => tab slug.
	 * @return array<string, string> Map including the search-terms datatable.
	 */
	public function register_search_terms_tab_mapping( array $map ): array {
		$map['search-terms'] = 'engagement';
		return $map;
	}

	/**
	 * Provide search-term rows for the search-terms datatable endpoint.
	 *
	 * @param array|null $data The pre-data value (null to fall through to the default query).
	 * @param array      $args Arguments passed to get_datatables_data (includes id, date_start/date_end).
	 * @return array|null Rows for the search-terms datatable, otherwise the unchanged pre-data value.
	 */
	public function get_search_terms_datatable_data( ?array $data, array $args ): ?array {
		if ( ( $args['id'] ?? null ) !== 'search-terms' ) {
			return $data;
		}

		return $this->query_search_terms( $args, 0 );
	}

	/**
	 * Provide aggregated search-term data for the `search_terms` REST type.
	 *
	 * @param array  $data The pre-existing data (returned untouched for other types).
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args (includes date_start/date_end as unix timestamps).
	 * @return array Rows of { term, volume, results } for the search_terms type, otherwise $data.
	 */
	public function get_search_terms_data( array $data, string $type, array $args ): array {
		if ( $type !== 'search_terms' ) {
			return $data;
		}

		return $this->query_search_terms( $args );
	}

	/**
	 * Query the top search terms within a date range.
	 *
	 * Volume counts the recorded occurrences of each term; results is the
	 * largest result count seen for that term in the range.
	 *
	 * @param array $args  Normalized request args with date_start/date_end.
	 * @param int   $limit Max rows to return; 0 means no limit.
	 * @return array<int, array{term: string, volume: int, results: int}>
	 */
	private function query_search_terms( array $args, int $limit = 100 ): array {
		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();

		$q = Query::create()
			->select( [ 's.search AS term', 'COUNT(*) AS volume', 'MAX(ss.result_count) AS results' ] )
			->from( 'burst_statistics_searches', 'ss' )
			->inner_join( 'burst_searches', 's.ID = ss.search_id', 's' )
			->where( 'ss.statistic_id', null, 'IS NOT NULL' )
			->where_between( 'ss.created', $start, $end, '%d' )
			->group_by( 'ss.search_id, s.search' )
			->order_by( 'volume', 'DESC' );

		// Apply the standard browser/page/referrer/… filters by constraining the searches to
		// statistics rows that match them. A correlated EXISTS stays scalable on all-time +
		// filter queries and is dedup-safe for 1:many filter joins. Already prepared, so escape
		// '%' to survive the outer prepare_sql() pass (the query carries placeholder values).
		$filter_exists_sql = Statistics_Query::filtered_statistics_exists_sql( (array) ( $args['filters'] ?? [] ), $start, $end, 'ss.statistic_id' );
		if ( $filter_exists_sql !== '' ) {
			$q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		if ( $limit > 0 ) {
			$q->limit( $limit );
		}

		$rows = Query_Executor::create()
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $q->prepare_sql(), 'get', ARRAY_A );

		if ( empty( $rows ) ) {
			return [];
		}

		return array_map(
			static function ( array $row ): array {
				return [
					'term'    => (string) $row['term'],
					'volume'  => (int) $row['volume'],
					'results' => (int) $row['results'],
				];
			},
			$rows
		);
	}

	/**
	 * Delete pending search rows (statistic_id IS NULL) older than one hour.
	 * Hooked to `burst_daily`.
	 */
	public function cleanup_pending_searches(): void {
		global $wpdb;

		if ( ! $this->table_exists( 'burst_statistics_searches' ) ) {
			return;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}burst_statistics_searches
				WHERE statistic_id IS NULL AND created < %d",
				time() - HOUR_IN_SECONDS
			)
		);
		// phpcs:enable
	}

	/**
	 * Install searches table
	 */
	public function install_searches_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$sql             = "CREATE TABLE {$wpdb->prefix}burst_searches (
            `ID` int NOT NULL AUTO_INCREMENT,
            `search` varchar(191) NOT NULL,
            PRIMARY KEY (ID),
            UNIQUE KEY search_unique (search)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating searches table: ' . $wpdb->last_error );
		}
	}

	/**
	 * Install statistics ↔ searches table
	 */
	public function install_statistics_searches_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$sql             = "CREATE TABLE {$wpdb->prefix}burst_statistics_searches (
            `ID` int NOT NULL AUTO_INCREMENT,
            `statistic_id` int,
            `search_id` int NOT NULL,
            `result_count` int NOT NULL DEFAULT 0,
            `created` int NOT NULL DEFAULT 0,
            PRIMARY KEY (ID),
            UNIQUE KEY statistic_search_unique (statistic_id, search_id)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating statistics searches table: ' . $wpdb->last_error );
			return;
		}

		$indexes = [
			[ 'statistic_id' ],
			[ 'search_id' ],
			[ 'created' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_statistics_searches', $index );
		}
	}
}
