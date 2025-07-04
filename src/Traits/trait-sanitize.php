<?php
namespace Burst\Traits;

/**
 * Trait containing sanitization methods for consistent data cleaning throughout the application.
 */
trait Sanitize {

	/**
	 * Sanitize filters for statistics queries.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	public function sanitize_filters( array $filters ): array {
		// Filter out false or empty values, except zeros.
		$filters = array_filter(
			$filters,
			static function ( $item ) {
				// Keep values that are not false and not empty string, OR are exactly zero (int or string).
				if ( $item === 0 || $item === '0' ) {
					return true;
				}
				return $item !== false && $item !== '';
			}
		);

		$filter_config = $this->filter_validation_config();
		// Sanitize keys and values.
		$output = [];
		foreach ( $filters as $key => $value ) {
			$key = sanitize_text_field( $key );

			// Handle array values.
			if ( is_array( $value ) ) {
				$output[ $key ] = $this->sanitize_filters( $value );
				continue;
			}

			// Handle special filter cases with specific sanitization rules.
			if ( isset( $filter_config[ $key ] ) && isset( $filter_config[ $key ]['sanitize'] ) ) {
				$sanitize_function = $filter_config[ $key ]['sanitize'];

				// Handle callable sanitization functions (including class methods).
				if ( is_callable( $sanitize_function ) ) {
					try {
						$output[ $key ] = call_user_func( $sanitize_function, $value );
					} catch ( \Exception $e ) {
						static::error_log( 'Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} elseif ( is_callable( [ $this, $sanitize_function ] ) ) {
					try {
						$output[ $key ] = call_user_func( [ $this, $sanitize_function ], $value );
					} catch ( \Exception $e ) {
						static::error_log( 'Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} else {
					// Fallback to default sanitization.
					static::error_log( 'Sanitization function not found for filter: ' . $key );
					$output[ $key ] = is_numeric( $value ) ? $value : sanitize_text_field( $value );
				}
			} else {
				// Default sanitization for values that don't have specific rules.
				$output[ $key ] = is_numeric( $value ) ? (int) $value : sanitize_text_field( $value );
			}
		}

		return $output;
	}

	/**
	 * Sanitize a metric against list of allowed metrics.
	 *
	 * @param string $metric The metric to sanitize.
	 * @return string Sanitized metric.
	 */
	public function sanitize_metric( string $metric ): string {
		$metric = sanitize_text_field( $metric );

		$allowed_metrics = $this->metric_keys();
		$default_metric  = $this->default_metric();

		if ( in_array( $metric, $allowed_metrics, true ) ) {
			return $metric;
		}

		return $default_metric;
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
	 * Sanitize group_by parameters.
	 *
	 * @param array $group_by Group by parameters to sanitize.
	 * @return array<string> Sanitized group_by array.
	 */
	public function sanitize_group_by( array $group_by ): array {
		$allowed_metrics    = $this->metric_keys();
		$sanitized_group_by = [];

		foreach ( $group_by as $field ) {
			$field = sanitize_text_field( trim( $field ) );

			// Only allow valid metric fields for group_by.
			if ( in_array( $field, $allowed_metrics, true ) ) {
				$sanitized_group_by[] = $field;
			}
		}

		// Remove duplicates and return.
		return array_unique( $sanitized_group_by );
	}

	/**
	 * Sanitize a relative URL, ensuring it starts with a slash and doesn't contain the domain.
	 *
	 * @param string $url URL to sanitize.
	 * @return string Sanitized URL.
	 */
	public function sanitize_relative_url( string $url ): string {
		$url = sanitize_text_field( $url );
		if ( empty( $url ) ) {
			return '/';
		}

		// Remove protocol and domain if present (make URL relative).
		$url_without_protocol = preg_replace( '(^https?://)', '', $url );
		if ( $url_without_protocol !== $url ) {
			// URL had a protocol, so also remove the domain.
			$parts = explode( '/', $url_without_protocol, 2 );
			if ( count( $parts ) === 2 ) {
				$url = '/' . $parts[1];
			} else {
				$url = '/';
			}
		}

		// Ensure URL starts with a slash.
		if ( strpos( $url, '/' ) !== 0 ) {
			$url = '/' . $url;
		}

		return trailingslashit( filter_var( $url, FILTER_SANITIZE_URL ) );
	}

	/**
	 * Sanitize an IP field, with each IP on a new line.
	 *
	 * @param string $value The IP field value to sanitize.
	 * @return string Sanitized IP field.
	 */
	public function sanitize_ip_field( string $value ): string {
		if ( ! $this->user_can_manage() ) {
			return '';
		}

		$ips = explode( PHP_EOL, $value );
		// Remove whitespace.
		$ips = array_map( 'trim', $ips );
		$ips = array_filter(
			$ips,
			function ( $line ) {
				return $line !== '';
			}
		);
		// Remove duplicates.
		$ips = array_unique( $ips );
		// Sanitize each ip.
		$ips = array_map( 'sanitize_text_field', $ips );
		return implode( PHP_EOL, $ips );
	}

	/**
	 * Sanitize a field value based on its type.
	 *
	 * @param mixed  $value The value to sanitize.
	 * @param string $type The field type.
	 * @return mixed Sanitized value.
	 */
	public function sanitize_field( $value, string $type ) {
		$type = $this->sanitize_field_type( $type );

		switch ( $type ) {
			case 'checkbox':
			case 'hidden':
				return (int) $value;
			case 'checkbox_group':
			case 'user_role_blocklist':
				if ( ! is_array( $value ) ) {
					$value = [];
				}
				return array_map( 'sanitize_text_field', $value );
			case 'email':
				return sanitize_email( $value );
			case 'number':
				return (int) $value;
			case 'ip_blocklist':
				return $this->sanitize_ip_field( $value );
			case 'email_reports':
				return $this->sanitize_email_reports( $value );
			case 'license':
				return defined( 'BURST_PRO' ) && class_exists( '\\Burst\\Pro\\Licensing\\Licensing' ) ? ( new \Burst\Pro\Licensing\Licensing() )->sanitize_license( $value ) : '';
			default:
				return sanitize_text_field( $value );
		}
	}

	/**
	 * Sanitize type against list of allowed field types.
	 *
	 * @param string $type The field type to sanitize.
	 * @return string Sanitized field type.
	 */
	public function sanitize_field_type( string $type ): string {
		$types   = $this->allowed_field_types();
		$default = $this->default_field_type();

		if ( in_array( $type, $types, true ) ) {
			return $type;
		}

		return $default;
	}

	/**
	 * Sanitize a status.
	 *
	 * @param string $status The status to sanitize.
	 * @return string Sanitized status.
	 */
	public function sanitize_status( string $status ): string {
		$statuses = $this->allowed_goal_statuses();
		$default  = $this->default_status();

		if ( in_array( $status, $statuses, true ) ) {
			return $status;
		}

		return $default;
	}

	/**
	 * Sanitize an interval string.
	 *
	 * @param string $interval The interval to sanitize.
	 * @return string Sanitized interval.
	 */
	public function sanitize_interval( string $interval ): string {
		$intervals = $this->allowed_intervals();
		$default   = $this->default_interval();

		if ( in_array( $interval, $intervals, true ) ) {
			return $interval;
		}

		return $default;
	}

	/**
	 * Sanitize a goal metric.
	 *
	 * @param string $metric The goal metric to sanitize.
	 * @return string Sanitized goal metric.
	 */
	public function sanitize_goal_conversion_metric( string $metric ): string {
		$metrics = $this->allowed_goal_metrics();
		$default = $this->default_goal_metric();

		if ( in_array( $metric, $metrics, true ) ) {
			return $metric;
		}

		return $default;
	}

	/**
	 * Sanitize archive status.
	 *
	 * @param string $status The archive status to sanitize.
	 * @return string Sanitized archive status.
	 */
	public function sanitize_archive_status( string $status ): string {
		$statuses = $this->allowed_archive_statuses();
		$default  = $this->default_archive_status();

		if ( in_array( $status, $statuses, true ) ) {
			return $status;
		}

		return $default;
	}

	/**
	 * Sanitize lookup table type.
	 *
	 * @param string $type The lookup table type to sanitize.
	 * @return string Sanitized lookup table type.
	 */
	public function sanitize_lookup_table_type( string $type ): string {
		$types   = $this->allowed_lookup_table_types();
		$default = $this->default_lookup_table_type();

		if ( in_array( $type, $types, true ) ) {
			return $type;
		}

		return $default;
	}

	/**
	 * Sanitize a collection of email reports.
	 *
	 * @param array $email_reports Array of email reports to sanitize.
	 * @return array<array<string, mixed>> Sanitized email reports.
	 */
	public function sanitize_email_reports( array $email_reports ): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		$sanitized_email_reports = [];
		foreach ( $email_reports as $report ) {
			if ( ! isset( $report['email'] ) ) {
				continue;
			}

			$sanitized_report          = [];
			$sanitized_report['email'] = sanitize_email( $report['email'] );
			if ( isset( $report['frequency'] ) ) {
				$sanitized_report['frequency'] = sanitize_text_field( $report['frequency'] );
			}
			$sanitized_email_reports[] = $sanitized_report;
		}

		return $sanitized_email_reports;
	}

	/**
	 * Sanitize URL components for tracking.
	 *
	 * @param string|null $url URL to sanitize.
	 * @return array<string, string> Sanitized URL components.
	 */
	public function sanitize_url( ?string $url ): array {
		$url_destructured = [
			'scheme'     => 'https',
			'host'       => '',
			'path'       => '',
			'parameters' => '',
		];

		if ( empty( $url ) ) {
			return $url_destructured;
		}

		if ( ! function_exists( 'wp_kses_bad_protocol' ) ) {
			require_once ABSPATH . '/wp-includes/kses.php';
		}

		$sanitized_url = filter_var( $url, FILTER_SANITIZE_URL );
		// Validate the URL.
		if ( ! filter_var( $sanitized_url, FILTER_VALIDATE_URL ) ) {
			return $url_destructured;
		}

		// We don't use wp_parse_url so we don't need to load an additional wp file.
		$url = wp_parse_url( esc_url_raw( $sanitized_url ) );
		if ( isset( $url['host'] ) ) {
			$url_destructured['host']        = $url['host'];
			$url_destructured['scheme']      = $url['scheme'];
			$url_destructured['path']        = trailingslashit( $url['path'] );
			$url_destructured['parameters']  = $url['query'] ?? '';
			$url_destructured['parameters'] .= $url['fragment'] ?? '';
		}

		return $url_destructured;
	}

	/**
	 * Sanitize a user ID.
	 *
	 * @param string|null $uid User ID to sanitize.
	 * @return string Sanitized user ID.
	 */
	public function sanitize_uid( ?string $uid ): string {
		if ( $uid === null || strlen( $uid ) === 0 || ! preg_match( '/^[a-z0-9-]*/', $uid ) ) {
			return '';
		}

		return $uid;
	}

	/**
	 * Sanitize a fingerprint.
	 *
	 * @param string|null $fingerprint Fingerprint to sanitize.
	 * @return string Sanitized fingerprint.
	 */
	public function sanitize_fingerprint( ?string $fingerprint ): string {
		if ( $fingerprint === null || strlen( $fingerprint ) === 0 || ! preg_match( '/^[a-z0-9-]*/', $fingerprint ) ) {
			return '';
		}

		return 'f-' . $fingerprint;
	}

	/**
	 * Sanitize a referrer URL.
	 *
	 * @param string|null $referrer Referrer URL to sanitize.
	 * @return string Sanitized referrer URL.
	 */
	public function sanitize_referrer( ?string $referrer ): string {
		if ( empty( $referrer ) ) {
			return '';
		}

		if ( ! defined( 'BURST_PATH' ) ) {
			$dir     = plugin_dir_path( __FILE__ );
			$src_pos = strpos( $dir, '/src/' );
			$dir     = $src_pos !== false ? substr( $dir, 0, $src_pos + 1 ) : $dir;
			define( 'BURST_PATH', $dir );
		}

		$referrer = filter_var( $referrer, FILTER_SANITIZE_URL );
		// We use wp_parse_url so we don't need to load a wp file here.
		$referrer_host = wp_parse_url( $referrer, PHP_URL_HOST );
		$current_host  = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'];

		// Don't track if referrer is the same as current host.
		// If referrer_url starts with current_host, then it is not a referrer.
		if ( empty( $referrer_host ) || strpos( $referrer_host, $current_host ) === 0 ) {
			return '';
		}

		$ref_spam_list = file( BURST_PATH . 'helpers/referrer-spam-list/spammers.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
		$ref_spam_list = apply_filters( 'burst_referrer_spam_list', $ref_spam_list );
		if ( array_search( $referrer_host, $ref_spam_list, true ) ) {
			return 'spammer';
		}

		if ( ! function_exists( 'wp_kses_bad_protocol' ) ) {
			require_once ABSPATH . '/wp-includes/kses.php';
		}

		return $referrer ? trailingslashit( esc_url_raw( $referrer ) ) : '';
	}

	/**
	 * Sanitize time on page.
	 *
	 * @param string|null $time_on_page Time on page to sanitize.
	 * @return int Sanitized time on page.
	 */
	public function sanitize_time_on_page( ?string $time_on_page ): int {
		return (int) $time_on_page;
	}

	/**
	 * Sanitize completed goal IDs.
	 *
	 * @param array $completed_goals Array of completed goal IDs.
	 * @return array<int> Sanitized array of completed goal IDs.
	 */
	public function sanitize_completed_goal_ids( array $completed_goals ): array {
		if ( ! method_exists( $this, 'get_active_goals_ids' ) ) {
			// If method doesn't exist in this context, sanitize to integers only.
			return array_map( 'absint', array_filter( $completed_goals, 'is_numeric' ) );
		}

		// Only keep active goals ids.
		$completed_goals = array_intersect( $completed_goals, $this->get_active_goals_ids() );
		// Remove duplicates.
		$completed_goals = array_unique( $completed_goals );
		// Make sure all values are integers.
		return array_map( 'absint', $completed_goals );
	}

	/**
	 * Sanitize date string for use in date queries.
	 *
	 * @param string|null $date Date string to sanitize (expected format: Y-m-d).
	 * @return string Sanitized date string in Y-m-d format or empty string if invalid.
	 */
	public function sanitize_date( ?string $date ): string {
		if ( empty( $date ) ) {
			return '';
		}

		// Remove any non-date characters and trim.
		$date = trim( sanitize_text_field( $date ) );

		// Try to create DateTime object from Y-m-d format.
		$datetime = \DateTime::createFromFormat( 'Y-m-d H:i:s', $date );
		// Check if the date was parsed successfully and matches the input exactly.
		if ( ! $datetime || $datetime->format( 'Y-m-d H:i:s' ) !== $date ) {
			return '';
		}

		// Return the unix timestamp as string instead of int.
		return (string) \Burst\Admin\Statistics\Statistics::convert_date_to_unix( $datetime->format( 'Y-m-d H:i:s' ) );
	}

	/**
	 * Sanitize argument based on its type.
	 *
	 * @param string $arg The argument name.
	 * @param mixed  $value The value to sanitize.
	 * @return mixed Sanitized value.
	 */
	public function sanitize_arg( string $arg, $value ) {
		// Smart array transformation helper - only transforms when value is clearly meant to be an array.
		$ensure_array_if_applicable = function ( $input ) {
			if ( is_array( $input ) ) {
				return $input;
			}
			if ( is_string( $input ) ) {
				// Try JSON decode first - if it's valid JSON array, transform it.
				$decoded = json_decode( $input, true );
				if ( is_array( $decoded ) ) {
					return $decoded;
				}
				// Only transform to comma-separated if it contains commas (indicating multiple values).
				if ( strpos( $input, ',' ) !== false ) {
					return array_map( 'trim', explode( ',', $input ) );
				}
				// Single string value - return as-is.
				return $input;
			}
			// Return other types (int, etc.) as-is.
			return $input;
		};

		switch ( $arg ) {
			case 'filters':
				$array_value = $ensure_array_if_applicable( $value );
				return $this->sanitize_filters( is_array( $array_value ) ? $array_value : [] );
			case 'metrics':
				$array_value = $ensure_array_if_applicable( $value );
				return $this->sanitize_metrics( is_array( $array_value ) ? $array_value : [ $array_value ] );
			case 'goal_id':
				return absint( $value );
			case 'group_by':
				$array_value = $ensure_array_if_applicable( $value );
				return $this->sanitize_group_by( is_array( $array_value ) ? $array_value : [ $array_value ] );
			case 'date_start':
				return $this->sanitize_date( $value . ' 00:00:00' );
			case 'date_end':
				return $this->sanitize_date( $value . ' 23:59:59' );
			default:
				// Allow other plugins/extensions to handle custom argument sanitization.
				// Apply smart transformation for consistent filter interface.
				$processed_value = $ensure_array_if_applicable( $value );
				$sanitized_value = apply_filters( 'burst_sanitize_arg', null, $arg, $processed_value );
				if ( $sanitized_value !== null ) {
					return $sanitized_value;
				}
				static::error_log( 'sanitize_arg arg not found: ' . $arg . ' with value: ' . wp_json_encode( $value ) );
				return '';
		}
	}

	/**
	 * Process and sanitize request arguments for data requests.
	 *
	 * @param \WP_REST_Request $request The REST request object.
	 * @param string           $type The data type being requested.
	 * @param array            $base_args Base arguments to include in the result.
	 * @return array<string, mixed> Sanitized arguments from the request.
	 */
	public function sanitize_request_args( \WP_REST_Request $request, string $type, array $base_args = [] ): array {
		$available_args = $this->get_data_available_args( $type );

		foreach ( $available_args as $arg ) {
			if ( $request->get_param( $arg ) ) {
				$base_args[ $arg ] = $this->sanitize_arg( $arg, $request->get_param( $arg ) );
			}
		}
		return $base_args;
	}


	/**
	 * Configuration file for validation rules
	 * These values define valid options for various fields throughout the application
	 * All values can be filtered using WordPress hooks
	 */

	/**
	 * Allowed metric types with translations
	 *
	 * @return array<string, string> List of valid metric names with translations
	 */
	public function allowed_metrics(): array {
		return apply_filters(
			'burst_allowed_metrics',
			[
				'page_url'             => __( 'Page URL', 'burst-statistics' ),
				'referrer'             => __( 'Referrer', 'burst-statistics' ),
				'pageviews'            => __( 'Pageviews', 'burst-statistics' ),
				'sessions'             => __( 'Sessions', 'burst-statistics' ),
				'visitors'             => __( 'Visitors', 'burst-statistics' ),
				'avg_time_on_page'     => __( 'Time on page', 'burst-statistics' ),
				'avg_session_duration' => __( 'Avg. Session Duration', 'burst-statistics' ),
				'conversion_rate'      => __( 'Conversion Rate', 'burst-statistics' ),
				'first_time_visitors'  => __( 'New visitors', 'burst-statistics' ),
				'conversions'          => __( 'Conversions', 'burst-statistics' ),
				'bounces'              => __( 'Bounces', 'burst-statistics' ),
				'bounce_rate'          => __( 'Bounce rate', 'burst-statistics' ),
				'device'               => __( 'Device', 'burst-statistics' ),
				'browser'              => __( 'Browser', 'burst-statistics' ),
				'platform'             => __( 'Platform', 'burst-statistics' ),
				'device_id'            => __( 'Device', 'burst-statistics' ),
				'browser_id'           => __( 'Browser', 'burst-statistics' ),
				'platform_id'          => __( 'Platform', 'burst-statistics' ),
			]
		);
	}

	/**
	 * Default metric (fallback when an invalid metric is provided)
	 *
	 * @return string Default metric name
	 */
	public function default_metric(): string {
		return apply_filters( 'burst_default_metric', 'pageviews' );
	}

	/**
	 * Allowed goal statuses
	 *
	 * @return array<int, string> List of valid goal statuses
	 */
	public function allowed_goal_statuses(): array {
		return apply_filters(
			'burst_allowed_goal_statuses',
			[
				'all',
				'active',
				'inactive',
				'archived',
			]
		);
	}

	/**
	 * Default status (fallback when an invalid status is provided)
	 *
	 * @return string Default status
	 */
	public function default_status(): string {
		return apply_filters( 'burst_default_status', 'inactive' );
	}

	/**
	 * Allowed field types
	 *
	 * @return array<int, string> List of valid field types
	 */
	public function allowed_field_types(): array {
		return apply_filters(
			'burst_allowed_field_types',
			[
				'hidden',
				'database',
				'checkbox',
				'radio',
				'text',
				'textarea',
				'number',
				'email',
				'select',
				'ip_blocklist',
				'email_reports',
				'user_role_blocklist',
				'checkbox_group',
				'license',
			]
		);
	}

	/**
	 * Default field type (fallback when an invalid field type is provided)
	 *
	 * @return string Default field type
	 */
	public function default_field_type(): string {
		return apply_filters( 'burst_default_field_type', 'checkbox' );
	}

	/**
	 * Allowed interval types
	 *
	 * @return array<int, string> List of valid interval types
	 */
	public function allowed_intervals(): array {
		return apply_filters(
			'burst_allowed_intervals',
			[
				'hour',
				'day',
				'week',
				'month',
			]
		);
	}

	/**
	 * Default interval (fallback when an invalid interval is provided)
	 *
	 * @return string Default interval
	 */
	public function default_interval(): string {
		return apply_filters( 'burst_default_interval', 'day' );
	}

	/**
	 * Allowed goal metric types
	 *
	 * @return array<int, string> List of valid goal metric names
	 */
	public function allowed_goal_metrics(): array {
		return apply_filters(
			'burst_allowed_goal_metrics',
			[
				'pageviews',
				'visitors',
				'sessions',
			]
		);
	}

	/**
	 * Default goal metric (fallback when an invalid goal metric is provided)
	 *
	 * @return string Default goal metric
	 */
	public function default_goal_metric(): string {
		return apply_filters( 'burst_default_goal_metric', 'pageviews' );
	}

	/**
	 * Allowed archive statuses
	 *
	 * @return array<int, string> List of valid archive statuses
	 */
	public function allowed_archive_statuses(): array {
		return apply_filters(
			'burst_allowed_archive_statuses',
			[
				'archived',
				'restored',
				'archiving',
				'deleted',
			]
		);
	}

	/**
	 * Default archive status
	 *
	 * @return string Default archive status
	 */
	public function default_archive_status(): string {
		return apply_filters( 'burst_default_archive_status', 'archived' );
	}

	/**
	 * Allowed lookup table types
	 *
	 * @return array<int, string> List of valid lookup table types
	 */
	public function allowed_lookup_table_types(): array {
		return apply_filters(
			'burst_allowed_lookup_table_types',
			[
				'browser',
				'browser_version',
				'device',
				'platform',
			]
		);
	}

	/**
	 * Default lookup table type
	 *
	 * @return string Default lookup table type
	 */
	public function default_lookup_table_type(): string {
		return apply_filters( 'burst_default_lookup_table_type', 'browser' );
	}

	/**
	 * Configuration for filter validation
	 *
	 * @return array<string, array<string, string>> Filter validation configuration
	 */
	public function filter_validation_config(): array {
		return apply_filters(
			'burst_filter_validation_config',
			[
				'goal_id'  => [
					'sanitize' => 'absint',
					'type'     => 'int',
				],
				'page_id'  => [
					'sanitize' => 'absint',
					'type'     => 'int',
				],
				'page_url' => [
					'sanitize' => 'sanitize_text_field',
					'type'     => 'string',
				],
				'referrer' => [
					'sanitize' => 'sanitize_text_field',
					'type'     => 'string',
				],
				'device'   => [
					'sanitize' => 'sanitize_device_filter',
					'type'     => 'string',
				],
				'browser'  => [
					'sanitize' => 'sanitize_text_field',
					'type'     => 'string',
				],
				'platform' => [
					'sanitize' => 'sanitize_text_field',
					'type'     => 'string',
				],
			]
		);
	}

	/**
	 * Sanitize device filter value
	 *
	 * @param string $device Device value to sanitize.
	 * @return string Sanitized device value
	 */
	public function sanitize_device_filter( string $device ): string {
		$device          = sanitize_text_field( $device );
		$allowed_devices = [ 'desktop', 'tablet', 'mobile', 'other' ];

		if ( in_array( $device, $allowed_devices, true ) ) {
			return $device;
		}

		return '';
	}

	/**
	 * Allowed goal types
	 *
	 * This function returns an array of allowed goal types
	 * It uses the goal_fields configuration to extract valid goal types
	 *
	 * @return array<int, string> List of valid goal types
	 */
	public function allowed_goal_types(): array {
		// Get the goal types from the goal_fields array, which is dynamically built.
		// This ensures we always have the most up-to-date list.
		$fields = require_once __DIR__ . '/goal-fields.php';

		// Find the type field in the goal fields.
		$type_field = array_filter(
			$fields,
			static function ( $goal ) {
				return isset( $goal['id'] ) && $goal['id'] === 'type';
			}
		);

		$type_field = reset( $type_field );
		$goal_types = isset( $type_field['options'] ) ? array_keys( $type_field['options'] ) : [ 'clicks' ];

		return apply_filters( 'burst_allowed_goal_types', $goal_types );
	}

	/**
	 * Default goal type (fallback when an invalid goal type is provided)
	 *
	 * @return string Default goal type
	 */
	public function default_goal_type(): string {
		return apply_filters( 'burst_default_goal_type', 'clicks' );
	}

	/**
	 * Get just the metric keys for validation purposes
	 *
	 * @return array<int, string> List of valid metric keys
	 */
	public function metric_keys(): array {
		return array_keys( $this->allowed_metrics() );
	}

	/**
	 * Get available arguments for a specific data type
	 *
	 * @param string $type The data type for which to get available arguments.
	 * @return array<int, string> List of available arguments for the specified data type
	 */
	public function get_data_available_args( string $type ): array {
		$default_args = [ 'filters', 'metrics', 'group_by', 'goal_id', 'date_start', 'date_end' ];

		// Allow filtering of available args by type.
		return apply_filters( 'burst_get_data_available_args', $default_args, $type );
	}
}
