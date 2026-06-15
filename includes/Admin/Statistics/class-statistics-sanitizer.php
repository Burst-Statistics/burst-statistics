<?php
/**
 * Input sanitizer for Statistics_Query.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Sanitizes and validates user-supplied inputs (filters, metrics, group_by, order_by,
 * custom SQL) for a Statistics_Query instance.
 *
 * Lives as a sibling of Statistics_Query so the SQL builder stays focused on assembly;
 * sanitization is a separable concern with its own surface area.
 */
class Statistics_Sanitizer {

	use Admin_Helper;

	/**
	 * Parent query for strict-mode lookup, trait helpers (filter_validation_config),
	 * allowlist access, and writing exclusion state back.
	 */
	private Statistics_Query $query;

	/**
	 * Constructor.
	 *
	 * @param Statistics_Query $query Parent query.
	 */
	public function __construct( Statistics_Query $query ) {
		$this->query = $query;
	}

	/**
	 * Default metric used as fallback when an invalid metric is submitted.
	 *
	 * @return string Default metric name.
	 */
	public function default_metric(): string {
		return apply_filters( 'burst_default_metric', 'pageviews' );
	}

	/**
	 * Flexibly sanitize filters for statistics queries.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	public function sanitize_filters_flexibly( array $filters ): array {
		$filters = array_filter(
			$filters,
			static function ( $item ) {
				if ( $item === 0 || $item === '0' ) {
					return true;
				}
				return $item !== false && $item !== '';
			}
		);

		$filter_config = $this->query->filter_validation_config();
		$output        = [];
		foreach ( $filters as $key => $value ) {
			$key = sanitize_text_field( $key );
			if ( is_array( $value ) ) {
				$output[ $key ] = $this->sanitize_filters( $value );
				continue;
			}

			if ( isset( $filter_config[ $key ]['sanitize'] ) ) {
				$sanitize_function = $filter_config[ $key ]['sanitize'];
				if ( is_callable( $sanitize_function ) ) {
					try {
						$output[ $key ] = call_user_func( $sanitize_function, $value );
					} catch ( \Exception $e ) {
						static::error_log( 'QueryData error: Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} elseif ( is_callable( [ $this->query, $sanitize_function ] ) ) {
					try {
						$output[ $key ] = call_user_func( [ $this->query, $sanitize_function ], $value );
					} catch ( \Exception $e ) {
						static::error_log( 'QueryData error: Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} else {
					static::error_log( 'QueryData error: Sanitization function not found for filter: ' . $key );
					$output[ $key ] = is_numeric( $value ) ? $value : sanitize_text_field( $value );
				}
			} else {
				$output[ $key ] = is_numeric( $value ) ? (int) $value : sanitize_text_field( $value );
			}
		}

		return $output;
	}

	/**
	 * Strictly sanitize filters for statistics queries.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	private function sanitize_filters_strictly( array $filters ): array {
		$filters = array_filter(
			$filters,
			static function ( $item ) {
				return $item !== false && $item !== '';
			}
		);

		$sanitized = [];
		foreach ( $filters as $key => $value ) {
			if ( in_array( $key, $this->query->get_allowlist()->filter_keys(), true ) ) {
				$sanitized_key = $key;

				switch ( $key ) {
					case 'page_url':
						$parsed_url      = wp_parse_url( $value, PHP_URL_PATH );
						$sanitized_value = ( $parsed_url !== false && $parsed_url !== null ) ? $parsed_url : sanitize_text_field( $value );
						break;
					case 'referrer':
						$sanitized_value = esc_url_raw( $value );
						break;
					case 'page_id':
						$sanitized_value = absint( $value );
						break;
					case 'page_type':
						$allowed_page_types = apply_filters( 'burst_allowed_post_types', get_post_types( [ 'public' => true ] ) );
						$sanitized_value    = in_array( $value, $allowed_page_types, true ) ? $value : 'post';
						break;
					case 'device':
					case 'browser':
					case 'platform':
						$sanitized_value = sanitize_key( $value );
						break;
					default:
						$sanitized_value = sanitize_text_field( $value );
						break;
				}

				if ( ! empty( $sanitized_value ) ) {
					$sanitized[ $sanitized_key ] = $sanitized_value;
				}
			}
		}
		return $sanitized;
	}

	/**
	 * Sanitize filters for statistics queries.
	 *
	 * Dispatches to strict or flexible mode based on the parent query.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	public function sanitize_filters( array $filters ): array {
		if ( $this->query->is_strict() ) {
			return $this->sanitize_filters_strictly( $filters );
		}
		return $this->sanitize_filters_flexibly( $filters );
	}

	/**
	 * Normalize filter values: detect '!' prefix indicating exclusion,
	 * strip it, and record the exclusion mode on the parent query.
	 *
	 * @param array $filters Raw filters array.
	 * @return array<string, mixed> Filters with '!' prefix stripped where applicable.
	 */
	public function normalize_filter_values( array $filters ): array {
		$normalized = [];

		foreach ( $filters as $key => $value ) {
			if ( is_string( $value ) && str_starts_with( $value, '!' ) ) {
				$normalized[ $key ] = substr( $value, 1 );
				$this->query->set_filter_exclusion( $key, 'exclude' );
			} else {
				$normalized[ $key ] = $value;
				$this->query->set_filter_exclusion( $key, 'include' );
			}
		}

		return $normalized;
	}

	/**
	 * Sanitize array of metrics.
	 *
	 * @param array $metrics Array of metrics to sanitize.
	 * @return array<string> Sanitized metrics array.
	 */
	public function sanitize_metrics( array $metrics ): array {
		$sanitized_metrics = [];
		foreach ( $metrics as $metric ) {
			$sanitized_metrics[] = $this->sanitize_metric( $metric );
		}
		return $sanitized_metrics;
	}

	/**
	 * Sanitize a metric against list of allowed metrics.
	 *
	 * @param string $metric The metric to sanitize.
	 * @return string Sanitized metric.
	 */
	public function sanitize_metric( string $metric ): string {
		$metric = sanitize_text_field( $metric );

		$allowed_metrics = $this->query->get_allowlist()->metrics();
		$default_metric  = $this->default_metric();

		if ( in_array( $metric, $allowed_metrics, true ) ) {
			return $metric;
		}

		self::error_log( "QueryData error: Metric '$metric' is not allowed. Returning default metric '$default_metric'." );
		return $default_metric;
	}

	/**
	 * Sanitize group_by parameters.
	 *
	 * @param array $group_by Group by parameters to sanitize.
	 * @return array<string> Sanitized group_by array.
	 */
	public function sanitize_group_by( array $group_by ): array {
		$allowed_group_by   = $this->query->get_allowlist()->group_by();
		$sanitized_group_by = [];

		foreach ( $group_by as $field ) {
			// Split compound comma-separated expressions (e.g. 'd.ID, d.name').
			$tokens = array_filter( array_map( 'trim', explode( ',', $field ) ), static fn( string $v ) => '' !== $v );
			foreach ( $tokens as $token ) {
				$token = sanitize_text_field( $token );
				if ( empty( $token ) ) {
					continue;
				}
				if ( in_array( $token, $allowed_group_by, true ) ) {
					$sanitized_group_by[] = $token;
				} elseif ( ! $this->query->is_strict() && preg_match( '/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/', $token ) ) {
					// Allow table-qualified identifiers (alias.column) in non-strict (admin) mode.
					$sanitized_group_by[] = $token;
				} else {
					self::error_log( "QueryData error: Group by field '$token' is not allowed." );
				}
			}
		}

		return array_unique( $sanitized_group_by );
	}

	/**
	 * Validate order_by against allowlist.
	 *
	 * @param string|string[] $order_by Order by clause(s) to validate.
	 * @return string[] Validated order_by or empty array.
	 */
	public function validate_order_by( array|string $order_by ): array {
		$order_by = is_array( $order_by ) ? $order_by : [ $order_by ];

		$allowed   = $this->query->get_allowlist()->order_by();
		$validated = [];

		foreach ( $order_by as $item ) {
			$item = trim( (string) $item );
			if ( empty( $item ) ) {
				continue;
			}
			if ( in_array( $item, $allowed, true ) ) {
				$validated[] = $item;
			} elseif ( ! $this->query->is_strict() && preg_match( '/^[a-zA-Z_][a-zA-Z0-9_]*( (ASC|DESC))?$/', $item ) ) {
				// Allow alias-based sort terms (e.g. 'total_revenue DESC') in non-strict (admin) mode.
				$validated[] = $item;
			} else {
				self::error_log( "QueryData error: Order by clause '$item' is not allowed." );
			}
		}

		return $validated;
	}

	/**
	 * Validate custom SELECT/WHERE clauses for safe SQL patterns.
	 *
	 * @param string $sql     SQL clause to validate.
	 * @param string $context 'select' or 'where' for better error messages.
	 * @return bool True if valid, false if suspicious.
	 */
	public function validate_custom_sql_safety( string $sql, string $context = 'select' ): bool {
		// Reject obfuscation chars early: null bytes, backticks (MySQL identifier escape
		// can hide reserved words from \bKEYWORD\b checks), and BOM / zero-width chars.
		if ( preg_match( '/[\x00\x{FEFF}\x{200B}-\x{200D}`]/u', $sql ) ) {
			self::error_log(
				"QueryData error: obfuscation character detected in custom_$context. Query blocked. " .
				'SQL: ' . substr( $sql, 0, 100 )
			);
			return false;
		}

		// Remove all whitespace for easier pattern matching.
		$normalized = preg_replace( '/\s+/', ' ', trim( $sql ) );

		// Check for dangerous SQL keywords.
		$dangerous_keywords = [
			'DROP',
			'DELETE',
			'TRUNCATE',
			'ALTER',
			'CREATE',
			'REPLACE',
			'INSERT',
			'UPDATE',
			'EXEC',
			'EXECUTE',
			'UNION',
			'LOAD_FILE',
			'OUTFILE',
			'DUMPFILE',
			'INTO\s+(?:OUT|DUMP)FILE',
			'BENCHMARK',
			'SLEEP',
			'WAITFOR',
			'DELAY',
			'INFORMATION_SCHEMA',
			'LOAD\s+DATA',
			'SHOW\s+TABLES',
			'SHOW\s+DATABASES',
		];

		foreach ( $dangerous_keywords as $keyword ) {
			if ( preg_match( '/\b' . $keyword . '\b/i', $normalized ) ) {
				self::error_log(
					"QueryData error: prohibited keyword '$keyword' detected in custom_$context. Query blocked. " .
					'SQL: ' . substr( $sql, 0, 100 )
				);
				return false;
			}
		}

		// Check for suspicious patterns.
		$suspicious_patterns = [
			// Multiple statements (semicolon followed by more SQL).
			'/;.*\w/',
			// SQL comments with content after them.
			'/--\s*[^\s]/',
			// MySQL comments with content.
			'/#.*[^\s]/',
			// Block comments (can hide malicious code). `s` modifier ensures
			// multiline payloads like `/\nUNION SELECT\n*/` are matched.
			'/\/\*.*\*\//s',
			// Hex literals (often used in injection).
			'/0x[0-9a-f]+/i',
			// CHAR() function (can encode malicious strings).
			'/char\s*\(/i',
			// CONCAT often used in injection.
			'/concat\s*\(/i',
			// File reading.
			'/load_file\s*\(/i',
			// File writing.
			'/into\s+(outfile|dumpfile)/i',
		];

		foreach ( $suspicious_patterns as $pattern ) {
			if ( preg_match( $pattern, $normalized ) ) {
				self::error_log(
					"QueryData error: Suspicious pattern detected in custom_$context. Query blocked. " .
					"Pattern: $pattern | SQL: " . substr( $sql, 0, 100 )
				);
				return false;
			}
		}

		// Check for balanced parentheses (prevents injection via unclosed brackets).
		$open  = substr_count( $sql, '(' );
		$close = substr_count( $sql, ')' );
		if ( $open !== $close ) {
			self::error_log(
				"QueryData error: Unbalanced parentheses in custom_$context. Query blocked. " .
				'SQL: ' . substr( $sql, 0, 100 )
			);
			return false;
		}

		// Check for balanced quotes (prevents injection via unclosed strings).
		$single_quotes = substr_count( $sql, "'" ) - substr_count( $sql, "\\'" );
		$double_quotes = substr_count( $sql, '"' ) - substr_count( $sql, '\\"' );

		if ( $single_quotes % 2 !== 0 || $double_quotes % 2 !== 0 ) {
			self::error_log(
				"QueryData error: Unbalanced quotes in custom_$context. Query blocked. " .
				'SQL: ' . substr( $sql, 0, 100 )
			);
			return false;
		}

		return true;
	}
}
