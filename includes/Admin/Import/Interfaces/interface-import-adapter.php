<?php
namespace Burst\Admin\Import\Interfaces;

defined( 'ABSPATH' ) || die();

/**
 * Interface Import_Adapter
 *
 * Defines the contract for all external analytics data import adapters.
 */
interface Import_Adapter {

	/**
	 * Unique adapter identifier.
	 */
	public function get_id(): string;

	/**
	 * Human-readable adapter display name.
	 */
	public function get_name(): string;

	/**
	 * Source type: 'database' | 'upload'.
	 */
	public function get_type(): string;

	/**
	 * Detect whether this source is present and available.
	 *
	 * @param string|null $file_path Optional file path.
	 */
	public function detect( ?string $file_path = null ): bool;

	/**
	 * Estimate total records, date range, and metrics available for import.
	 *
	 * @param string|null $file_path Optional file path for file adapters.
	 * @return array{
	 *     total_records: int,
	 *     date_start: string,
	 *     date_end: string,
	 *     metrics_included: string[],
	 *     metrics_excluded: string[]
	 * }
	 */
	public function estimate( ?string $file_path = null ): array;

	/**
	 * Parse file header and return mapping preview summary.
	 *
	 * @param string $file_path Path to uploaded export file.
	 * @return array{
	 *     valid: bool,
	 *     headers_detected: string[],
	 *     date_range: array{start: string, end: string},
	 *     estimated_rows: int,
	 *     error_message?: string
	 * }
	 */
	public function parse_preview( string $file_path ): array;

	/**
	 * Process a single batch chunk of data.
	 *
	 * @param int                  $import_id Registry record ID.
	 * @param array<string, mixed> $state Current batch cursor state.
	 * @return array<string, mixed> Updated state array with 'status' => 'processing'|'completed'|'failed'.
	 */
	public function import_batch( int $import_id, array $state ): array;
}
