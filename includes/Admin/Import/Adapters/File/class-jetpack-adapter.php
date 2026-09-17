<?php
/**
 * Jetpack Stats CSV Adapter.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

defined( 'ABSPATH' ) || die();

/**
 * Class Jetpack_Adapter
 *
 * Importer adapter for Jetpack Stats (WordPress.com) CSV exports.
 */
class Jetpack_Adapter extends Csv_File_Adapter {

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'jetpack';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return 'Jetpack Stats';
	}

	/**
	 * Validate detected headers.
	 *
	 * @param array<int, string> $headers Lowercased header columns.
	 */
	protected function validate_headers( array $headers ): bool {
		return in_array( 'views', $headers, true ) || in_array( 'pageviews', $headers, true );
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
	 * Map a raw CSV row into Burst synthesized event fields.
	 *
	 * @param array<int, string> $row Raw CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 * @return array<string, mixed>|null Synthesized event data or null if skipped.
	 */
	protected function map_row( array $row, array $header_map ): ?array {
		$date_val  = trim( $row[ $header_map['date'] ?? -1 ] ?? gmdate( 'Y-m-d' ) );
		$page_val  = $row[ $header_map['post_title'] ?? ( $header_map['page'] ?? -1 ) ] ?? '/';
		$pageviews = (int) ( $row[ $header_map['views'] ?? ( $header_map['pageviews'] ?? -1 ) ] ?? 1 );
		$visitors  = (int) ( $row[ $header_map['visitors'] ?? -1 ] ?? max( 1, (int) round( $pageviews * 0.7 ) ) );

		return [
			'date'        => $date_val,
			'page_url'    => $page_val,
			'pageviews'   => max( 1, $pageviews ),
			'visitors'    => max( 1, $visitors ),
			'duration'    => 30,
			'bounce_rate' => 0.0,
			'source'      => '',
		];
	}
}
