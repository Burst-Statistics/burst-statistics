<?php
/**
 * GA4 CSV Adapter.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

defined( 'ABSPATH' ) || die();

/**
 * Class GA4_Csv_Adapter
 *
 * Importer adapter for Google Analytics 4 CSV report exports.
 */
class GA4_Csv_Adapter extends Csv_File_Adapter {

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'ga4_csv';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return 'Google Analytics 4 (CSV / ZIP)';
	}

	/**
	 * Validate detected headers.
	 *
	 * @param array<int, string> $headers Lowercased header columns.
	 */
	protected function validate_headers( array $headers ): bool {
		return in_array( 'date', $headers, true ) && ( in_array( 'screenpageviews', $headers, true ) || in_array( 'sessions', $headers, true ) );
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'sessions', 'visitors', 'sources', 'bounce_rate', 'duration' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones' ],
		];
	}

	/**
	 * Normalize cutoff date comparison value for GA4 (YYYYMMDD).
	 *
	 * @param array{date: string, timestamp: int} $cutoff Cutoff configuration.
	 */
	protected function get_cutoff_date( array $cutoff ): string {
		return str_replace( '-', '', (string) ( $cutoff['date'] ?? '' ) );
	}

	/**
	 * Check if a row date meets or exceeds the cutoff boundary.
	 *
	 * @param string                              $date_val Extracted date string.
	 * @param array{date: string, timestamp: int} $cutoff Cutoff configuration.
	 */
	protected function is_row_past_cutoff( string $date_val, array $cutoff ): bool {
		$clean_date = str_replace( '-', '', $date_val );
		$cutoff_ga4 = $this->get_cutoff_date( $cutoff );
		return ! empty( $cutoff_ga4 ) && $clean_date >= $cutoff_ga4;
	}

	/**
	 * Extract date string from raw CSV row.
	 *
	 * @param array<int, string> $row CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 */
	protected function extract_row_date( array $row, array $header_map ): string {
		return trim( (string) ( $row[ $header_map['date'] ?? 0 ] ?? '' ) );
	}

	/**
	 * Map a raw CSV row into Burst synthesized event fields.
	 *
	 * @param array<int, string> $row Raw CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 * @return array<string, mixed>|null Synthesized event data or null if skipped.
	 */
	protected function map_row( array $row, array $header_map ): ?array {
		$row_date = trim( (string) ( $row[ $header_map['date'] ?? 0 ] ?? '' ) );

		return [
			'date'        => $row_date,
			'page_url'    => (string) ( $row[ $header_map['pagepath'] ?? 1 ] ?? '/' ),
			'pageviews'   => (int) ( $row[ $header_map['screenpageviews'] ?? 2 ] ?? 1 ),
			'sessions'    => (int) ( $row[ $header_map['sessions'] ?? 3 ] ?? 1 ),
			'visitors'    => (int) ( $row[ $header_map['totalusers'] ?? 4 ] ?? 1 ),
			'duration'    => (int) ( $row[ $header_map['averagesessionduration'] ?? 6 ] ?? 30 ),
			'bounce_rate' => (float) ( $row[ $header_map['bouncerate'] ?? 7 ] ?? 0.0 ),
			'source'      => (string) ( $row[ $header_map['sessionsource'] ?? 8 ] ?? '' ),
		];
	}
}
