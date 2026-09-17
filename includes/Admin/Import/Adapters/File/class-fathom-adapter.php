<?php
/**
 * Fathom Analytics CSV Adapter.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

defined( 'ABSPATH' ) || die();

/**
 * Class Fathom_Adapter
 *
 * Importer adapter for Fathom Analytics CSV report exports.
 */
class Fathom_Adapter extends Csv_File_Adapter {

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'fathom';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return 'Fathom Analytics';
	}

	/**
	 * Validate detected headers.
	 *
	 * @param array<int, string> $headers Lowercased header columns.
	 */
	protected function validate_headers( array $headers ): bool {
		return in_array( 'pageviews', $headers, true ) && ( in_array( 'uniques', $headers, true ) || in_array( 'visits', $headers, true ) );
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'duration', 'bounce_rate' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones', 'sources', 'devices' ],
		];
	}

	/**
	 * Map a raw CSV row into Burst synthesized event fields.
	 *
	 * @param array<int, string> $row Raw CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 * @return array<string, mixed>|null Synthesized event data or null if skipped.
	 */
	protected function map_row( array $row, array $header_map ): ?array {
		$date_val   = trim( $row[ $header_map['date'] ?? -1 ] ?? gmdate( 'Y-m-d' ) );
		$page_val   = $row[ $header_map['pathname'] ?? -1 ] ?? '/';
		$pageviews  = (int) ( $row[ $header_map['pageviews'] ?? -1 ] ?? 1 );
		$visitors   = (int) ( $row[ $header_map['uniques'] ?? -1 ] ?? 1 );
		$duration   = (int) ( $row[ $header_map['avg_duration'] ?? -1 ] ?? 30 );
		$bounce_raw = (float) ( $row[ $header_map['bounce_rate'] ?? -1 ] ?? 0.0 );
		// Normalize percentage to fraction (e.g. 75.2% -> 0.752).
		$bounce_rate = $bounce_raw > 1.0 ? ( $bounce_raw / 100.0 ) : $bounce_raw;

		return [
			'date'        => $date_val,
			'page_url'    => $page_val,
			'pageviews'   => $pageviews,
			'visitors'    => $visitors,
			'duration'    => $duration,
			'bounce_rate' => $bounce_rate,
			'source'      => '',
		];
	}
}
