<?php
/**
 * Base Abstract Database Importer Adapter.
 *
 * Provides common table detection, estimation, preview parsing, and batch loop
 * execution for local database table imports. Subclasses declare table name,
 * batch query, and row mapping.
 *
 * @package Burst\Admin\Import\Adapters\Database
 */

namespace Burst\Admin\Import\Adapters\Database;

use Burst\Admin\Import\Import_Runner;
use Burst\Admin\Import\Interfaces\Import_Adapter;
use Burst\Admin\Import\Helpers\Event_Synthesizer;
use Burst\Traits\Admin_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Database_Adapter
 */
abstract class Database_Adapter implements Import_Adapter {
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
	 * Get adapter source type.
	 */
	public function get_type(): string {
		return 'database';
	}

	/**
	 * Get source table name (including prefix).
	 */
	abstract protected function get_table(): string;

	/**
	 * Get preview headers detected for UI display.
	 *
	 * @return array<int, string>
	 */
	abstract protected function get_preview_headers(): array;

	/**
	 * Get metrics included and excluded by this adapter.
	 *
	 * @return array{included: array<int, string>, excluded: array<int, string>}
	 */
	abstract protected function get_metrics(): array;

	/**
	 * Get SQL query and arguments for fetching a batch of rows.
	 *
	 * @param array<string, mixed> $state Current import state.
	 * @return array{query: string, args: array<int, mixed>}
	 */
	abstract protected function get_batch_query( array $state ): array;

	/**
	 * Map a raw database row into Burst synthesized event fields.
	 *
	 * @param object $row Database row object.
	 * @return array<string, mixed>
	 */
	abstract protected function map_row( object $row ): array;

	/**
	 * Get query and arguments for estimation.
	 *
	 * @return array{query: string, args: array<int, mixed>}
	 */
	abstract protected function get_estimate_query(): array;

	/**
	 * Get the state watermark key used for cursor pagination.
	 * Defaults to 'watermark_id'. Koko overrides with 'watermark_date'.
	 */
	protected function get_watermark_key(): string {
		return 'watermark_id';
	}

	/**
	 * Extract watermark value from a database row.
	 *
	 * @param object $row Database row object.
	 */
	protected function get_row_watermark( object $row ): int|string {
		if ( isset( $row->id ) ) {
			return (int) $row->id;
		}
		if ( isset( $row->ID ) ) {
			return (int) $row->ID;
		}
		if ( isset( $row->idvisit ) ) {
			return (int) $row->idvisit;
		}
		if ( isset( $row->date ) ) {
			return (string) $row->date;
		}
		return 0;
	}

	/**
	 * Detect if source tables are present.
	 *
	 * @param string|null $file_path Optional file path.
	 */
	public function detect( ?string $file_path = null ): bool {
		global $wpdb;
		unset( $file_path );
		$table = $this->get_table();
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
	}

	/**
	 * Parse preview data for the UI.
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
		unset( $file_path );
		$estimate = $this->estimate();
		return [
			'valid'            => $this->detect(),
			'headers_detected' => $this->get_preview_headers(),
			'date_range'       => [
				'start' => $estimate['date_start'],
				'end'   => $estimate['date_end'],
			],
			'estimated_rows'   => $estimate['total_records'],
		];
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
		global $wpdb;
		unset( $file_path );

		$metrics = $this->get_metrics();
		if ( ! $this->detect() ) {
			return [
				'total_records'    => 0,
				'date_start'       => '',
				'date_end'         => '',
				'metrics_included' => $metrics['included'] ?? [],
				'metrics_excluded' => $metrics['excluded'] ?? [],
			];
		}

		$est_info = $this->get_estimate_query();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$row = ! empty( $est_info['args'] )
			? $wpdb->get_row( $wpdb->prepare( $est_info['query'], ...$est_info['args'] ) )
			: $wpdb->get_row( $est_info['query'] );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		$min_date = '';
		if ( ! empty( $row->min_date ) ) {
			$min_date = (string) $row->min_date;
		} elseif ( ! empty( $row->min_ts ) ) {
			$min_date = gmdate( 'Y-m-d', (int) $row->min_ts );
		}

		$max_date = '';
		if ( ! empty( $row->max_date ) ) {
			$max_date = (string) $row->max_date;
		} elseif ( ! empty( $row->max_ts ) ) {
			$max_date = gmdate( 'Y-m-d', (int) $row->max_ts );
		}

		return [
			'total_records'    => (int) ( $row->count ?? 0 ),
			'date_start'       => $min_date,
			'date_end'         => $max_date,
			'metrics_included' => $metrics['included'] ?? [],
			'metrics_excluded' => $metrics['excluded'] ?? [],
		];
	}

	/**
	 * Process a single batch chunk.
	 *
	 * @param int                  $import_id Import ID.
	 * @param array<string, mixed> $state Current state.
	 * @return array<string, mixed>
	 */
	public function import_batch( int $import_id, array $state ): array {
		global $wpdb;

		$batch_max  = (int) ( $state['batch_size'] ?? 1000 );
		$batch_info = $this->get_batch_query( $state );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = ! empty( $batch_info['args'] )
			? $wpdb->get_results( $wpdb->prepare( $batch_info['query'], ...$batch_info['args'] ) )
			: $wpdb->get_results( $batch_info['query'] );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		if ( empty( $rows ) ) {
			$state['status'] = 'completed';
			return $state;
		}

		$total_views   = 0;
		$processed     = 0;
		$watermark_key = $this->get_watermark_key();
		$watermark     = $state[ $watermark_key ] ?? ( 'watermark_date' === $watermark_key ? '1970-01-01' : 0 );

		// Both the wall-clock budget and the synthesized-row budget bound one
		// iteration; a row too large for the remaining budget is continued on
		// the next iteration from 'row_cursor' (visitors already emitted). The
		// watermark only advances past a row once it is fully emitted, so the
		// next batch query returns the pending row first.
		$deadline     = microtime( true ) + Import_Runner::get_chunk_time_budget();
		$event_budget = Event_Synthesizer::get_max_events_per_iteration();
		$events_used  = 0;
		$row_cursor   = (int) ( $state['row_cursor'] ?? 0 );
		$row_pending  = false;

		foreach ( $rows as $row ) {
			$row_data     = $this->map_row( $row );
			$slice        = $this->synthesizer->synthesize_slice( $import_id, $row_data, $row_cursor, $event_budget - $events_used );
			$total_views += $slice['pageviews'];
			$events_used += $slice['events'];

			if ( ! $slice['done'] ) {
				$row_cursor  = $slice['cursor'];
				$row_pending = true;
				break;
			}

			$row_watermark = $this->get_row_watermark( $row );
			if ( is_int( $watermark ) ) {
				$watermark = max( $watermark, (int) $row_watermark );
			} else {
				$watermark = (string) $row_watermark;
			}
			$row_cursor = 0;
			++$processed;

			if ( $events_used >= $event_budget || microtime( true ) >= $deadline ) {
				break;
			}
		}

		$state[ $watermark_key ]      = $watermark;
		$state['row_cursor']          = $row_cursor;
		$state['rows_processed']      = ( $state['rows_processed'] ?? 0 ) + $processed;
		$state['pageviews_processed'] = ( $state['pageviews_processed'] ?? 0 ) + $total_views;

		if ( ! $row_pending && $processed === count( $rows ) && count( $rows ) < $batch_max ) {
			$state['status'] = 'completed';
		} else {
			$state['status'] = 'processing';
		}

		return $state;
	}
}
