<?php
namespace Burst\Admin\Engagement;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Reading_Engagement {
	use Admin_Helper;
	use Database_Helper;
	use Helper;

	/**
	 * Initialize the reading engagement class
	 */
	public function init(): void {
		add_filter( 'burst_get_data', [ $this, 'get_reading_engagement_data' ], 10, 3 );
		add_filter( 'burst_datatable_config', [ $this, 'register_reading_engagement_datatable' ] );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_reading_engagement_tab_mapping' ] );
		add_filter( 'burst_datatable_pre_data', [ $this, 'get_reading_engagement_datatable_data' ], 10, 2 );
		add_filter( 'burst_get_data_available_args', [ $this, 'add_reading_engagement_available_args' ], 10, 2 );
		add_filter( 'burst_sanitize_arg', [ $this, 'sanitize_reading_engagement_arg' ], 10, 3 );
	}

	/**
	 * Register the reading-engagement datatable (metrics allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by datatable id.
	 * @return array Config including the reading-engagement datatable.
	 */
	public function register_reading_engagement_datatable( array $config ): array {
		$config['reading-engagement'] = [
			'metrics'    => [ 'page_url', 'avg_time_on_page' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Map the reading-engagement datatable to the engagement tab for shared viewer access control.
	 *
	 * @param array<string, string> $map Datatable ID => tab slug.
	 * @return array<string, string> Map including the reading-engagement datatable.
	 */
	public function register_reading_engagement_tab_mapping( array $map ): array {
		$map['reading-engagement'] = 'engagement';
		return $map;
	}

	/**
	 * Add custom arguments to the REST API allowed parameters.
	 *
	 * @param array  $args Allowed args.
	 * @param string $type The REST data type.
	 * @return array Modified args.
	 */
	public function add_reading_engagement_available_args( array $args, string $type ): array {
		if ( $type === 'reading_engagement' || $type === 'datatable-reading-engagement' ) {
			$args[] = 'least_engagement';
		}
		return $args;
	}

	/**
	 * Sanitize the custom argument.
	 *
	 * @param mixed  $sanitized_value The sanitized value.
	 * @param string $arg             The arg name.
	 * @param mixed  $value           The raw value.
	 * @return mixed Sanitized value.
	 */
	public function sanitize_reading_engagement_arg( mixed $sanitized_value, string $arg, mixed $value ): mixed {
		if ( $arg === 'least_engagement' ) {
			return filter_var( $value, FILTER_VALIDATE_BOOLEAN );
		}
		return $sanitized_value;
	}

	/**
	 * Provide reading engagement rows for the reading-engagement datatable endpoint.
	 *
	 * @param array|null $data The pre-data value (null to fall through to the default query).
	 * @param array      $args Arguments passed to get_datatables_data (includes id, date_start/date_end).
	 * @return array|null Rows for the reading-engagement datatable, otherwise the unchanged pre-data value.
	 */
	public function get_reading_engagement_datatable_data( ?array $data, array $args ): ?array {
		if ( ( $args['id'] ?? null ) !== 'reading-engagement' ) {
			return $data;
		}

		return $this->query_reading_engagement( $args, 0 );
	}

	/**
	 * Provide aggregated reading engagement data for the `reading_engagement` REST type.
	 *
	 * @param array  $data The pre-existing data (returned untouched for other types).
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args (includes date_start/date_end as unix timestamps).
	 * @return array Rows of { page_url, avg_time_on_page } for the reading_engagement type, otherwise $data.
	 */
	public function get_reading_engagement_data( array $data, string $type, array $args ): array {
		if ( $type !== 'reading_engagement' ) {
			return $data;
		}

		return $this->query_reading_engagement( $args );
	}

	/**
	 * Query the reading engagement metrics within a date range.
	 *
	 * @param array $args  Normalized request args with date_start/date_end.
	 * @param int   $limit Max rows to return; 0 means no limit.
	 * @return array<int, array{page_url: string, avg_time_on_page: int}>
	 */
	private function query_reading_engagement( array $args, int $limit = 10 ): array {
		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();
		$least = isset( $args['least_engagement'] ) && (bool) $args['least_engagement'];

		$q = Query::create()
			->select( [ 'page_url', 'AVG(time_on_page) AS avg_time_on_page' ] )
			->from( 'burst_statistics' )
			->where_between( 'time', $start, $end, '%d' )
			->where( 'time_on_page', 0, '>', '%d' )
			->where( 'page_url', '', '!=' )
			->group_by( 'page_url' )
			->order_by( 'avg_time_on_page', $least ? 'ASC' : 'DESC' );

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
					'page_url'         => (string) $row['page_url'],
					'avg_time_on_page' => (int) round( (float) $row['avg_time_on_page'] ),
				];
			},
			$rows
		);
	}
}
