<?php
namespace Burst\Admin\Errors;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Errors {
	use Admin_Helper;
	use Database_Helper;
	use Helper;

	/**
	 * Register hooks
	 */
	public function init(): void {
		add_filter( 'burst_get_data', [ $this, 'get_not_found_pages_data' ], 10, 3 );
		add_filter( 'burst_datatable_config', [ $this, 'register_not_found_pages_datatable' ] );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_not_found_pages_tab_mapping' ] );
		add_filter( 'burst_datatable_pre_data', [ $this, 'get_not_found_pages_datatable_data' ], 10, 2 );
		add_filter( 'burst_get_data_available_args', [ $this, 'add_not_found_available_args' ], 10, 2 );
		add_filter( 'burst_endpoint_tab_map', [ $this, 'register_endpoint_tab_mapping' ] );
	}

	/**
	 * Register the not-found-pages datatable (metrics allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by datatable id.
	 * @return array Config including the not-found-pages datatable.
	 */
	public function register_not_found_pages_datatable( array $config ): array {
		$config['not-found-pages'] = [
			'metrics'    => [ 'page_url', 'hits' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Map the not-found-pages datatable to the engagement tab.
	 *
	 * @param array<string, string> $map Datatable ID => tab slug.
	 * @return array<string, string> Map including the not-found-pages datatable.
	 */
	public function register_not_found_pages_tab_mapping( array $map ): array {
		$map['not-found-pages'] = 'engagement';
		return $map;
	}

	/**
	 * Map not_found_pages endpoints to the engagement tab for share routing.
	 *
	 * @param array<string, string> $map Existing endpoint-to-tab mappings.
	 * @return array<string, string> Map including not_found_pages endpoints.
	 */
	public function register_endpoint_tab_mapping( array $map ): array {
		$map['data/not_found_pages']          = 'engagement';
		$map['data/not_found_page_referrers'] = 'engagement';
		return $map;
	}

	/**
	 * Provide rows for the not-found-pages datatable endpoint.
	 *
	 * @param array|null $data The pre-data value.
	 * @param array      $args Arguments passed to get_datatables_data.
	 * @return array|null Rows for the not-found-pages datatable.
	 */
	public function get_not_found_pages_datatable_data( ?array $data, array $args ): ?array {
		if ( ( $args['id'] ?? null ) !== 'not-found-pages' ) {
			return $data;
		}

		return $this->query_not_found_pages( $args, 0 );
	}

	/**
	 * Add custom arguments to the REST API allowed parameters.
	 *
	 * @param array  $args Allowed args.
	 * @param string $type The REST data type.
	 * @return array Modified args.
	 */
	public function add_not_found_available_args( array $args, string $type ): array {
		if ( $type === 'not_found_page_referrers' ) {
			$args[] = 'page_url';
		}
		return $args;
	}

	/**
	 * Provide aggregated data for the `not_found_pages` and `not_found_page_referrers` REST types.
	 *
	 * @param array  $data The pre-existing data.
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args.
	 * @return array Processed data.
	 */
	public function get_not_found_pages_data( array $data, string $type, array $args ): array {
		if ( $type === 'not_found_pages' ) {
			return $this->query_not_found_pages( $args );
		}

		if ( $type === 'not_found_page_referrers' ) {
			return $this->query_not_found_page_referrers( $args );
		}

		return $data;
	}

	/**
	 * Query top 404 error pages within a date range.
	 *
	 * @param array $args  Normalized request args with date_start/date_end.
	 * @param int   $limit Max rows to return; 0 means no limit.
	 * @return array<int, array{page_url: string, hits: int}>
	 */
	private function query_not_found_pages( array $args, int $limit = 100 ): array {
		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();

		$q = Query::create()
			->select( [ 's.page_url AS page_url', 'COUNT(*) AS hits' ] )
			->from( 'burst_statistics', 's' )
			->where( 's.page_type', '404' )
			->where_between( 's.time', $start, $end, '%d' )
			->group_by( 's.page_url' )
			->order_by( 'hits', 'DESC' );

		// Apply filters using EXISTS subquery logic.
		$filters           = (array) ( $args['filters'] ?? [] );
		$filters['status'] = '404';
		$filter_exists_sql = Statistics_Query::filtered_statistics_exists_sql( $filters, $start, $end, 's.ID' );
		if ( $filter_exists_sql !== '' ) {
			$q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		if ( $limit > 0 ) {
			$q->limit( $limit );
		}

		$timeout_ms = $this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' );
		$sql        = $this->add_query_timeout_hint( $q->prepare_sql(), $timeout_ms );

		$rows = Query_Executor::create()
			->fingerprint( 'not_found_pages' )
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $sql, 'get', ARRAY_A );

		if ( empty( $rows ) ) {
			return [];
		}

		return array_map(
			static function ( array $row ): array {
				return [
					'page_url' => (string) $row['page_url'],
					'hits'     => (int) $row['hits'],
				];
			},
			$rows
		);
	}

	/**
	 * Query referrers for a specific 404 page within a date range.
	 *
	 * @param array $args Normalized request args with date_start, date_end, page_url.
	 * @return array{
	 *     total_hits: int,
	 *     no_referrer_hits: int,
	 *     counts: array{all: int, internal: int, external: int},
	 *     referrers: array<int, array{
	 *         referrer: string,
	 *         hits: int,
	 *         is_internal: bool,
	 *         display_url: string,
	 *         url: string,
	 *         edit_url: string
	 *     }>
	 * }
	 */
	private function query_not_found_page_referrers( array $args ): array {
		$page_url = (string) ( $args['page_url'] ?? '' );
		if ( empty( $page_url ) ) {
			return $this->shape_response(
				[
					'total_hits'       => 0,
					'internal_hits'    => 0,
					'external_hits'    => 0,
					'no_referrer_hits' => 0,
				],
				[]
			);
		}

		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();

		$filters           = (array) ( $args['filters'] ?? [] );
		$filters['status'] = '404';
		$filter_exists_sql = Statistics_Query::filtered_statistics_exists_sql( $filters, $start, $end, 's.ID' );

		$timeout_ms = $this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' );

		$summary = $this->fetch_referrer_summary( $page_url, $start, $end, $filter_exists_sql, $timeout_ms );
		if ( 0 === $summary['total_hits'] ) {
			return $this->shape_response( $summary, [] );
		}

		$rows             = $this->fetch_referrer_rows( $page_url, $start, $end, $filter_exists_sql, $timeout_ms );
		$merged_referrers = $this->merge_referrer_rows( $rows );
		$referrers        = $this->resolve_edit_urls( $merged_referrers );

		return $this->shape_response( $summary, $referrers );
	}

	/**
	 * Fetch total, internal, external, and no-referrer hits via an exact summary query.
	 *
	 * @param string $page_url          Target 404 page URL.
	 * @param int    $start             Start timestamp.
	 * @param int    $end               End timestamp.
	 * @param string $filter_exists_sql Filter EXISTS clause if applicable.
	 * @param int    $timeout_ms        Query timeout in milliseconds.
	 * @return array{total_hits: int, internal_hits: int, external_hits: int, no_referrer_hits: int}
	 */
	private function fetch_referrer_summary( string $page_url, int $start, int $end, string $filter_exists_sql, int $timeout_ms ): array {
		$summary_q = Query::create()
			->from( 'burst_statistics', 's' )
			->select_raw( 'COUNT(s.ID) AS total_hits' )
			->select_raw( 'SUM(CASE WHEN prev.page_url IS NOT NULL AND prev.page_url != \'\' THEN 1 ELSE 0 END) AS internal_hits' )
			->select_raw( 'SUM(CASE WHEN (prev.page_url IS NULL OR prev.page_url = \'\') AND sess.referrer IS NOT NULL AND sess.referrer != \'\' THEN 1 ELSE 0 END) AS external_hits' )
			->select_raw( 'SUM(CASE WHEN (prev.page_url IS NULL OR prev.page_url = \'\') AND (sess.referrer IS NULL OR sess.referrer = \'\') THEN 1 ELSE 0 END) AS no_referrer_hits' )
			->where( 's.page_type', '404' )
			->where( 's.page_url', $page_url, '=', '%s' )
			->where_between( 's.time', $start, $end, '%d' );

		Statistics_Query::join_referring_page( $summary_q, 's' );

		if ( '' !== $filter_exists_sql ) {
			$summary_q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		$summary_sql = $this->add_query_timeout_hint( $summary_q->prepare_sql(), $timeout_ms );

		$summary_row = Query_Executor::create()
			->fingerprint( 'not_found_page_referrers_summary' )
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $summary_sql, 'get_row', ARRAY_A );

		return [
			'total_hits'       => (int) ( $summary_row['total_hits'] ?? 0 ),
			'internal_hits'    => (int) ( $summary_row['internal_hits'] ?? 0 ),
			'external_hits'    => (int) ( $summary_row['external_hits'] ?? 0 ),
			'no_referrer_hits' => (int) ( $summary_row['no_referrer_hits'] ?? 0 ),
		];
	}

	/**
	 * Fetch top referrer candidate rows with source classification up to limit 100.
	 *
	 * @param string $page_url          Target 404 page URL.
	 * @param int    $start             Start timestamp.
	 * @param int    $end               End timestamp.
	 * @param string $filter_exists_sql Filter EXISTS clause if applicable.
	 * @param int    $timeout_ms        Query timeout in milliseconds.
	 * @return array<int, array<string, mixed>>
	 */
	private function fetch_referrer_rows( string $page_url, int $start, int $end, string $filter_exists_sql, int $timeout_ms ): array {
		$ref_case_sql = Statistics_Query::get_referring_page_case_sql();

		$ref_q = Query::create()
			->from( 'burst_statistics', 's' )
			->select_raw( "{$ref_case_sql} AS ref_source" )
			->select_raw( 'CASE WHEN prev.page_url IS NOT NULL AND prev.page_url != \'\' THEN 1 ELSE 0 END AS is_internal' )
			->select_raw( 'COUNT(s.ID) AS hits' )
			->where( 's.page_type', '404' )
			->where( 's.page_url', $page_url, '=', '%s' )
			->where_between( 's.time', $start, $end, '%d' )
			->where_raw( "((prev.page_url IS NOT NULL AND prev.page_url != '') OR (sess.referrer IS NOT NULL AND sess.referrer != ''))" );

		Statistics_Query::join_referring_page( $ref_q, 's' );

		if ( '' !== $filter_exists_sql ) {
			$ref_q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		$ref_q
			->group_by( 'ref_source, is_internal' )
			->order_by( 'hits', 'DESC' )
			->limit( 100 );

		$ref_sql = $this->add_query_timeout_hint( $ref_q->prepare_sql(), $timeout_ms );

		return (array) ( Query_Executor::create()
			->fingerprint( 'not_found_page_referrers' )
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $ref_sql, 'get', ARRAY_A ) ?: [] );
	}

	/**
	 * Normalize an external referrer into display host and target URL.
	 *
	 * Strips schemes, paths, query strings, and leading www. prefix.
	 *
	 * @param string $raw_ref Raw referrer string (bare host or full URL).
	 * @return array{display_url: string, url: string}
	 */
	private function normalize_external_host( string $raw_ref ): array {
		$raw_ref = trim( $raw_ref );
		$host    = wp_parse_url( $raw_ref, PHP_URL_HOST );
		if ( empty( $host ) ) {
			$parts = explode( '/', $raw_ref, 2 );
			$host  = $parts[0];
		}
		$clean_host = preg_replace( '/^www\./i', '', (string) $host );
		$clean_host = trim( (string) $clean_host, '/' );

		return [
			'display_url' => $clean_host,
			'url'         => '' !== $clean_host ? 'https://' . $clean_host : '',
		];
	}

	/**
	 * Merge raw referrer rows into normalized internal and external referrers.
	 *
	 * @param array<int, array<string, mixed>> $rows Raw database rows.
	 * @return array<int, array{referrer: string, hits: int, is_internal: bool, display_url: string, url: string, edit_url: string}>
	 */
	private function merge_referrer_rows( array $rows ): array {
		$merged_referrers = [];

		foreach ( $rows as $row ) {
			$raw_ref     = trim( (string) ( $row['ref_source'] ?? '' ) );
			$hits        = (int) ( $row['hits'] ?? 0 );
			$is_internal = ! empty( $row['is_internal'] );

			if ( '' === $raw_ref ) {
				continue;
			}

			if ( $is_internal ) {
				$display_url = $raw_ref;
				$url         = home_url( $display_url );
				$group_key   = 'int:' . $display_url;
			} else {
				$norm        = $this->normalize_external_host( $raw_ref );
				$display_url = $norm['display_url'];
				$url         = $norm['url'];
				$group_key   = 'ext:' . $display_url;
			}

			if ( isset( $merged_referrers[ $group_key ] ) ) {
				$merged_referrers[ $group_key ]['hits'] += $hits;
			} else {
				$merged_referrers[ $group_key ] = [
					'referrer'    => $raw_ref,
					'hits'        => $hits,
					'is_internal' => $is_internal,
					'display_url' => (string) $display_url,
					'url'         => (string) $url,
					'edit_url'    => '',
				];
			}
		}

		uasort(
			$merged_referrers,
			static fn( array $a, array $b ): int => $b['hits'] <=> $a['hits']
		);

		return array_slice( array_values( $merged_referrers ), 0, 100 );
	}

	/**
	 * Resolve post edit links for internal referrers.
	 *
	 * Only resolves edit links for internal referrers present in the returned list.
	 *
	 * @param array<int, array{referrer: string, hits: int, is_internal: bool, display_url: string, url: string, edit_url: string}> $referrers
	 * @return array<int, array{referrer: string, hits: int, is_internal: bool, display_url: string, url: string, edit_url: string}>
	 */
	private function resolve_edit_urls( array $referrers ): array {
		$internal_paths = [];
		foreach ( $referrers as $idx => $ref ) {
			if ( ! empty( $ref['is_internal'] ) && ! empty( $ref['display_url'] ) ) {
				$internal_paths[ $idx ] = (string) $ref['display_url'];
			}
		}

		if ( empty( $internal_paths ) ) {
			return $referrers;
		}

		$page_id_map = $this->get_page_ids_for_urls( array_values( array_unique( $internal_paths ) ) );

		foreach ( $internal_paths as $idx => $path ) {
			$post_id = $page_id_map[ $path ] ?? 0;
			if ( $post_id > 0 && current_user_can( 'edit_post', $post_id ) ) {
				$raw_edit = get_edit_post_link( $post_id, 'raw' );
				if ( ! empty( $raw_edit ) ) {
					$referrers[ $idx ]['edit_url'] = (string) $raw_edit;
				}
			}
		}

		return $referrers;
	}

	/**
	 * Shape the response payload for not-found page referrers.
	 *
	 * @param array{total_hits: int, internal_hits: int, external_hits: int, no_referrer_hits: int}                                 $summary   Summary metrics.
	 * @param array<int, array{referrer: string, hits: int, is_internal: bool, display_url: string, url: string, edit_url: string}> $referrers Merged referrer rows.
	 * @return array{
	 *     total_hits: int,
	 *     no_referrer_hits: int,
	 *     counts: array{all: int, internal: int, external: int},
	 *     referrers: array<int, array{referrer: string, hits: int, is_internal: bool, display_url: string, url: string, edit_url: string}>
	 * }
	 */
	private function shape_response( array $summary, array $referrers ): array {
		return [
			'total_hits'       => $summary['total_hits'],
			'no_referrer_hits' => $summary['no_referrer_hits'],
			'counts'           => [
				'all'      => $summary['internal_hits'] + $summary['external_hits'],
				'internal' => $summary['internal_hits'],
				'external' => $summary['external_hits'],
			],
			'referrers'        => $referrers,
		];
	}
}
