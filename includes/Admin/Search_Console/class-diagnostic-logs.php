<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Per-site, verbose diagnostic event storage for Search Console.
 */
class Diagnostic_Logs {
	use Database_Helper;

	private const RETENTION_DAYS = 90;

	private const MAX_ENTRIES = 1000;

	private const CONTENT_VERSION_OPTION = 'burst_gsc_diagnostic_logs_content_version';

	private const CONTENT_VERSION = 'summary_v1';

	private static ?bool $table_ready = null;

	/**
	 * Register the table with Burst's installation and table helper system.
	 */
	public function init(): void {
		add_filter( 'burst_all_tables', [ $this, 'register_table' ] );
		add_action( 'burst_install_tables', [ $this, 'install_table' ] );
	}

	/**
	 * Add the diagnostics table to Burst's known per-site table list.
	 *
	 * @param array $tables Known Burst tables.
	 */
	public function register_table( array $tables ): array {
		$tables[] = 'burst_gsc_diagnostic_logs';
		return $tables;
	}

	/**
	 * Create the per-site event table.
	 */
	public function install_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}burst_gsc_diagnostic_logs (
				`ID` bigint unsigned NOT NULL AUTO_INCREMENT,
				`time` int unsigned NOT NULL,
				`event` varchar(64) NOT NULL,
				`status` varchar(24) NOT NULL,
				`message` varchar(191) NOT NULL,
				`context` longtext NOT NULL,
				PRIMARY KEY (ID),
				KEY `time` (`time`)
			) $charset_collate;"
		);

		if ( ! $this->table_exists( 'burst_gsc_diagnostic_logs' ) ) {
			self::$table_ready = false;
			self::error_log( 'Error creating Search Console diagnostics table: ' . $wpdb->last_error );
			return;
		}

		self::$table_ready = true;
	}

	/**
	 * Store one redacted event. Failures to write diagnostics never interrupt the
	 * Search Console flow being observed.
	 *
	 * @param string $event   Stable event name.
	 * @param string $status  info, success, warning, or error.
	 * @param string $message Human-readable, non-sensitive summary.
	 * @param array  $context Operational diagnostic context. Credentials and Search Console response data are excluded.
	 */
	public function add( string $event, string $status, string $message, array $context = [] ): void {
		if ( ! $this->maybe_install() ) {
			return;
		}

		$context = $this->sanitize_context(
			array_merge(
				[
					'blog_id' => get_current_blog_id(),
					'runtime' => wp_doing_cron() ? 'cron' : 'request',
				],
				$context
			)
		);
		$encoded = wp_json_encode( $context, JSON_INVALID_UTF8_SUBSTITUTE );
		if ( false === $encoded ) {
			return;
		}

		global $wpdb;
		$result = $wpdb->insert(
			"{$wpdb->prefix}burst_gsc_diagnostic_logs",
			[
				'time'    => time(),
				'event'   => sanitize_key( $event ),
				'status'  => sanitize_key( $status ),
				'message' => sanitize_text_field( $message ),
				'context' => $encoded,
			],
			[ '%d', '%s', '%s', '%s', '%s' ]
		);
		if ( false === $result ) {
			self::error_log( 'Could not store Search Console diagnostic event: ' . $wpdb->last_error );
			return;
		}

		$this->prune();
	}

	/**
	 * Return the most recent stored events for the current site.
	 *
	 * @return array<int, array{time:int,event:string,status:string,message:string,context:array}>
	 */
	public function recent( int $limit = 50 ): array {
		// Site Health calls this read path. Do not run dbDelta(), migrations, or any
		// other write while an administrator is merely viewing diagnostic state.
		if ( ! $this->table_exists( 'burst_gsc_diagnostic_logs' ) ) {
			return [];
		}

		global $wpdb;
		$limit = min( max( $limit, 1 ), 100 );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT `time`, `event`, `status`, `message`, `context` FROM `{$wpdb->prefix}burst_gsc_diagnostic_logs` ORDER BY `ID` DESC LIMIT %d",
				$limit
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return [];
		}

		return array_map(
			function ( array $row ): array {
				$context = json_decode( (string) $row['context'], true );
				return [
					'time'    => (int) $row['time'],
					'event'   => (string) $row['event'],
					'status'  => (string) $row['status'],
					'message' => (string) $row['message'],
					'context' => is_array( $context ) ? $this->sanitize_context( $context ) : [],
				];
			},
			$rows
		);
	}

	/**
	 * Ensure the table exists for sites where the feature was enabled after the
	 * plugin's normal table-install hook ran.
	 */
	private function maybe_install(): bool {
		if ( null !== self::$table_ready ) {
			return self::$table_ready;
		}

		// Run dbDelta once per request even for existing tables. This both creates
		// the table lazily and upgrades early cron-created tables with the time
		// index required by retention pruning, without relying on an admin request.
		$this->install_table();
		if ( self::$table_ready ) {
			$this->summarize_existing_contexts();
		}
		return self::$table_ready;
	}

	/**
	 * Keep diagnostics useful without allowing cron activity to grow this table indefinitely.
	 */
	private function prune(): void {
		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM `{$wpdb->prefix}burst_gsc_diagnostic_logs` WHERE `time` < %d",
				time() - self::RETENTION_DAYS * DAY_IN_SECONDS
			)
		);

		$oldest_retained_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT `ID` FROM `{$wpdb->prefix}burst_gsc_diagnostic_logs` ORDER BY `ID` DESC LIMIT 1 OFFSET %d",
				self::MAX_ENTRIES - 1
			)
		);
		if ( null === $oldest_retained_id ) {
			return;
		}

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM `{$wpdb->prefix}burst_gsc_diagnostic_logs` WHERE `ID` < %d",
				(int) $oldest_retained_id
			)
		);
	}

	/**
	 * Keep diagnostic metadata while redacting credentials and replacing Search
	 * Console response payloads with counts.
	 *
	 * @param array $context Untrusted context shape from internal callers.
	 */
	private function sanitize_context( array $context ): array {
		return $this->sanitize_value( $context );
	}

	/**
	 * Recursively preserve diagnostic values while excluding credentials and
	 * opaque objects that cannot be represented safely as JSON.
	 *
	 * @param mixed  $value Context value.
	 * @param string $key   Parent key.
	 */
	private function sanitize_value( mixed $value, string $key = '' ): mixed {
		if ( $this->is_sensitive_key( $key ) ) {
			return '[redacted]';
		}
		if ( $this->is_search_console_data_key( $key ) ) {
			return $this->summarize_search_console_data( $value, $key );
		}

		if ( is_array( $value ) ) {
			$clean = [];
			foreach ( $value as $child_key => $child_value ) {
				$clean_key           = is_int( $child_key ) ? $child_key : sanitize_key( $child_key );
				$clean[ $clean_key ] = $this->sanitize_value( $child_value, (string) $child_key );
			}
			return $clean;
		}

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				return $this->sanitize_value( $decoded, $key );
			}

			return $this->redact_sensitive_text( $value );
		}

		if ( is_scalar( $value ) || null === $value ) {
			return $value;
		}

		return '[unsupported diagnostic value]';
	}

	/**
	 * Prevent Search Console result payloads from entering the diagnostics table.
	 */
	private function is_search_console_data_key( string $key ): bool {
		$key = sanitize_key( $key );
		return in_array( $key, [ 'body', 'rows', 'siteentry', 'site_entry' ], true );
	}

	/**
	 * Retain only the amount of Search Console data returned, never the data itself.
	 *
	 * @param mixed  $value Result payload.
	 * @param string $key   Result field name.
	 */
	private function summarize_search_console_data( mixed $value, string $key ): array {
		$key = sanitize_key( $key );
		if ( is_array( $value ) ) {
			if ( isset( $value['rows'] ) && is_array( $value['rows'] ) ) {
				return [ 'row_count' => count( $value['rows'] ) ];
			}
			if ( isset( $value['siteEntry'] ) && is_array( $value['siteEntry'] ) ) {
				return [ 'property_count' => count( $value['siteEntry'] ) ];
			}
			return [ 'siteentry' === $key || 'site_entry' === $key ? 'property_count' : 'item_count' => count( $value ) ];
		}

		return [ 'body_bytes' => is_string( $value ) ? strlen( $value ) : 0 ];
	}

	/**
	 * Replace any contexts written before response summaries were introduced.
	 * The migration is per-site, runs once, and retains diagnostics metadata.
	 */
	private function summarize_existing_contexts(): void {
		if ( self::CONTENT_VERSION === get_option( self::CONTENT_VERSION_OPTION ) ) {
			return;
		}

		global $wpdb;
		$rows = $wpdb->get_results( "SELECT `ID`, `context` FROM `{$wpdb->prefix}burst_gsc_diagnostic_logs`", ARRAY_A );
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$context = json_decode( (string) $row['context'], true );
				if ( ! is_array( $context ) ) {
					continue;
				}
				$context = $this->sanitize_context( $context );
				$encoded = wp_json_encode( $context, JSON_INVALID_UTF8_SUBSTITUTE );
				if ( false === $encoded || $encoded === $row['context'] ) {
					continue;
				}
				$wpdb->update(
					"{$wpdb->prefix}burst_gsc_diagnostic_logs",
					[ 'context' => $encoded ],
					[ 'ID' => (int) $row['ID'] ],
					[ '%s' ],
					[ '%d' ]
				);
			}
		}

		update_option( self::CONTENT_VERSION_OPTION, self::CONTENT_VERSION, false );
	}

	/**
	 * Identify request and OAuth credential fields which must never enter the
	 * diagnostic table, even when a full HTTP request or response is logged.
	 */
	private function is_sensitive_key( string $key ): bool {
		$key = preg_replace( '/(?<!^)[A-Z]/', '_$0', $key ) ?? $key;
		$key = str_replace( '-', '_', sanitize_key( $key ) );
		if (
			str_contains( $key, 'authorization' )
			|| str_contains( $key, 'cookie' )
			|| str_contains( $key, 'secret' )
			|| str_contains( $key, 'signature' )
			|| str_contains( $key, 'token' )
			|| str_contains( $key, 'verifier' )
			|| 'api_key' === $key
		) {
			return true;
		}

		return in_array(
			$key,
			[
				'access_token',
				'authorization',
				'authorization_code',
				'code',
				'code_challenge',
				'code_verifier',
				'cookie',
				'http_x_burst_signature',
				'id_token',
				'nonce',
				'password',
				'refresh_token',
				'secret',
				'set_cookie',
				'signature',
				'state',
				'token',
			],
			true
		);
	}

	/**
	 * Redact credentials that appear in an unstructured HTTP error or malformed
	 * JSON body. Structured JSON strings are decoded and handled recursively
	 * above, but transport errors can still return raw text.
	 */
	private function redact_sensitive_text( string $value ): string {
		$sensitive = '(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|authorization|code[_-]?verifier|code|secret|signature|cookie|state)';
		$value     = preg_replace( '/((?:[?&]|["\']?)' . $sensitive . '(?:["\']?\s*[:=]))[^&\s,"\'}]+/i', '$1[redacted]', $value ) ?? $value;

		return preg_replace( '/(Bearer\s+)[^\s,"\'}]+/i', '$1[redacted]', $value ) ?? $value;
	}
}
