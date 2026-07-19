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
	 * Provide aggregated data for the `not_found_pages` REST type.
	 *
	 * @param array  $data The pre-existing data.
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args.
	 * @return array Rows of { page_url, hits } for the not_found_pages type.
	 */
	public function get_not_found_pages_data( array $data, string $type, array $args ): array {
		if ( $type !== 'not_found_pages' ) {
			return $data;
		}

		return $this->query_not_found_pages( $args );
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
			->where( 's.status', 404, '=', '%d' )
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
					'page_url' => (string) $row['page_url'],
					'hits'     => (int) $row['hits'],
				];
			},
			$rows
		);
	}
}
