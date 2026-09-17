<?php
/**
 * Independent Analytics Database Adapter.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Manager;

defined( 'ABSPATH' ) || die();

/**
 * Class Independent_Analytics_Adapter
 *
 * Importer adapter for Independent Analytics local database tables.
 */
class Independent_Analytics_Adapter extends Database_Adapter {

	/**
	 * Get adapter ID.
	 */
	public function get_id(): string {
		return 'independent_analytics';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'Independent Analytics (Local Database)', 'burst-statistics' );
	}

	/**
	 * Get source table name.
	 */
	protected function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'iawp_views';
	}

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	protected function get_preview_headers(): array {
		return [ 'id', 'date', 'views', 'visitor_id' ];
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'referrers', 'devices' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones' ],
		];
	}

	/**
	 * Get query and arguments for estimation.
	 *
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_estimate_query(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols     = $wpdb->get_col( "SHOW COLUMNS FROM {$this->get_table()}" );
		$date_col = in_array( 'viewed_at', $cols, true ) && ! in_array( 'date', $cols, true ) ? 'viewed_at' : 'date';
		$cutoff   = Import_Manager::get_burst_tracking_start();

		return [
			'query' => "SELECT COUNT(*) as count, MIN({$date_col}) as min_date, MAX({$date_col}) as max_date FROM {$this->get_table()} WHERE {$date_col} < %s",
			'args'  => [ $cutoff['date'] ],
		];
	}

	/**
	 * Get SQL query and arguments for fetching a batch of rows.
	 *
	 * @param array<string, mixed> $state Current import state.
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_batch_query( array $state ): array {
		global $wpdb;

		$last_id   = (int) ( $state['watermark_id'] ?? 0 );
		$batch_max = (int) ( $state['batch_size'] ?? 1000 );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols      = $wpdb->get_col( "SHOW COLUMNS FROM {$this->get_table()}" );
		$date_col  = in_array( 'viewed_at', $cols, true ) && ! in_array( 'date', $cols, true ) ? 'viewed_at' : 'date';
		$has_url   = in_array( 'url', $cols, true );
		$url_field = $has_url ? 'url,' : '';
		$cutoff    = Import_Manager::get_burst_tracking_start();

		return [
			'query' => "SELECT id, {$url_field} {$date_col} as log_date, page_id FROM {$this->get_table()} WHERE id > %d AND {$date_col} < %s ORDER BY id ASC LIMIT %d",
			'args'  => [ $last_id, $cutoff['date'], $batch_max ],
		];
	}

	/**
	 * Map a raw database row into Burst synthesized event fields.
	 *
	 * @param object $row Database row object.
	 * @return array<string, mixed>
	 */
	protected function map_row( object $row ): array {
		return [
			'date'        => (string) $row->log_date,
			'page_url'    => ! empty( $row->url ) ? (string) $row->url : '/',
			'page_id'     => (int) ( $row->page_id ?? 0 ),
			'pageviews'   => 1,
			'visitors'    => 1,
			'duration'    => 30,
			'bounce_rate' => 0.0,
			'source'      => '',
			'device'      => 'desktop',
		];
	}
}
