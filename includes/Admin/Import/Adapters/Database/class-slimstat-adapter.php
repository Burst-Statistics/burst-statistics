<?php
/**
 * Slimstat Database Adapter.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Manager;

defined( 'ABSPATH' ) || die();

/**
 * Class Slimstat_Adapter
 *
 * Importer adapter for Slimstat Analytics local database tables.
 */
class Slimstat_Adapter extends Database_Adapter {

	/**
	 * Get adapter ID.
	 */
	public function get_id(): string {
		return 'slimstat';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'Slimstat Analytics (Local Database)', 'burst-statistics' );
	}

	/**
	 * Get source table name.
	 */
	protected function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'slim_stats';
	}

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	protected function get_preview_headers(): array {
		return [ 'id', 'dt', 'referer', 'resource', 'browser', 'platform' ];
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'sessions', 'referrers', 'devices', 'browsers', 'duration' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones' ],
		];
	}

	/**
	 * Get query and arguments for estimation.
	 *
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_estimate_query(): array {
		$cutoff = Import_Manager::get_burst_tracking_start();
		return [
			'query' => "SELECT COUNT(*) as count, MIN(dt) as min_ts, MAX(dt) as max_ts FROM {$this->get_table()} WHERE dt < %d",
			'args'  => [ $cutoff['timestamp'] ],
		];
	}

	/**
	 * Get SQL query and arguments for fetching a batch of rows.
	 *
	 * @param array<string, mixed> $state Current import state.
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_batch_query( array $state ): array {
		$last_id   = (int) ( $state['watermark_id'] ?? 0 );
		$batch_max = (int) ( $state['batch_size'] ?? 1000 );
		$cutoff    = Import_Manager::get_burst_tracking_start();

		return [
			'query' => "SELECT id, dt, dt_out, referer, resource, browser, platform FROM {$this->get_table()} WHERE id > %d AND dt < %d ORDER BY id ASC LIMIT %d",
			'args'  => [ $last_id, $cutoff['timestamp'], $batch_max ],
		];
	}

	/**
	 * Map a raw database row into Burst synthesized event fields.
	 *
	 * @param object $row Database row object.
	 * @return array<string, mixed>
	 */
	protected function map_row( object $row ): array {
		$duration = ! empty( $row->dt_out ) && (int) $row->dt_out > (int) $row->dt ? (int) $row->dt_out - (int) $row->dt : 30;

		return [
			'date'        => gmdate( 'Y-m-d', (int) $row->dt ),
			'page_url'    => (string) ( $row->resource ?? '/' ),
			'pageviews'   => 1,
			'visitors'    => 1,
			'duration'    => $duration,
			'bounce_rate' => 0.0,
			'source'      => (string) ( $row->referer ?? '' ),
			'device'      => 'desktop',
			'browser'     => (string) ( $row->browser ?? '' ),
			'platform'    => (string) ( $row->platform ?? '' ),
		];
	}
}
