<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Database_Metrics
 */
class Database_Metrics {
	/**
	 * Collect database metrics
	 *
	 * @return array Database metrics
	 */
	public function collect(): array {
		return [
			'statistics_table_rows' => $this->get_table_row_count( 'burst_statistics' ),
			'referrers_table_rows'  => $this->get_table_row_count( 'burst_referrers' ),
			'sessions_table_rows'   => $this->get_table_row_count( 'burst_sessions' ),
		];
	}

	/**
	 * Get row count for a specific table within the date range
	 *
	 * @param string $table_suffix Table name without prefix.
	 * @return int Row count
	 */
	private function get_table_row_count( string $table_suffix ): int {
		global $wpdb;

		$table_suffix = esc_sql( $table_suffix );

		$count = $wpdb->get_var(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name cannot be parameterized, but it's controlled and sanitized within the method.
			"SELECT COUNT(*) FROM {$wpdb->prefix}{$table_suffix}",
		);

		return $count !== null ? (int) $count : 0;
	}
}
