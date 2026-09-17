<?php
/**
 * Koko Analytics Database Adapter.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Manager;

defined( 'ABSPATH' ) || die();

/**
 * Class Koko_Adapter
 *
 * Importer adapter for Koko Analytics local database tables.
 */
class Koko_Adapter extends Database_Adapter {

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'koko';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'Koko Analytics (Local Database)', 'burst-statistics' );
	}

	/**
	 * Get source table name.
	 */
	protected function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'koko_analytics_site_stats';
	}

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	protected function get_preview_headers(): array {
		return [ 'date', 'pageview_count', 'visitor_count' ];
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones', 'sources', 'bounce_rate', 'duration' ],
		];
	}

	/**
	 * Get watermark key for cursor pagination.
	 */
	protected function get_watermark_key(): string {
		return 'watermark_date';
	}

	/**
	 * Get query and arguments for estimation.
	 *
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_estimate_query(): array {
		$cutoff = Import_Manager::get_burst_tracking_start();
		return [
			'query' => "SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date FROM {$this->get_table()} WHERE date < %s",
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

		$last_date = (string) ( $state['watermark_date'] ?? '1970-01-01' );
		$batch_max = (int) ( $state['batch_size'] ?? 1000 );
		$cutoff    = Import_Manager::get_burst_tracking_start();

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols    = $wpdb->get_col( "SHOW COLUMNS FROM {$this->get_table()}" );
		$pv_col  = in_array( 'pageviews', $cols, true ) ? 'pageviews' : 'pageview_count';
		$vis_col = in_array( 'visitors', $cols, true ) ? 'visitors' : 'visitor_count';

		return [
			'query' => "SELECT date, {$pv_col} as pageview_count, {$vis_col} as visitor_count FROM {$this->get_table()} WHERE date > %s AND date < %s ORDER BY date ASC LIMIT %d",
			'args'  => [ $last_date, $cutoff['date'], $batch_max ],
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
			'date'        => (string) $row->date,
			'page_url'    => '/',
			'pageviews'   => max( 1, (int) ( $row->pageview_count ?? 1 ) ),
			'visitors'    => max( 1, (int) ( $row->visitor_count ?? 1 ) ),
			'duration'    => 30,
			'bounce_rate' => 0.0,
			'source'      => '',
			'device'      => 'desktop',
		];
	}
}
