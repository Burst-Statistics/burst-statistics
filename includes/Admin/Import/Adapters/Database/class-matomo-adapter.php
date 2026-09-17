<?php
/**
 * Matomo Database Adapter.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Manager;

defined( 'ABSPATH' ) || die();

/**
 * Class Matomo_Adapter
 *
 * Importer adapter for Matomo for WordPress local database tables.
 */
class Matomo_Adapter extends Database_Adapter {

	/**
	 * Get adapter ID.
	 */
	public function get_id(): string {
		return 'matomo';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return __( 'Matomo for WordPress (Local Database)', 'burst-statistics' );
	}

	/**
	 * Get source table name.
	 */
	protected function get_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'matomo_log_visit';
	}

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	protected function get_preview_headers(): array {
		return [ 'idvisit', 'visitor_id', 'visit_first_action_time', 'referer_url' ];
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'sessions', 'duration', 'bounce_rate', 'referrers', 'devices' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones' ],
		];
	}

	/**
	 * Get query and arguments for estimation.
	 *
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_estimate_query(): array {
		$cutoff          = Import_Manager::get_burst_tracking_start();
		$cutoff_datetime = $cutoff['date'] . ' 00:00:00';

		return [
			'query' => "SELECT COUNT(*) as count, MIN(visit_first_action_time) as min_date, MAX(visit_first_action_time) as max_date FROM {$this->get_table()} WHERE visit_first_action_time < %s",
			'args'  => [ $cutoff_datetime ],
		];
	}

	/**
	 * Get SQL query and arguments for fetching a batch of rows.
	 *
	 * @param array<string, mixed> $state Current import state.
	 * @return array{query: string, args: array<int, mixed>}
	 */
	protected function get_batch_query( array $state ): array {
		$last_id         = (int) ( $state['watermark_id'] ?? 0 );
		$batch_max       = (int) ( $state['batch_size'] ?? 1000 );
		$cutoff          = Import_Manager::get_burst_tracking_start();
		$cutoff_datetime = $cutoff['date'] . ' 00:00:00';

		return [
			'query' => "SELECT idvisit, visit_first_action_time, visit_total_time, visit_total_actions, referer_name, config_device_type FROM {$this->get_table()} WHERE idvisit > %d AND visit_first_action_time < %s ORDER BY idvisit ASC LIMIT %d",
			'args'  => [ $last_id, $cutoff_datetime, $batch_max ],
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
			'date'        => (string) $row->visit_first_action_time,
			'page_url'    => '/',
			'pageviews'   => max( 1, (int) ( $row->visit_total_actions ?? 1 ) ),
			'visitors'    => 1,
			'duration'    => (int) ( $row->visit_total_time ?? 30 ),
			'bounce_rate' => 1 === (int) ( $row->visit_total_actions ?? 1 ) ? 1.0 : 0.0,
			'source'      => (string) ( $row->referer_name ?? '' ),
			'device'      => (string) ( $row->config_device_type ?? 'desktop' ),
		];
	}
}
