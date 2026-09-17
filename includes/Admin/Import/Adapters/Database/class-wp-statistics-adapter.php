<?php
/**
 * WP Statistics Database Adapter.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Manager;

defined( 'ABSPATH' ) || die();

/**
 * Class WP_Statistics_Adapter
 *
 * Importer adapter for WP Statistics local database tables.
 */
class WP_Statistics_Adapter extends Database_Adapter {

	/**
	 * Get adapter ID.
	 */
	public function get_id(): string {
		return 'wp_statistics';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'WP Statistics (Local Database)', 'burst-statistics' );
	}

	/**
	 * Get source table name.
	 */
	protected function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'statistics_visitor';
	}

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	protected function get_preview_headers(): array {
		return [ 'visitor', 'pages', 'referrers' ];
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'devices', 'browsers', 'referrers' ],
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
			'query' => "SELECT COUNT(*) as count, MIN(last_counter) as min_date, MAX(last_counter) as max_date FROM {$this->get_table()} WHERE last_counter < %s",
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
		$last_id   = (int) ( $state['watermark_id'] ?? 0 );
		$batch_max = (int) ( $state['batch_size'] ?? 1000 );
		$cutoff    = Import_Manager::get_burst_tracking_start();

		return [
			'query' => "SELECT ID, last_counter, referred, agent, platform, device, hits FROM {$this->get_table()} WHERE ID > %d AND last_counter < %s ORDER BY ID ASC LIMIT %d",
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
			'date'        => (string) $row->last_counter,
			'page_url'    => '/',
			'pageviews'   => max( 1, (int) ( $row->hits ?? 1 ) ),
			'visitors'    => 1,
			'duration'    => 30,
			'bounce_rate' => 0.0,
			'source'      => (string) ( $row->referred ?? '' ),
			'device'      => (string) ( $row->device ?? 'desktop' ),
			'browser'     => (string) ( $row->agent ?? '' ),
			'platform'    => (string) ( $row->platform ?? '' ),
		];
	}
}
