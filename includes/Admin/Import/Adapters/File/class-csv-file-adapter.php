<?php
/**
 * Base Abstract CSV File Importer Adapter.
 *
 * Provides common file detection, preview scanning, fgetcsv batch cursor loop,
 * and estimation logic for CSV/ZIP export files. Subclasses declare header
 * validation, metrics, and row mapping.
 *
 * @package Burst\Admin\Import\Adapters\File
 */

namespace Burst\Admin\Import\Adapters\File;

use Burst\Admin\Import\Import_Manager;
use Burst\Admin\Import\Import_Runner;
use Burst\Admin\Import\Interfaces\Import_Adapter;
use Burst\Admin\Import\Helpers\Event_Synthesizer;
use Burst\Traits\Admin_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Csv_File_Adapter
 */
abstract class Csv_File_Adapter implements Import_Adapter {
	use Admin_Helper;

	/**
	 * Event synthesizer instance.
	 */
	protected Event_Synthesizer $synthesizer;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->synthesizer = new Event_Synthesizer();
	}

	/**
	 * Get adapter type.
	 */
	public function get_type(): string {
		return 'upload';
	}

	/**
	 * Validate detected headers.
	 *
	 * @param array<int, string> $headers Lowercased header columns.
	 */
	abstract protected function validate_headers( array $headers ): bool;

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	abstract protected function get_metrics(): array;

	/**
	 * Map a raw CSV row into Burst synthesized event fields.
	 *
	 * @param array<int, string> $row Raw CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 * @return array<string, mixed>|null Synthesized event data or null if skipped.
	 */
	abstract protected function map_row( array $row, array $header_map ): ?array;

	/**
	 * Resolve actual CSV file path (e.g. unzipping archives if necessary).
	 *
	 * @param string $file_path Uploaded file path.
	 */
	protected function get_csv_file_path( string $file_path ): string {
		return $file_path;
	}

	/**
	 * Normalize cutoff date comparison value for this adapter.
	 * GA4 overrides to return YYYYMMDD without hyphens.
	 *
	 * @param array{date: string, timestamp: int} $cutoff Cutoff configuration.
	 */
	protected function get_cutoff_date( array $cutoff ): string {
		return (string) ( $cutoff['date'] ?? '' );
	}

	/**
	 * Extract date string from raw CSV row for cutoff check during batch execution.
	 *
	 * @param array<int, string> $row CSV row.
	 * @param array<string, int> $header_map Column name to index map.
	 */
	protected function extract_row_date( array $row, array $header_map ): string {
		return trim( (string) ( $row[ $header_map['date'] ?? -1 ] ?? gmdate( 'Y-m-d' ) ) );
	}

	/**
	 * Check if a row date meets or exceeds the cutoff boundary.
	 *
	 * @param string                              $date_val Extracted date string.
	 * @param array{date: string, timestamp: int} $cutoff Cutoff configuration.
	 */
	protected function is_row_past_cutoff( string $date_val, array $cutoff ): bool {
		$cutoff_date = $this->get_cutoff_date( $cutoff );
		return ! empty( $cutoff_date ) && $date_val >= $cutoff_date;
	}

	/**
	 * Detect if adapter is relevant for file.
	 *
	 * @param string|null $file_path Optional file path.
	 */
	public function detect( ?string $file_path = null ): bool {
		if ( null === $file_path || '' === $file_path ) {
			return false;
		}
		$ext = strtolower( pathinfo( $file_path, PATHINFO_EXTENSION ) );
		return in_array( $ext, [ 'csv', 'zip', 'tmp' ], true );
	}

	/**
	 * Estimate record count and date ranges.
	 *
	 * @param string|null $file_path Optional file path.
	 * @return array{
	 *     total_records: int,
	 *     date_start: string,
	 *     date_end: string,
	 *     metrics_included: string[],
	 *     metrics_excluded: string[]
	 * }
	 */
	public function estimate( ?string $file_path = null ): array {
		$metrics = $this->get_metrics();
		if ( null === $file_path || '' === $file_path || ! file_exists( $file_path ) ) {
			return [
				'total_records'    => 0,
				'date_start'       => '',
				'date_end'         => '',
				'metrics_included' => $metrics['included'] ?? [],
				'metrics_excluded' => $metrics['excluded'] ?? [],
			];
		}

		$preview = $this->parse_preview( $file_path );

		return [
			'total_records'    => $preview['estimated_rows'],
			'date_start'       => $preview['date_range']['start'] ?? '',
			'date_end'         => $preview['date_range']['end'] ?? '',
			'metrics_included' => $metrics['included'] ?? [],
			'metrics_excluded' => $metrics['excluded'] ?? [],
		];
	}

	/**
	 * Parse preview information from CSV export.
	 *
	 * @param string $file_path File path.
	 * @return array{
	 *     valid: bool,
	 *     headers_detected: string[],
	 *     date_range: array{start: string, end: string},
	 *     estimated_rows: int,
	 *     error_message?: string
	 * }
	 */
	public function parse_preview( string $file_path ): array {
		if ( ! file_exists( $file_path ) ) {
			return [
				'valid'            => false,
				'headers_detected' => [],
				'date_range'       => [
					'start' => '',
					'end'   => '',
				],
				'estimated_rows'   => 0,
				'error_message'    => __( 'Export file not found.', 'burst-statistics' ),
			];
		}

		$target_csv = $this->get_csv_file_path( $file_path );
		if ( ! file_exists( $target_csv ) ) {
			return [
				'valid'            => false,
				'headers_detected' => [],
				'date_range'       => [
					'start' => '',
					'end'   => '',
				],
				'estimated_rows'   => 0,
				'error_message'    => __( 'Export file not found.', 'burst-statistics' ),
			];
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $target_csv, 'r' );
		if ( false === $handle ) {
			return [
				'valid'            => false,
				'headers_detected' => [],
				'date_range'       => [
					'start' => '',
					'end'   => '',
				],
				'estimated_rows'   => 0,
				'error_message'    => __( 'Unable to read export file.', 'burst-statistics' ),
			];
		}

		$header_row = [];
		$row_count  = 0;
		$first_date = '';
		$last_date  = '';
		$cutoff     = Import_Manager::get_burst_tracking_start();

		while ( ! feof( $handle ) ) {
			$row = fgetcsv( $handle, 4096, ',', '"', '\\' );
			if ( false === $row ) {
				break;
			}
			$first_val = trim( $row[0] ?? '' );
			if ( '' === $first_val || str_starts_with( $first_val, '#' ) ) {
				continue;
			}

			if ( empty( $header_row ) ) {
				$header_row = array_map( 'trim', $row );
				continue;
			}

			if ( $this->is_row_past_cutoff( $first_val, $cutoff ) ) {
				continue;
			}

			++$row_count;
			if ( '' === $first_date ) {
				$first_date = $first_val;
			}
			$last_date = $first_val;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		$lowered  = array_map( 'strtolower', $header_row );
		$is_valid = $this->validate_headers( $lowered );

		return [
			'valid'            => $is_valid,
			'headers_detected' => $header_row,
			'date_range'       => [
				'start' => $first_date,
				'end'   => $last_date,
			],
			'estimated_rows'   => $row_count,
		];
	}

	/**
	 * Import a batch of rows from CSV export.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $state Current state.
	 * @return array<string, mixed>
	 */
	public function import_batch( int $import_id, array $state ): array {
		$raw_path  = (string) ( $state['file_path'] ?? '' );
		$phase     = (string) ( $state['phase'] ?? '' );
		$offset    = (int) ( $state['offset'] ?? 0 );
		$batch_max = (int) ( $state['batch_size'] ?? 1000 );

		// Resolve the CSV path once and cache it in state, so a .zip archive is
		// extracted a single time instead of on every chunk. Extraction of a
		// large archive is announced as a 'preparing' step first, so the UI shows
		// feedback instead of sitting at 0% during the (blocking) extraction.
		$file_path = (string) ( $state['working_csv'] ?? '' );
		if ( '' === $file_path || ! file_exists( $file_path ) ) {
			$is_archive = str_ends_with( strtolower( $raw_path ), '.zip' );
			if ( $is_archive && 'preparing' !== $phase ) {
				$state['phase']         = 'preparing';
				$state['status']        = 'processing';
				$state['current_table'] = __( 'Preparing import (extracting archive)…', 'burst-statistics' );
				return $state;
			}

			$file_path = $this->get_csv_file_path( $raw_path );
			if ( ! file_exists( $file_path ) ) {
				$state['status']        = 'failed';
				$state['error_message'] = __( 'Data file missing during batch execution.', 'burst-statistics' );
				return $state;
			}
			$state['working_csv'] = $file_path;
		}

		// Extraction done; clear the preparing marker so normal progress applies.
		if ( 'preparing' === ( $state['phase'] ?? '' ) ) {
			unset( $state['phase'] );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$handle = fopen( $file_path, 'r' );
		if ( false === $handle ) {
			$state['status']        = 'failed';
			$state['error_message'] = __( 'Could not open data file.', 'burst-statistics' );
			return $state;
		}

		// Always parse header row from beginning of file first.
		rewind( $handle );
		$header_row = [];
		$header_map = [];

		while ( ! feof( $handle ) ) {
			$row = fgetcsv( $handle, 4096, ',', '"', '\\' );
			if ( false === $row ) {
				break;
			}
			$first_val = trim( $row[0] ?? '' );
			if ( '' === $first_val || str_starts_with( $first_val, '#' ) ) {
				continue;
			}

			$header_row = array_map( 'strtolower', array_map( 'trim', $row ) );
			$header_map = array_flip( $header_row );
			break;
		}

		if ( empty( $header_map ) || ! $this->validate_headers( $header_row ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $handle );
			$state['status']        = 'failed';
			$state['error_message'] = __( 'Invalid or empty CSV header in export file.', 'burst-statistics' );
			return $state;
		}

		$state['header_map'] = $header_map;

		if ( 0 < $offset ) {
			fseek( $handle, $offset, SEEK_SET );
		}

		$processed   = 0;
		$total_views = 0;
		$cutoff      = Import_Manager::get_burst_tracking_start();

		// Both the wall-clock budget and the synthesized-row budget bound one
		// iteration; a row too large for the remaining budget is continued on
		// the next iteration from 'row_cursor' (visitors already emitted), with
		// the file offset parked at the start of that row.
		$deadline     = microtime( true ) + Import_Runner::get_chunk_time_budget();
		$event_budget = Event_Synthesizer::get_max_events_per_iteration();
		$events_used  = 0;
		$row_cursor   = (int) ( $state['row_cursor'] ?? 0 );
		$row_pending  = false;
		$new_offset   = (int) ftell( $handle );

		while ( ! feof( $handle ) ) {
			$row_start = (int) ftell( $handle );
			$row       = fgetcsv( $handle, 4096, ',', '"', '\\' );
			if ( false === $row ) {
				break;
			}
			$first_val = trim( $row[0] ?? '' );
			if ( '' === $first_val || str_starts_with( $first_val, '#' ) ) {
				$new_offset = (int) ftell( $handle );
				continue;
			}

			$date_val = $this->extract_row_date( $row, $header_map );
			if ( $this->is_row_past_cutoff( $date_val, $cutoff ) ) {
				$new_offset = (int) ftell( $handle );
				continue;
			}

			$row_data = $this->map_row( $row, $header_map );
			if ( ! empty( $row_data ) ) {
				$slice        = $this->synthesizer->synthesize_slice( $import_id, $row_data, $row_cursor, $event_budget - $events_used );
				$total_views += $slice['pageviews'];
				$events_used += $slice['events'];

				if ( ! $slice['done'] ) {
					$row_cursor  = $slice['cursor'];
					$row_pending = true;
					$new_offset  = $row_start;
					break;
				}
			}

			$row_cursor = 0;
			$new_offset = (int) ftell( $handle );
			++$processed;

			if ( $processed >= $batch_max || $events_used >= $event_budget || microtime( true ) >= $deadline ) {
				break;
			}
		}

		$is_eof = feof( $handle );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		$state['offset']              = $new_offset;
		$state['row_cursor']          = $row_cursor;
		$state['rows_processed']      = ( $state['rows_processed'] ?? 0 ) + $processed;
		$state['pageviews_processed'] = ( $state['pageviews_processed'] ?? 0 ) + $total_views;

		if ( ! $row_pending && ( $is_eof || 0 === $processed ) ) {
			$state['status'] = 'completed';
		} else {
			$state['status'] = 'processing';
		}

		return $state;
	}
}
