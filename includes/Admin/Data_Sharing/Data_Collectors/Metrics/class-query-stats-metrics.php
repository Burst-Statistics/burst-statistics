<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors\Metrics;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Query_Stats_Metrics
 */
class Query_Stats_Metrics {

	private int $capture_data_from;

	private int $capture_data_to;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
	}

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
			$wpdb->prepare(
				"SELECT 
                sql_query,
                avg_execution_time,
                max_execution_time,
                min_execution_time,
                execution_count
            FROM {$wpdb->prefix}burst_query_stats
            WHERE last_updated >= %d
            AND last_updated <= %d
            ORDER BY avg_execution_time DESC",
				$this->capture_data_from,
				$this->capture_data_to
			),
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
