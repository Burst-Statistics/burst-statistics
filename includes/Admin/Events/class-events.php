<?php
namespace Burst\Admin\Events;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Events {
	use Database_Helper;
	use Helper;

	/**
	 * The plugin version this file belongs to. See Upgrade::check_upgrade().
	 *
	 * @var string
	 */
	public const BUILD = '3.7.4';

	/**
	 * Register install hooks and datatable filters.
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_events_table' ], 10 );
		add_filter( 'burst_datatable_config', [ $this, 'register_events_datatable' ] );
		add_filter( 'burst_datatable_pre_data', [ $this, 'get_events_datatable_data' ], 10, 2 );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_events_tab_mapping' ] );
	}

	/**
	 * Schemas of the event tables, read by install_events_table() and the schema check.
	 *
	 * The burst_event_names table is the event-name dictionary: burst_events
	 * stores the dictionary id in name_id, so a name is never repeated per hit.
	 *
	 * @return array<string, array{columns: string, indexes?: array<int, string[]>}>
	 */
	protected function get_schema_definition(): array {
		return [
			'burst_event_names' => [
				'columns' => '
			`ID` int unsigned NOT NULL AUTO_INCREMENT,
			`name` varchar(64) NOT NULL,
			PRIMARY KEY (ID),
			UNIQUE KEY name (name)
		',
			],
			'burst_events'      => [
				'columns' => '
            `ID` int NOT NULL AUTO_INCREMENT,
            `statistic_id` int NOT NULL,
            `uid_id` int unsigned NOT NULL DEFAULT 0,
            `time` int NOT NULL,
			`name_id` int unsigned NOT NULL,
            `value` float DEFAULT NULL,
            PRIMARY KEY (ID)
        ',
				'indexes' => [
					[ 'statistic_id', 'time' ],
					[ 'time', 'name_id' ],
					[ 'name_id', 'time' ],
					[ 'uid_id', 'time' ],
				],
			],
		];
	}

	/**
	 * Install the event-name dictionary and the event data table.
	 *
	 * The dictionary comes first and stops the install when it fails: an event
	 * row without a name_id to point at is unreadable, and install_schema()
	 * has already reported the failure, so the whole upgrade is retried.
	 */
	public function install_events_table(): void {
		if ( ! $this->install_schema( [ 'burst_event_names' ] ) ) {
			return;
		}

		$this->install_schema( [ 'burst_events' ] );
	}

	/**
	 * Associate the events datatable with the Engagement tab for share links.
	 *
	 * @param array $map Existing datatable-to-tab mappings.
	 * @return array Updated mappings.
	 */
	public function register_events_tab_mapping( array $map ): array {
		$map['events'] = 'engagement';
		return $map;
	}

	/**
	 * Register the events datatable (metrics allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by datatable id.
	 * @return array Config including the events datatable.
	 */
	public function register_events_datatable( array $config ): array {
		$config['events'] = [
			'metrics'    => [ 'name', 'count' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Provide event rows for the events datatable endpoint.
	 *
	 * @param array|null $data The pre-data value (null to fall through to the default query).
	 * @param array      $args Arguments passed to get_datatables_data (includes id, date_start/date_end).
	 * @return array|null Rows of { name, count } for the events datatable, otherwise the unchanged pre-data value.
	 */
	public function get_events_datatable_data( ?array $data, array $args ): ?array {
		if ( ( $args['id'] ?? null ) !== 'events' ) {
			return $data;
		}
		return $this->query_events( $args );
	}

	/**
	 * Query event name counts within a date range.
	 *
	 * @param array $args Normalized request args with date_start/date_end.
	 * @return array<int, array{name: string, count: int}>
	 */
	private function query_events( array $args ): array {
		$start = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end   = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();

		$q = Query::create()
			->select( [ 'n.name', 'COUNT(*) AS count' ] )
			->from( 'burst_events', 'e' )
			->inner_join( 'burst_event_names', 'n.ID = e.name_id', 'n' )
			->where_between( 'e.time', $start, $end, '%d' )
			->group_by( 'n.ID, n.name' )
			->order_by( 'count', 'DESC' );

		// Apply the standard browser/page/referrer/… filters by constraining events to
		// statistics rows that match them, via burst_events.statistic_id. Same correlated
		// EXISTS pattern as Search/Forms/External_Link — see filtered_statistics_exists_sql().
		// Already prepared, so escape '%' to survive build_sql()'s prepare pass.
		$filter_exists_sql = Statistics_Query::filtered_statistics_exists_sql( (array) ( $args['filters'] ?? [] ), $start, $end, 'e.statistic_id' );
		if ( $filter_exists_sql !== '' ) {
			$q->where_raw( str_replace( '%', '%%', $filter_exists_sql ) );
		}

		$rows = Query_Executor::create()
			->fingerprint( 'events' )
			->cache_ttl( 30 )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( false )
			->run( $q->build_sql(), 'get', ARRAY_A );

		if ( empty( $rows ) ) {
			return [];
		}

		return array_map(
			static fn( array $row ): array => [
				'name'  => (string) $row['name'],
				'count' => (int) $row['count'],
			],
			$rows
		);
	}
}
