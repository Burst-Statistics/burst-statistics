<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

use Burst\Traits\Database_Helper;
use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Database_Metrics
 */
class Database_Metrics {
	use Database_Helper;

	/**
	 * Collect database metrics
	 *
	 * @return array Database metrics
	 */
	public function collect(): array {
		// The referrers table is truncated weekly and only repopulated lazily on first
		// read from the filter UI, so without this trigger the count is almost always 0.
		burst_loader()->admin->app->maybe_populate_referrers_table();

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

		$table_suffix = $this->validate_table_name( $table_suffix );

		$count = $wpdb->get_var(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name cannot be parameterized, but it's controlled and sanitized within the method.
			"SELECT COUNT(*) FROM {$wpdb->prefix}{$table_suffix}",
		);

		return $count !== null ? (int) $count : 0;
	}
}
