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
	 * Rows at which Google Analytics cuts off a report or exploration export.
	 */
	private const EXPORT_ROW_LIMIT = 100000;

	/**
	 * Share of the export's own total the rows must add up to. Views add up
	 * exactly in a complete export; the margin only absorbs rounding by GA.
	 */
	private const MIN_TOTAL_COVERAGE = 0.99;

	/**
	 * Rows counted by the preview scan, including rows past the cutoff.
	 */
	private int $preview_rows = 0;

	/**
	 * Views in the rows counted by the preview scan.
	 */
	private int $preview_row_views = 0;

	/**
	 * Views according to the export's own total row.
	 */
	private int $preview_total_views = 0;

	/**
	 * Column labels as Google Analytics writes them, mapped to the API names.
	 *
	 * The GA interface exports its labels in the user's language. English is
	 * what we ask users to export in; Italian comes from a real customer export.
	 * A language that is not listed gets an error asking for an English export.
	 */
	private const HEADER_ALIASES = [
		'page path and screen class'                => 'pagepath',
		'page path + query string and screen class' => 'pagepath',
		'pagepathplusquerystring'                   => 'pagepath',
		'active users'                              => 'totalusers',
		'activeusers'                               => 'totalusers',
		'utenti attivi'                             => 'totalusers',
		'session source'                            => 'sessionsource',
		'views'                                     => 'screenpageviews',
		'total users'                               => 'totalusers',
		'average session duration'                  => 'averagesessionduration',
		'bounce rate'                               => 'bouncerate',
		'data'                                      => 'date',
		'percorso pagina e classe schermata'        => 'pagepath',
		'sorgente sessione'                         => 'sessionsource',
		'visualizzazioni'                           => 'screenpageviews',
		'sessioni'                                  => 'sessions',
		'totale utenti'                             => 'totalusers',
		'durata media della sessione'               => 'averagesessionduration',
		'frequenza di rimbalzo'                     => 'bouncerate',
	];

	/**
	 * Columns an import cannot do without, with the label to show when missing.
	 */
	private const REQUIRED_COLUMNS = [
		'date'            => 'Date',
		'pagepath'        => 'Page path and screen class',
		'screenpageviews' => 'Views',
	];

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
		return [] === $this->get_missing_columns( $headers );
	}

	/**
	 * Translate Google Analytics column labels to their API names.
	 *
	 * @param array<int, string> $row Raw header row.
	 * @return array<int, string> Normalized column names, in file order.
	 */
	protected function normalize_headers( array $row ): array {
		return array_map(
			static fn( string $header ): string => self::HEADER_ALIASES[ $header ] ?? $header,
			parent::normalize_headers( $row )
		);
	}

	/**
	 * Name the missing columns and how to get a file we can read.
	 *
	 * @param array<int, string> $headers Normalized header columns.
	 */
	protected function get_invalid_headers_message( array $headers ): string {
		return sprintf(
			/* translators: %s: comma-separated list of column names. */
			__( 'We could not find these columns: %s. Add them to your Google Analytics export. If Google Analytics is not in English, switch it to English first. Then upload the new file.', 'burst-statistics' ),
			implode( ', ', $this->get_missing_columns( $headers ) )
		);
	}

	/**
	 * Parse preview information and flag an export that was cut off.
	 *
	 * @param string $file_path File path.
	 * @return array{
	 *     valid: bool,
	 *     headers_detected: string[],
	 *     date_range: array{start: string, end: string},
	 *     estimated_rows: int,
	 *     error_message?: string,
	 *     warning?: string
	 * }
	 */
	public function parse_preview( string $file_path ): array {
		$this->preview_rows        = 0;
		$this->preview_row_views   = 0;
		$this->preview_total_views = 0;

		$preview = parent::parse_preview( $file_path );

		if ( ! empty( $preview['valid'] ) && $this->is_export_truncated() ) {
			$preview['warning'] = __( 'This export looks incomplete: Google Analytics cut it off, so the imported numbers will be too low. For complete data, export shorter periods and import them one by one.', 'burst-statistics' );
		}

		return $preview;
	}

	/**
	 * Get the labels of the required columns a file does not have.
	 *
	 * @param array<int, string> $headers Normalized header columns.
	 * @return array<int, string> Column labels.
	 */
	private function get_missing_columns( array $headers ): array {
		$missing = array_values( array_diff_key( self::REQUIRED_COLUMNS, array_flip( $headers ) ) );

		// Without users or sessions, all views of a row would land in one visit.
		if ( ! in_array( 'totalusers', $headers, true ) && ! in_array( 'sessions', $headers, true ) ) {
			$missing[] = 'Total users';
		}

		return $missing;
	}

	/**
	 * Add up the rows and read the total row while the preview scans the file.
	 *
	 * @param array<int, string|null> $row CSV row.
	 * @param array<string, int>      $header_map Column name to index map.
	 */
	protected function inspect_preview_row( array $row, array $header_map ): void {
		$views = (int) ( $row[ $header_map['screenpageviews'] ?? -1 ] ?? 0 );

		if ( $this->is_data_row( $row, $header_map ) ) {
			++$this->preview_rows;
			$this->preview_row_views += $views;
			return;
		}

		// The total row is the only row with views but no date, except a comment.
		if ( ! str_starts_with( trim( $row[0] ?? '' ), '#' ) ) {
			$this->preview_total_views = max( $this->preview_total_views, $views );
		}
	}

	/**
	 * Check whether Google Analytics cut off the export the preview just scanned.
	 *
	 * An export stops at the row limit, and an exploration's total row counts
	 * the rows that fell off, so its views then exceed the sum of the rows.
	 */
	private function is_export_truncated(): bool {
		return $this->preview_rows >= self::EXPORT_ROW_LIMIT
			|| $this->preview_row_views < $this->preview_total_views * self::MIN_TOTAL_COVERAGE;
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
		// Explorations have a free column order, so a column is only ever read
		// by name: a position would silently load another metric into this one.
		$cell = static fn( string $column, string $fallback ): string => (string) ( $row[ $header_map[ $column ] ?? -1 ] ?? $fallback );

		return [
			'date'        => $this->extract_row_date( $row, $header_map ),
			'page_url'    => $cell( 'pagepath', '/' ),
			'pageviews'   => (int) $cell( 'screenpageviews', '1' ),
			'sessions'    => (int) $cell( 'sessions', '1' ),
			'visitors'    => (int) $cell( 'totalusers', $cell( 'sessions', '1' ) ),
			'duration'    => (int) $cell( 'averagesessionduration', '30' ),
			'bounce_rate' => (float) $cell( 'bouncerate', '0' ),
			'source'      => $cell( 'sessionsource', '' ),
		];
	}
}
