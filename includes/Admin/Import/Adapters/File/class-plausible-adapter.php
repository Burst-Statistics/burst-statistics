<?php
/**
 * Plausible Analytics CSV/ZIP Adapter.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

use ZipArchive;

defined( 'ABSPATH' ) || die();

/**
 * Class Plausible_Adapter
 *
 * Importer adapter for Plausible Analytics ZIP/CSV exports.
 */
class Plausible_Adapter extends Csv_File_Adapter {

	/**
	 * Get adapter identifier.
	 */
	public function get_id(): string {
		return 'plausible';
	}

	/**
	 * Get adapter display name.
	 */
	public function get_name(): string {
		return 'Plausible Analytics';
	}

	/**
	 * Validate detected headers.
	 *
	 * @param array<int, string> $headers Lowercased header columns.
	 */
	protected function validate_headers( array $headers ): bool {
		return in_array( 'pageviews', $headers, true ) || in_array( 'visitors', $headers, true );
	}

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	protected function get_metrics(): array {
		return [
			'included' => [ 'pageviews', 'visitors', 'duration' ],
			'excluded' => [ 'scroll_depth', 'dwell_zones', 'bounce_rate', 'sources' ],
		];
	}

	/**
	 * Resolve actual CSV file path (e.g. unzipping archives if necessary).
	 *
	 * @param string $file_path Uploaded file path.
	 */
	protected function get_csv_file_path( string $file_path ): string {
		$target_csv = $file_path;
		$is_zip     = str_ends_with( strtolower( $file_path ), '.zip' );

		if ( $is_zip && class_exists( 'ZipArchive' ) ) {
			$zip = new ZipArchive();
			if ( true === $zip->open( $file_path ) ) {
				$extract_dir = dirname( $file_path ) . '/plausible_unpacked';
				wp_mkdir_p( $extract_dir );
				$zip->extractTo( $extract_dir );
				$zip->close();

				if ( file_exists( $extract_dir . '/imported_pages.csv' ) ) {
					$target_csv = $extract_dir . '/imported_pages.csv';
				} elseif ( file_exists( $extract_dir . '/imported_visitors.csv' ) ) {
					$target_csv = $extract_dir . '/imported_visitors.csv';
				}
			}
		}

		return $target_csv;
	}

	/**
	 * Map a raw CSV row into Burst synthesized event fields.
	 *
	 * @param array<int, string> $row Raw CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 * @return array<string, mixed>|null Synthesized event data or null if skipped.
	 */
	protected function map_row( array $row, array $header_map ): ?array {
		$row_date  = trim( $row[ $header_map['date'] ?? 0 ] ?? '' );
		$page_val  = $row[ $header_map['page'] ?? -1 ] ?? '/';
		$pageviews = (int) ( $row[ $header_map['pageviews'] ?? -1 ] ?? 1 );
		$visitors  = (int) ( $row[ $header_map['visitors'] ?? -1 ] ?? 1 );
		$duration  = (int) ( $row[ $header_map['visit_duration'] ?? -1 ] ?? 30 );

		return [
			'date'        => $row_date,
			'page_url'    => $page_val,
			'pageviews'   => $pageviews,
			'visitors'    => $visitors,
			'duration'    => $duration,
			'bounce_rate' => 0.0,
			'source'      => '',
		];
	}
}
