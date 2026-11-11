<?php
/**
 * Burst High Traffic Buffer
 *
 * @package Burst
 */

namespace Burst\Frontend\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

use Burst\Admin\Admin_Options;
use Burst\Admin\DomainTypes\Admin_Option_Category;
use Burst\Traits\Helper;

/**
 * Handles opt-in high-traffic disk buffering and asynchronous batch ingestion.
 *
 * Tracking requests append one JSON line per hit to a local buffer file without
 * loading WordPress or connecting to MySQL. A scheduled cron or WP-CLI job
 * rotates the buffer file and processes hits in batches.
 */
class High_Traffic_Buffer {
	use Helper;

	/**
	 * Config file name generated in WordPress root.
	 */
	public const CONFIG_FILE_NAME = 'burst-buffer-config.php';

	/**
	 * Config file format version.
	 */
	public const CONFIG_FORMAT_VERSION = 1;

	/**
	 * Active buffer file name inside the randomized buffer directory.
	 */
	public const ACTIVE_BUFFER_FILE = 'burst-buffer.log';

	/**
	 * Maximum number of buffered hits processed per batch.
	 */
	public const BATCH_SIZE = 1000;

	/**
	 * Maximum retry attempts for a failing batch before quarantining.
	 */
	public const MAX_BATCH_RETRIES = 3;

	/**
	 * Staleness threshold in seconds (10 minutes) for fail-safe fallback to direct database writes.
	 */
	public const CRON_STALE_THRESHOLD = 600;

	/**
	 * Memoized buffer directory path.
	 */
	private static ?string $buffer_dir = null;

	/**
	 * Register actions and filters.
	 */
	public static function init(): void {
		if ( ! has_action( 'burst_process_buffer', [ self::class, 'process_buffer' ] ) ) {
			add_action( 'burst_process_buffer', [ self::class, 'process_buffer' ] );
		}
		if ( ! has_action( 'update_option_burst_options_settings', [ self::class, 'on_update_options_settings' ] ) ) {
			add_action( 'update_option_burst_options_settings', [ self::class, 'on_update_options_settings' ], 10, 2 );
		}
		if ( ! has_action( 'deactivated_plugin', [ self::class, 'on_plugin_deactivated' ] ) ) {
			add_action( 'deactivated_plugin', [ self::class, 'on_plugin_deactivated' ], 10, 1 );
		}
	}

	/**
	 * Check whether high-traffic buffer mode is enabled via setting or constant.
	 */
	public static function is_buffer_enabled(): bool {
		if ( is_multisite() ) {
			return false;
		}

		if ( defined( 'BURST_HIGH_TRAFFIC_MODE' ) && BURST_HIGH_TRAFFIC_MODE ) {
			return true;
		}

		$instance = new self();
		return $instance->get_option_bool( 'high_traffic_mode', false );
	}

	/**
	 * Check whether high-traffic buffer mode is currently active and healthy.
	 */
	public static function is_active(): bool {
		if ( ! self::is_buffer_enabled() ) {
			return false;
		}

		$config_path = self::get_config_file_path();
		clearstatcache( true, $config_path );
		if ( ! file_exists( $config_path ) ) {
			return false;
		}

		$buffer_dir = self::get_buffer_dir();
		clearstatcache( true, $buffer_dir );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
		if ( ! is_dir( $buffer_dir ) || ! is_writable( $buffer_dir ) ) {
			return false;
		}

		$heartbeat_file = $buffer_dir . 'heartbeat';
		clearstatcache( true, $heartbeat_file );
		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! file_exists( $heartbeat_file ) || ( time() - (int) @filemtime( $heartbeat_file ) ) > self::CRON_STALE_THRESHOLD ) {
			return false;
		}

		return true;
	}

	/**
	 * Get the absolute path to the generated burst-buffer-config.php file in WordPress root.
	 */
	public static function get_config_file_path(): string {
		require_once dirname( __DIR__, 2 ) . '/base-path.php';
		return burst_find_wordpress_base_path() . self::CONFIG_FILE_NAME;
	}

	/**
	 * Write burst-buffer-config.php to the WordPress root directory.
	 *
	 * @return bool True on success, false if root directory is not writable or write failed.
	 */
	public static function write_config_file(): bool {
		if ( is_multisite() ) {
			return false;
		}

		require_once dirname( __DIR__, 2 ) . '/base-path.php';
		$wp_root = burst_find_wordpress_base_path();
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
		if ( ! is_dir( $wp_root ) || ! is_writable( $wp_root ) ) {
			return false;
		}

		$buffer_dir = self::ensure_buffer_dir();

		$config_path = $wp_root . self::CONFIG_FILE_NAME;
		$content     = "<?php\n"
			. "// Prevent direct HTTP access from leaking configuration or path info.\n"
			. "if ( ! defined( 'BURST_BUFFER_ENDPOINT' ) && ! defined( 'ABSPATH' ) ) {\n"
			. "\thttp_response_code( 403 );\n"
			. "\texit;\n"
			. "}\n"
			. "return [\n"
			. "\t'format'     => " . self::CONFIG_FORMAT_VERSION . ",\n"
			. "\t'enabled'    => true,\n"
			. "\t'buffer_dir' => '" . addcslashes( $buffer_dir, "'" ) . "',\n"
			. "];\n";

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, WordPress.PHP.NoSilencedErrors.Discouraged
		$written = @file_put_contents( $config_path, $content, LOCK_EX );
		if ( false !== $written ) {
			if ( function_exists( 'opcache_invalidate' ) ) {
				opcache_invalidate( $config_path, true );
			}
			clearstatcache( true, $config_path );
			return true;
		}
		return false;
	}

	/**
	 * Delete burst-buffer-config.php from the WordPress root directory.
	 */
	public static function delete_config_file(): bool {
		$config_path = self::get_config_file_path();
		if ( file_exists( $config_path ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
			$deleted = @unlink( $config_path );
			if ( function_exists( 'opcache_invalidate' ) ) {
				opcache_invalidate( $config_path, true );
			}
			clearstatcache( true, $config_path );
			return $deleted;
		}
		return true;
	}

	/**
	 * Ensure burst-buffer-config.php exists and matches current plugin configuration.
	 */
	public static function ensure_config_file(): bool {
		if ( ! self::is_buffer_enabled() ) {
			return false;
		}

		$config_path = self::get_config_file_path();
		if ( ! file_exists( $config_path ) ) {
			return self::write_config_file();
		}

		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$config = @include $config_path;
		if (
			! is_array( $config )
			|| ( $config['format'] ?? 0 ) !== self::CONFIG_FORMAT_VERSION
			|| empty( $config['enabled'] )
			|| empty( $config['buffer_dir'] )
			|| ! is_dir( (string) $config['buffer_dir'] )
		) {
			return self::write_config_file();
		}

		return true;
	}

	/**
	 * Touch heartbeat file in the buffer directory.
	 */
	public static function touch_heartbeat(): bool {
		$buffer_dir = self::ensure_buffer_dir();
		$heartbeat  = $buffer_dir . 'heartbeat';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_touch, WordPress.PHP.NoSilencedErrors.Discouraged
		$touched = @touch( $heartbeat );
		if ( $touched ) {
			clearstatcache( true, $heartbeat );
		}
		return $touched;
	}

	/**
	 * Ensure the buffer directory exists.
	 *
	 * Permissions are left to the server's umask: the directory must be
	 * writable by the web server user, which is the case when the mode is
	 * switched on from the settings page. World-writable permissions would let
	 * any local user on a shared host add hits or PHP to the buffer.
	 */
	public static function ensure_buffer_dir(): string {
		$buffer_dir = self::get_buffer_dir();
		if ( ! is_dir( $buffer_dir ) ) {
			wp_mkdir_p( $buffer_dir );
		}
		return $buffer_dir;
	}

	/**
	 * Get the buffer directory path inside uploads/burst/buffer/<hash>/.
	 */
	public static function get_buffer_dir(): string {
		if ( null !== self::$buffer_dir ) {
			return trailingslashit( self::$buffer_dir );
		}

		$instance         = new self();
		self::$buffer_dir = $instance->random_upload_dir( 'burst_buffer_dir_token', 'buffer' );
		return trailingslashit( self::$buffer_dir );
	}

	/**
	 * Set or reset the buffer directory path (useful for testing).
	 *
	 * @param string|null $dir Buffer directory path or null to reset memoization.
	 */
	public static function set_buffer_dir( ?string $dir ): void {
		self::$buffer_dir = null !== $dir ? trailingslashit( $dir ) : null;
	}

	/**
	 * Rotate the active buffer file to a timestamped processing file.
	 *
	 * Atomic file rename ensures newly arriving hits immediately start appending
	 * to a fresh active file without contention.
	 *
	 * @return string|null Path to the rotated processing file, or null if nothing to rotate.
	 */
	public static function rotate_buffer(): ?string {
		$buffer_dir  = self::get_buffer_dir();
		$active_file = $buffer_dir . self::ACTIVE_BUFFER_FILE;

		clearstatcache( true, $active_file );
		if ( ! file_exists( $active_file ) || 0 === (int) filesize( $active_file ) ) {
			return null;
		}

		$processing_file = $buffer_dir . 'buffer-' . time() . '-' . bin2hex( random_bytes( 4 ) ) . '.processing';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename, WordPress.PHP.NoSilencedErrors.Discouraged
		if ( @rename( $active_file, $processing_file ) ) {
			return $processing_file;
		}

		return null;
	}

	/**
	 * Ingest buffered hits from disk into the database.
	 *
	 * Run by WP-Cron or WP-CLI.
	 *
	 * @return int Number of hits ingested.
	 */
	public static function process_buffer(): int {
		$buffer_dir = self::ensure_buffer_dir();

		// With the mode off this run only drains the buffer. A heartbeat or config file
		// would keep the buffer endpoint accepting hits.
		if ( self::is_buffer_enabled() ) {
			self::ensure_config_file();
			self::touch_heartbeat();
		} else {
			self::delete_config_file();
		}

		$lock_file = $buffer_dir . 'burst-buffer.lock';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen, WordPress.PHP.NoSilencedErrors.Discouraged
		$lock_handle = @fopen( $lock_file, 'c+' );
		if ( ! $lock_handle ) {
			self::stop_processor_when_drained();
			return 0;
		}

		// Non-blocking flock prevents concurrent runs and automatically releases on exit.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_flock
		if ( ! flock( $lock_handle, LOCK_EX | LOCK_NB ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $lock_handle );
			return 0;
		}

		$total_ingested = 0;
		$is_cli         = defined( 'WP_CLI' ) && WP_CLI;
		$start_time     = microtime( true );

		try {
			self::rotate_buffer();
			self::prune_quarantine_files( $buffer_dir );

			$files = glob( $buffer_dir . '*.processing' );
			if ( empty( $files ) ) {
				Admin_Options::update( Admin_Option_Category::CORE, 'buffer_last_cron_run', time() );
				return 0;
			}

			sort( $files );
			$tracking = new Tracking();

			foreach ( $files as $file ) {
				// Under WP-Cron, terminate if 45 seconds have passed.
				if ( ! $is_cli && ( microtime( true ) - $start_time ) >= 45.0 ) {
					break;
				}

				$ingested        = self::process_processing_file( $file, $tracking, $start_time, $is_cli );
				$total_ingested += $ingested;
			}

			Admin_Options::update( Admin_Option_Category::CORE, 'buffer_last_cron_run', time() );
		} finally {
			self::stop_processor_when_drained();
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_flock
			flock( $lock_handle, LOCK_UN );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $lock_handle );
		}

		return $total_ingested;
	}

	/**
	 * End the recurring processor once the mode is off and every buffered hit is ingested.
	 *
	 * Switching the mode off does not stop the processor by itself: a run that holds
	 * the lock or runs out of its time budget leaves hits on disk, and only a next
	 * run ingests those.
	 */
	private static function stop_processor_when_drained(): void {
		if ( self::is_buffer_enabled() || self::has_unprocessed_hits() ) {
			return;
		}

		wp_clear_scheduled_hook( 'burst_process_buffer' );
	}

	/**
	 * Check whether hits are waiting on disk.
	 *
	 * @return bool True if the active buffer or a processing file holds hits.
	 */
	private static function has_unprocessed_hits(): bool {
		$buffer_dir  = self::get_buffer_dir();
		$active_file = $buffer_dir . self::ACTIVE_BUFFER_FILE;

		clearstatcache( true, $active_file );
		if ( file_exists( $active_file ) && (int) filesize( $active_file ) > 0 ) {
			return true;
		}

		return ! empty( glob( $buffer_dir . '*.processing' ) );
	}

	/**
	 * Process a single .processing file line by line, resuming where an earlier run stopped.
	 *
	 * After every ingested line the byte offset of the next line is written to
	 * a "<file>.offset" checkpoint. A run that dies mid-file (fatal error,
	 * max_execution_time, killed worker) therefore resumes after the last stored
	 * hit instead of replaying hits that are already in the database (only a
	 * crash between the database write and the checkpoint repeats that one hit). The file
	 * and its checkpoint are deleted once every line is processed; when the time
	 * budget runs out first, both are kept for the next run.
	 *
	 * @param string   $file       Path to the processing file.
	 * @param Tracking $tracking   Tracking instance to ingest hits.
	 * @param float    $start_time Start timestamp of the processor run.
	 * @param bool     $is_cli     Whether the process is executing under WP-CLI.
	 * @return int Number of hits ingested.
	 */
	public static function process_processing_file( string $file, Tracking $tracking, float $start_time = 0.0, bool $is_cli = true ): int {
		if ( ! file_exists( $file ) || ! is_readable( $file ) ) {
			return 0;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen, WordPress.PHP.NoSilencedErrors.Discouraged
		$handle = @fopen( $file, 'r' );
		if ( ! $handle ) {
			return 0;
		}

		$offset_file   = $file . '.offset';
		$attempts_file = $file . '.attempts';
		$offset        = self::read_offset( $offset_file );
		if ( $offset > 0 ) {
			fseek( $handle, $offset );
		}

		$ingested    = 0;
		$is_complete = true;

		while ( true ) {
			if ( ! $is_cli && $start_time > 0.0 && ( microtime( true ) - $start_time ) >= 45.0 ) {
				$is_complete = false;
				break;
			}

			$batch_entries      = [];
			$batch_start_offset = (int) ftell( $handle );
			$read_lines         = 0;

			while ( $read_lines < self::BATCH_SIZE ) {
				$line = fgets( $handle );
				if ( false === $line ) {
					break;
				}

				++$read_lines;
				$trimmed = trim( $line );
				if ( '' === $trimmed ) {
					continue;
				}

				$decoded = json_decode( $trimmed, true );
				if ( is_array( $decoded ) ) {
					$batch_entries[] = $decoded;
				}
			}

			if ( 0 === $read_lines ) {
				break;
			}

			$batch_end_offset = (int) ftell( $handle );

			if ( ! empty( $batch_entries ) ) {
				try {
					$ingested_in_batch = $tracking->process_hit_batch( $batch_entries );
					$ingested         += $ingested_in_batch;
					self::clear_batch_attempts( $attempts_file );
				} catch ( \Throwable $e ) {
					self::error_log( 'Failed to ingest buffered batch: ' . $e->getMessage() );
					$attempts = self::record_batch_failure( $attempts_file, $batch_start_offset );
					if ( $attempts < self::MAX_BATCH_RETRIES ) {
						// Transient failure: do not advance offset. Stop current run so the next run retries.
						$is_complete = false;
						break;
					}

					// Repeated failure (exceeded MAX_BATCH_RETRIES): quarantine and skip past this batch.
					self::quarantine_batch( $file, $batch_entries, $e->getMessage() );
					self::clear_batch_attempts( $attempts_file );
				}
			}

			self::write_offset( $offset_file, $batch_end_offset );

			if ( feof( $handle ) ) {
				break;
			}
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $handle );

		if ( $is_complete ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
			@unlink( $file );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
			@unlink( $offset_file );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
			@unlink( $attempts_file );
		}

		return $ingested;
	}

	/**
	 * Record a failure attempt for a batch starting at the given offset.
	 *
	 * @param string $attempts_file Path to the attempts tracker file.
	 * @param int    $offset        Byte offset where the batch started.
	 * @return int Number of attempts recorded for this offset.
	 */
	private static function record_batch_failure( string $attempts_file, int $offset ): int {
		$attempts_data = [];
		if ( file_exists( $attempts_file ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.PHP.NoSilencedErrors.Discouraged
			$raw = @file_get_contents( $attempts_file );
			if ( is_string( $raw ) && '' !== $raw ) {
				$decoded = json_decode( $raw, true );
				if ( is_array( $decoded ) ) {
					$attempts_data = $decoded;
				}
			}
		}

		$current_attempts = (int) ( $attempts_data[ (string) $offset ] ?? 0 ) + 1;
		$attempts_data    = [ (string) $offset => $current_attempts ];

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, WordPress.PHP.NoSilencedErrors.Discouraged
		@file_put_contents( $attempts_file, (string) wp_json_encode( $attempts_data ), LOCK_EX );

		return $current_attempts;
	}

	/**
	 * Clear the attempts file after a successful batch ingestion.
	 *
	 * @param string $attempts_file Path to the attempts tracker file.
	 */
	private static function clear_batch_attempts( string $attempts_file ): void {
		if ( file_exists( $attempts_file ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
			@unlink( $attempts_file );
		}
	}

	/**
	 * Prune quarantine and stale attempts files older than 7 days to prevent unbounded disk growth.
	 *
	 * @param string $buffer_dir Path to the buffer directory.
	 */
	public static function prune_quarantine_files( string $buffer_dir ): void {
		$aux_files = array_merge(
			glob( $buffer_dir . '*.quarantine' ) ?: [],
			glob( $buffer_dir . '*.attempts' ) ?: []
		);
		if ( empty( $aux_files ) ) {
			return;
		}

		$cutoff = time() - 7 * DAY_IN_SECONDS;
		foreach ( $aux_files as $file ) {
			// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			$mtime = (int) @filemtime( $file );
			if ( $mtime > 0 && $mtime < $cutoff ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink, WordPress.PHP.NoSilencedErrors.Discouraged
				@unlink( $file );
			}
		}
	}

	/**
	 * Read the byte offset at which processing of a buffer file resumes.
	 *
	 * @param string $offset_file Path to the checkpoint file.
	 * @return int Byte offset, 0 when there is no checkpoint.
	 */
	private static function read_offset( string $offset_file ): int {
		if ( ! file_exists( $offset_file ) ) {
			return 0;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.PHP.NoSilencedErrors.Discouraged
		return max( 0, (int) @file_get_contents( $offset_file ) );
	}

	/**
	 * Store the byte offset of the next unprocessed line of a buffer file.
	 *
	 * @param string $offset_file Path to the checkpoint file.
	 * @param int    $offset      Byte offset of the next line.
	 */
	private static function write_offset( string $offset_file, int $offset ): void {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, WordPress.PHP.NoSilencedErrors.Discouraged
		@file_put_contents( $offset_file, (string) $offset, LOCK_EX );
	}

	/**
	 * Quarantine a batch that failed ingestion to avoid blocking the buffer file.
	 *
	 * Writes the failing batch entries to `<file>.quarantine` and logs the failure.
	 *
	 * @param string                           $file          Path to the processing file.
	 * @param array<int, array<string, mixed>> $batch_entries Entries in the failing batch.
	 * @param string                           $reason        Error message describing why the batch failed.
	 */
	public static function quarantine_batch( string $file, array $batch_entries, string $reason = '' ): void {
		$quarantine_file = $file . '.quarantine';
		$payload         = '';
		foreach ( $batch_entries as $entry ) {
			if ( is_array( $entry ) ) {
				$entry['_quarantine_error'] = $reason;
				$payload                   .= (string) wp_json_encode( $entry ) . "\n";
			}
		}
		if ( '' !== $payload ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			file_put_contents( $quarantine_file, $payload, FILE_APPEND | LOCK_EX );
		}
	}

	/**
	 * Handle settings update to schedule or unschedule buffer cron and manage config file.
	 *
	 * @param mixed $old_value The settings array before the update. Dictated by WordPress options hook.
	 * @param mixed $new_value The settings array after the update. Dictated by WordPress options hook.
	 */
	public static function on_update_options_settings( mixed $old_value, mixed $new_value ): void {
		$old_array = is_array( $old_value ) ? $old_value : [];
		$new_array = is_array( $new_value ) ? $new_value : [];

		$was_enabled = ! empty( $old_array['high_traffic_mode'] );
		$is_enabled  = ! empty( $new_array['high_traffic_mode'] );

		if ( ! $was_enabled && $is_enabled ) {
			self::write_config_file();
			self::touch_heartbeat();
			Admin_Options::update( Admin_Option_Category::CORE, 'buffer_last_cron_run', time() );
			if ( ! wp_next_scheduled( 'burst_process_buffer' ) ) {
				wp_schedule_event( time(), 'burst_every_minute', 'burst_process_buffer' );
			}
			do_action( 'burst_create_js_file' );
		} elseif ( $was_enabled && ! $is_enabled ) {
			self::delete_config_file();
			// The processor stops itself once the buffer is empty, see stop_processor_when_drained().
			if ( ! wp_next_scheduled( 'burst_process_buffer' ) ) {
				wp_schedule_event( time(), 'burst_every_minute', 'burst_process_buffer' );
			}
			self::process_buffer();
			do_action( 'burst_create_js_file' );
		}
	}

	/**
	 * Delete config file if the deactivated plugin is Burst.
	 *
	 * @param string $plugin Path to the plugin file relative to the plugins directory.
	 */
	public static function on_plugin_deactivated( string $plugin ): void {
		if ( str_contains( $plugin, 'burst' ) ) {
			self::delete_config_file();
		}
	}

	/**
	 * Get context explanation or health warning for the high-traffic mode setting.
	 */
	public static function get_settings_context(): string {
		if ( is_multisite() ) {
			return __( 'High-traffic buffer mode is not supported on WordPress multisite installations.', 'burst-statistics' );
		}

		require_once dirname( __DIR__, 2 ) . '/base-path.php';
		$wp_root = burst_find_wordpress_base_path();
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
		if ( ! is_dir( $wp_root ) || ! is_writable( $wp_root ) ) {
			return __( 'High-traffic buffer mode requires the WordPress root directory to be writable to generate the buffer configuration file.', 'burst-statistics' );
		}

		// The processor only runs while the mode is on, so its last run says nothing when the mode is off.
		$last_run = self::is_buffer_enabled() ? (int) Admin_Options::get( Admin_Option_Category::CORE, 'buffer_last_cron_run', 0 ) : 0;
		if ( $last_run > 0 && ( time() - $last_run ) > self::CRON_STALE_THRESHOLD ) {
			return sprintf(
				/* translators: %s: relative time elapsed since the last background buffer run. */
				__( 'Warning: The background buffer processor has not run in over 10 minutes (last run %s ago). Buffered hits are currently falling back to direct database writes.', 'burst-statistics' ),
				human_time_diff( $last_run )
			);
		}

		if ( $last_run > 0 ) {
			return sprintf(
				/* translators: %s: relative time elapsed since the last background buffer run. */
				__( 'Last buffer ingestion run: %s ago.', 'burst-statistics' ),
				human_time_diff( $last_run )
			);
		}

		return __( 'Buffer incoming hits to disk and ingest them in scheduled background batches to reduce database load during pageviews.', 'burst-statistics' );
	}

	/**
	 * Determine whether the high-traffic mode setting should be disabled.
	 */
	public static function is_settings_disabled(): bool {
		if ( is_multisite() ) {
			return true;
		}

		require_once dirname( __DIR__, 2 ) . '/base-path.php';
		$wp_root = burst_find_wordpress_base_path();
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_is_writable
		return ! is_dir( $wp_root ) || ! is_writable( $wp_root );
	}
}
