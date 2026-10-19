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
		add_filter( 'burst_get_data', [ $this, 'get_search_term_suggestions_data' ], 10, 3 );
		add_filter( 'burst_get_data_request_args', [ $this, 'add_search_term_arg' ], 10, 3 );
		add_filter( 'burst_endpoint_tab_map', [ $this, 'register_search_term_suggestions_tab_mapping' ] );
	}

	/**
	 * Whether the SmartMatch Search plugin booted in this request.
	 *
	 * Only meaningful on full WordPress loads (admin pages, frontend): on burst/v1
	 * REST requests the optimizer skips other plugins, so this returns false there.
	 *
	 * @return bool True when SmartMatch is loaded and running.
	 */
	public static function is_smartmatch_active(): bool {
		return class_exists( '\SmartMatch_Search\SmartMatch_Search' ) && \SmartMatch_Search\SmartMatch_Search::instance() !== null;
	}

	/**
	 * Add the search term to the args of the search-term suggestions endpoint.
	 *
	 * Read straight from the request: the generic arg pipeline splits values on
	 * commas, which would break a term like "invoice, vat".
	 *
	 * @param array            $args    Normalized request args.
	 * @param string           $type    The REST data type.
	 * @param \WP_REST_Request $request The REST request.
	 * @return array Args including the sanitized `term` for the suggestions type.
	 */
	public function add_search_term_arg( array $args, string $type, \WP_REST_Request $request ): array {
		if ( $type !== 'search_term_suggestions' ) {
			return $args;
		}

		$term         = $request->get_param( 'term' );
		$args['term'] = is_string( $term ) ? mb_substr( trim( sanitize_text_field( $term ) ), 0, 191 ) : '';
		return $args;
	}

	/**
	 * Map the search-term suggestions endpoint to the engagement tab, like the search-terms datatable.
	 *
	 * @param array<string, string> $map Endpoint path => tab slug.
	 * @return array<string, string> Map including the suggestions endpoint.
	 */
	public function register_search_term_suggestions_tab_mapping( array $map ): array {
		$map['data/search_term_suggestions'] = 'engagement';
		return $map;
	}

	/**
	 * Remove search strings whose only occurrence is older than a month and returned no results.
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
					HAVING COUNT(*) = 1 AND MAX(created) < %d AND MAX(result_count) = 0
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
			'metrics'    => [ 'term', 'volume', 'results', 'ai_match' ],
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
	 * largest result count seen for that term in the range. The ai_* fields
	 * describe the SmartMatch suggestions recorded at search time.
	 *
	 * @param array $args  Normalized request args with date_start/date_end.
	 * @param int   $limit Max rows to return; 0 means no limit.
	 * @return array<int, array<string, int|string>> Rows of { term, volume, results, ai_match, ai_shown, ai_none, ai_post_id, ai_title, ai_url, ai_alternatives }.
	 */
	private function query_search_terms( array $args, int $limit = 100 ): array {
		$q = $this->searches_in_range_query( $args )
			->select(
				[
					's.search AS term',
					'ss.search_id',
					'COUNT(*) AS volume',
					'MAX(ss.result_count) AS results',
					// Searches that showed a suggestion, and searches where the AI found nothing relevant.
					'SUM(ss.suggested_post_id > 0) AS ai_shown',
					'SUM(ss.suggested_post_id = 0) AS ai_none',
				]
			)
			->inner_join( 'burst_searches', 's.ID = ss.search_id', 's' )
			->group_by( 'ss.search_id, s.search' )
			->order_by( 'volume', 'DESC' );

		if ( $limit > 0 ) {
			$q->limit( $limit );
		}

		$rows = $this->run_searches_query( $q, 'search_terms', 'get' );
		if ( empty( $rows ) ) {
			return [];
		}

		$rows = array_map(
			static function ( array $row ): array {
				$ai_shown = (int) $row['ai_shown'];
				return [
					'search_id'       => (int) $row['search_id'],
					'term'            => (string) $row['term'],
					'volume'          => (int) $row['volume'],
					'results'         => (int) $row['results'],
					// Sort value for the AI match column.
					'ai_match'        => $ai_shown,
					'ai_shown'        => $ai_shown,
					'ai_none'         => (int) $row['ai_none'],
					'ai_post_id'      => 0,
					'ai_title'        => '',
					'ai_url'          => '',
					'ai_alternatives' => 0,
				];
			},
			$rows
		);

		$rows = $this->add_top_suggestions( $rows, $args );

		// search_id is an internal key; the table only needs the term.
		return array_map(
			static function ( array $row ): array {
				unset( $row['search_id'] );
				return $row;
			},
			$rows
		);
	}

	/**
	 * Attach the most-shown SmartMatch suggestion to each search-term row.
	 *
	 * Runs one grouped query for the returned terms only, and only when at least
	 * one row showed a suggestion, so sites without SmartMatch pay nothing extra.
	 *
	 * @param array<int, array<string, int|string>> $rows Search-term rows including search_id and ai_shown.
	 * @param array                                 $args Normalized request args with date_start/date_end and filters.
	 * @return array<int, array<string, int|string>> Rows with ai_post_id, ai_title, ai_url and ai_alternatives filled in.
	 */
	private function add_top_suggestions( array $rows, array $args ): array {
		$search_ids = [];
		foreach ( $rows as $row ) {
			if ( (int) $row['ai_shown'] > 0 ) {
				$search_ids[] = (int) $row['search_id'];
			}
		}

		if ( empty( $search_ids ) ) {
			return $rows;
		}

		$q = $this->searches_in_range_query( $args )
			->select( [ 'ss.search_id', 'ss.suggested_post_id AS post_id', 'COUNT(*) AS shown' ] )
			->where_in( 'ss.search_id', $search_ids, '%d' )
			->where( 'ss.suggested_post_id', 0, '>', '%d' )
			->group_by( 'ss.search_id, ss.suggested_post_id' )
			->order_by( 'shown', 'DESC' );

		$suggestions = $this->run_searches_query( $q, 'search_terms_suggestions', 'get' );
		if ( empty( $suggestions ) ) {
			return $rows;
		}

		$posts = $this->get_suggested_posts( array_column( $suggestions, 'post_id' ) );

		// Rows arrive ordered by shown DESC, so the first existing post per term is the most shown.
		$by_search_id = [];
		foreach ( $suggestions as $suggestion ) {
			$post_id = (int) $suggestion['post_id'];
			if ( ! isset( $posts[ $post_id ] ) ) {
				continue;
			}
			$by_search_id[ (int) $suggestion['search_id'] ][] = $post_id;
		}

		foreach ( $rows as $index => $row ) {
			$post_ids = $by_search_id[ (int) $row['search_id'] ] ?? [];
			if ( empty( $post_ids ) ) {
				continue;
			}
			$top                               = $posts[ $post_ids[0] ];
			$rows[ $index ]['ai_post_id']      = $post_ids[0];
			$rows[ $index ]['ai_title']        = $top['title'];
			$rows[ $index ]['ai_url']          = $top['url'];
			$rows[ $index ]['ai_alternatives'] = count( $post_ids ) - 1;
		}

		return $rows;
	}

	/**
	 * Provide the suggestion history of one search term for the `search_term_suggestions` REST type.
	 *
	 * @param array  $data The pre-existing data (returned untouched for other types).
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args (term, date_start/date_end, filters).
	 * @return array Suggestion summary for the search_term_suggestions type, otherwise $data.
	 */
	public function get_search_term_suggestions_data( array $data, string $type, array $args ): array {
		if ( $type !== 'search_term_suggestions' ) {
			return $data;
		}

		return $this->query_search_term_suggestions( $args );
	}

	/**
	 * Summarize what SmartMatch showed for one search term within a date range.
	 *
	 * Clicked counts searches whose next pageview in the same session, skipping
	 * search result pages, was the suggested post. The search row is usually
	 * linked to the hit the visitor searched from, so the hit right after it is
	 * the search results page itself.
	 *
	 * @param array $args Normalized request args (term, date_start/date_end, filters).
	 * @return array{searches: int, shown: int, not_shown: int, ai_found_nothing: int, no_suggestion: int, rows: array<int, array{post_id: int, title: string, url: string, path: string, shown: int, clicked: int}>}
	 */
	private function query_search_term_suggestions( array $args ): array {
		$empty = [
			'searches'         => 0,
			'shown'            => 0,
			'not_shown'        => 0,
			'ai_found_nothing' => 0,
			'no_suggestion'    => 0,
			'rows'             => [],
		];

		$search_id = $this->get_search_id( (string) ( $args['term'] ?? '' ) );
		if ( $search_id === 0 ) {
			return $empty;
		}

		$totals_query = $this->searches_in_range_query( $args )
			->select(
				[
					'COUNT(*) AS searches',
					'COALESCE( SUM(ss.suggested_post_id > 0), 0 ) AS shown',
					'COALESCE( SUM(ss.suggested_post_id = 0), 0 ) AS ai_found_nothing',
					'COALESCE( SUM(ss.suggested_post_id IS NULL), 0 ) AS no_suggestion',
				]
			)
			->where( 'ss.search_id', $search_id, '=', '%d' );

		$totals = $this->run_searches_query( $totals_query, 'search_term_suggestion_totals', 'get_row' );
		if ( ! is_array( $totals ) || (int) $totals['searches'] === 0 ) {
			return $empty;
		}

		global $wpdb;
		// The next non-search hit in the same session. A correlated MIN(ID) is a seek on the
		// session_id index per search row; the search volume of one term keeps this small.
		$next_hit = "nxt.ID = ( SELECT MIN(n.ID) FROM {$wpdb->prefix}burst_statistics n WHERE n.session_id = st.session_id AND n.ID > st.ID AND n.page_type != 'search' )";

		$rows_query = $this->searches_in_range_query( $args )
			->select(
				[
					'ss.suggested_post_id AS post_id',
					'COUNT(*) AS shown',
					'COALESCE( SUM(nxt.page_id = ss.suggested_post_id), 0 ) AS clicked',
				]
			)
			->inner_join( 'burst_statistics', 'st.ID = ss.statistic_id', 'st' )
			->left_join( 'burst_statistics', $next_hit, 'nxt' )
			->where( 'ss.search_id', $search_id, '=', '%d' )
			->where( 'ss.suggested_post_id', 0, '>', '%d' )
			->group_by( 'ss.suggested_post_id' )
			->order_by( 'shown', 'DESC' );

		$suggestions = $this->run_searches_query( $rows_query, 'search_term_suggestion_rows', 'get' );
		$suggestions = is_array( $suggestions ) ? $suggestions : [];
		$posts       = $this->get_suggested_posts( array_column( $suggestions, 'post_id' ) );

		$rows = [];
		foreach ( $suggestions as $suggestion ) {
			$post_id = (int) $suggestion['post_id'];
			if ( ! isset( $posts[ $post_id ] ) ) {
				continue;
			}
			$rows[] = [
				'post_id' => $post_id,
				'title'   => $posts[ $post_id ]['title'],
				'url'     => $posts[ $post_id ]['url'],
				'path'    => $posts[ $post_id ]['path'],
				'shown'   => (int) $suggestion['shown'],
				'clicked' => (int) $suggestion['clicked'],
			];
		}

		$ai_found_nothing = (int) $totals['ai_found_nothing'];
		$no_suggestion    = (int) $totals['no_suggestion'];

		return [
			'searches'         => (int) $totals['searches'],
			'shown'            => (int) $totals['shown'],
			'not_shown'        => $ai_found_nothing + $no_suggestion,
			'ai_found_nothing' => $ai_found_nothing,
			'no_suggestion'    => $no_suggestion,
			'rows'             => $rows,
		];
	}

	/**
	 * Base query over the linked search rows in the requested date range and filters.
	 *
	 * Filters constrain the searches to statistics rows that match them. A correlated
	 * EXISTS stays scalable on all-time + filter queries and is dedup-safe for 1:many
	 * filter joins.
	 *
	 * @param array $args Normalized request args with date_start/date_end and filters.
	 * @return Query Query on burst_statistics_searches aliased as `ss`, without a SELECT list.
	 */
	private function searches_in_range_query( array $args ): Query {
		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();

		$q = Query::create()
			->from( 'burst_statistics_searches', 'ss' )
			->where( 'ss.statistic_id', null, 'IS NOT NULL' )
			->where_between( 'ss.created', $start, $end, '%d' );

		// Already prepared, so escape '%' to survive the outer prepare_sql() pass
		// (the query carries placeholder values).
		$filter_exists_sql = Statistics_Query::filtered_statistics_exists_sql( (array) ( $args['filters'] ?? [] ), $start, $end, 'ss.statistic_id' );
		if ( $filter_exists_sql !== '' ) {
			$q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		return $q;
	}

	/**
	 * Run a search statistics query through the executor with the short result cache.
	 *
	 * @param Query  $q           The query to run.
	 * @param string $fingerprint Cache fingerprint for this query shape.
	 * @param string $method      wpdb method: 'get' or 'get_row'.
	 * @return array|null Result rows (ARRAY_A), a single row for get_row, or null.
	 */
	private function run_searches_query( Query $q, string $fingerprint, string $method ): ?array {
		$sql = $this->add_query_timeout_hint( $q->prepare_sql(), $this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' ) );

		$result = Query_Executor::create()
			->fingerprint( $fingerprint )
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $sql, $method, ARRAY_A );

		return is_array( $result ) ? $result : null;
	}

	/**
	 * Look up the id of a stored search term.
	 *
	 * @param string $term Sanitized search term.
	 * @return int The burst_searches ID, or 0 when the term is unknown.
	 */
	private function get_search_id( string $term ): int {
		if ( $term === '' ) {
			return 0;
		}

		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}burst_searches WHERE search = %s LIMIT 1", $term ) );
	}

	/**
	 * Resolve title, url and path for suggested posts, skipping posts that no longer exist.
	 *
	 * Paths come from the page-url dictionary (see get_page_paths_by_post_id()),
	 * not from get_permalink(), which is unreliable on burst/v1 REST requests.
	 *
	 * @param array $post_ids Post ids.
	 * @return array<int, array{title: string, url: string, path: string}> Post id => display data.
	 */
	private function get_suggested_posts( array $post_ids ): array {
		$post_ids = array_values( array_unique( array_filter( array_map( 'intval', $post_ids ), static fn( int $id ): bool => $id > 0 ) ) );
		if ( empty( $post_ids ) ) {
			return [];
		}

		_prime_post_caches( $post_ids, false, false );
		$paths = $this->get_page_paths_by_post_id( $post_ids );

		$posts = [];
		foreach ( $post_ids as $post_id ) {
			$post = get_post( $post_id );
			if ( ! $post instanceof \WP_Post ) {
				continue;
			}
			// A suggested post nobody visited yet has no dictionary row; fall back to its permalink.
			$url = ( $paths[ $post_id ] ?? '' ) !== '' ? home_url( $paths[ $post_id ] ) : (string) get_permalink( $post );

			$posts[ $post_id ] = [
				'title' => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'url'   => $url,
				'path'  => $paths[ $post_id ] ?? (string) wp_parse_url( $url, PHP_URL_PATH ),
			];
		}

		return $posts;
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
            `suggested_post_id` int NULL DEFAULT NULL,
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
			[ 'suggested_post_id' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_statistics_searches', $index );
		}
	}
}
