<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Query_Stats_Metrics
 */
class Query_Stats_Metrics {

	/**
	 * Collect query performance statistics
	 */
	public function collect(): array {
		return $this->get_query_statistics();
	}

	/**
	 * Get query statistics from wp_burst_query_stats table
	 */
	private function get_query_statistics(): array {
		global $wpdb;

		$results = $wpdb->get_results(
			"SELECT 
                sql_query,
                avg_execution_time,
                max_execution_time,
                min_execution_time,
                execution_count,
                date_range_days
				FROM {$wpdb->prefix}burst_query_stats
            	ORDER BY avg_execution_time DESC
            	LIMIT 10",
			ARRAY_A
		);

		if ( empty( $results ) ) {
			return [];
		}

		return array_map(
			function ( $row ) {
				return [
					'sql_query'          => $this->sanitize_sql_query( $row['sql_query'] ),
					'avg_execution_time' => (float) $row['avg_execution_time'],
					'max_execution_time' => (float) $row['max_execution_time'],
					'min_execution_time' => (float) $row['min_execution_time'],
					'execution_count'    => (int) $row['execution_count'],
					'date_range_days'    => isset( $row['date_range_days'] ) ? (int) $row['date_range_days'] : 0,
				];
			},
			$results
		);
	}

	/**
	 * Sanitize SQL query string
	 * - Trim whitespace
	 * - Replace multiple spaces with single space
	 * - Limit to 2000 characters
	 *
	 * @param string $sql_query SQL query string.
	 * @return string Sanitized SQL query string.
	 */
	private function sanitize_sql_query( string $sql_query ): string {
		$sql_query = trim( $sql_query );

		$sql_query = preg_replace( '/\s+/', ' ', $sql_query );

		if ( strlen( $sql_query ) > 2000 ) {
			$sql_query = substr( $sql_query, 0, 2000 );
		}

		return $sql_query;
	}
}
