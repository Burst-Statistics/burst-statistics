<?php
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die();

/**
 * Query_Data class for building complex SQL queries.
 *
 * This class provides a structured way to build SQL queries for the Burst Statistics plugin.
 * It supports filtering, grouping, ordering, custom WHERE clauses, and more.
 */
class Query_Data {
	use Sanitize;
	use Admin_Helper;

	/**
	 * Strict mode - limits available options for frontend/non-privileged users
	 *
	 * @var bool $strict Whether strict mode is enabled.
	 */
	private bool $strict;

	/**
	 * Store allowed metrics for reuse
	 *
	 * @var array<string,string>
	 */
	private array $allowed_metrics;

	/**
	 * Store allowed filter keys for reuse
	 *
	 * @var array<string>
	 */
	private array $allowed_filter_keys;

	/**
	 * Store allowed group_by values
	 *
	 * @var array<string>
	 */
	private array $allowed_group_by;

	/**
	 * Store allowed order_by values
	 *
	 * @var array<string>
	 */
	private array $allowed_order_by;

	/**
	 * Start date for the query (timestamp).
	 *
	 * @var int $date_start Start date for the query (timestamp).
	 */
	public int $date_start = 0;

	/**
	 * End date for the query (timestamp).
	 *
	 * @var int $date_end End date for the query (timestamp).
	 */
	public int $date_end = 0;

	/**
	 * Selected metrics for the query.
	 *
	 * @var array $select Metrics to select in the query.
	 */
	public array $select = [ '*' ];

	/**
	 * Filters for the query.
	 *
	 * @var array $filters Filters to apply in the query.
	 */
	public array $filters = [];

	/**
	 * Group by clause for the query.
	 *
	 * @var string[] $group_by Group by clause for the query.
	 */
	public array $group_by = [];

	/**
	 * Order by clause for the query.
	 *
	 * @var string[] $order_by Order by clause for the query.
	 */
	public array $order_by = [];

	/**
	 * Offset for the query results.
	 *
	 * @var int $offset Offset for the query results.
	 */
	public int $limit = 0;

	/**
	 * Joins for the query.
	 *
	 * @var array $joins Additional JOIN clauses for the query.
	 */
	public array $joins = [];

	/**
	 * Date modifiers for the query.
	 *
	 * @var array $date_modifiers Date modifiers for the query.
	 */
	public array $date_modifiers = [];

	/**
	 * Having clauses for the query.
	 *
	 * @var array $having HAVING clauses for the query.
	 */
	public array $having = [];

	/**
	 * Custom SELECT clause for the query.
	 *
	 * @var string $custom_select Custom SELECT clause for the query.
	 */
	public string $custom_select = '';

	/**
	 * Custom WHERE clause for the query.
	 *
	 * @var string $custom_where Custom WHERE clause for the query.
	 */
	public string $custom_where = '';

	public array $custom_where_parameters  = [];
	public array $custom_select_parameters = [];

	/**
	 * Subquery for the query.
	 *
	 * @var string $subquery Subquery for the query.
	 */
	public string $subquery = '';

	/**
	 * UNION clauses for the query.
	 *
	 * @var array $union UNION clauses for the query.
	 */
	public array $union = [];

	/**
	 * Distinct flag for the query.
	 *
	 * @var bool $distinct Whether to use DISTINCT in the query.
	 */
	public bool $distinct = false;

	/**
	 * Window functions for the query.
	 *
	 * @var array $window Window functions for the query.
	 */
	public array $window = [];

	/**
	 * Exclude bounces flag for the query.
	 *
	 * @var bool $exclude_bounces Whether to exclude bounces from the query.
	 */
	public bool $exclude_bounces = false;
	/**
	 * List of metrics and labels.
	 *
	 * @var array $metrics Array of metrics with labels.
	 */
	public array $metrics = [];
	/**
	 * Metric keys that are allowed in strict mode (frontend).
	 *
	 * @var array $strict_metric_keys Metric keys that are allowed in strict mode (frontend).
	 */
	private array $strict_metric_keys = [
		'pageviews',
		'visitors',
		'sessions',
		'bounce_rate',
		'avg_time_on_page',
		'first_time_visitors',
		'page_url',
		'referrer',
		'device',
	];

	/**
	 * Constructor to initialize the Query_Data object with sanitizing arguments.
	 *
	 * @param array $args   Associative array of query parameters matching public properties.
	 */
	public function __construct( array $args = [] ) {
		$this->strict  = ! $this->has_admin_access();
		$this->metrics = [
			'host'                 => 'Domain',
			'page_url'             => 'Page',
			'referrer'             => 'Referrer',
			'pageviews'            => 'Pageviews',
			'sessions'             => 'Sessions',
			'visitors'             => 'Visitors',
			'avg_time_on_page'     => 'Avg. time on page',
			'avg_session_duration' => 'Avg. session duration',
			'conversion_rate'      => 'Goal conv. rate',
			'first_time_visitors'  => 'New visitors',
			'conversions'          => 'Goal completions',
			'bounces'              => 'Bounced visitors',
			'bounce_rate'          => 'Bounce rate',
			'device'               => 'Device',
			'browser'              => 'Browser',
			'platform'             => 'Platform',
			'device_id'            => 'Device',
			'browser_id'           => 'Browser',
			'platform_id'          => 'Platform',
			'count'                => 'Count',
			'period'               => 'Period',
			'active_time'          => 'Active time',
			'time_on_page'         => 'Time on page',
			'time'                 => 'Time',
			'uid'                  => 'UID',
			'page_id'              => 'Page ID',

		];
		$this->initialize_allowlists();

		// these parameters are used for prepared statements in custom SQL clauses.
		$this->custom_where_parameters  = isset( $args['custom_where_parameters'] ) && is_array( $args['custom_where_parameters'] ) ? $args['custom_where_parameters'] : [];
		$this->custom_select_parameters = isset( $args['custom_select_parameters'] ) && is_array( $args['custom_select_parameters'] ) ? $args['custom_select_parameters'] : [];

		if ( ! empty( $args ) ) {
			foreach ( $args as $key => $value ) {
				if ( ! property_exists( $this, $key ) ) {
					$this::error_log( "QueryData error: Invalid property '$key' in Query_Data class. Please check your arguments." );
					continue;
				}

				$this->assign_property( $key, $value );
			}

			$this->exclude_bounces = $this->exclude_bounces();
		}
	}

	/**
	 * Initialize allowlists based on strict mode
	 */
	private function initialize_allowlists(): void {
		$this->initialize_allowed_metrics();
		$this->initialize_allowed_filter_keys();
		$this->initialize_allowed_group_by();
		$this->initialize_allowed_order_by();
	}

	/**
	 * Get allowed metrics based on strict mode
	 */
	private function initialize_allowed_metrics(): void {
		$metrics = $this->metrics;
		if ( $this->is_strict() ) {
			$keys    = apply_filters( 'burst_allowed_metric_keys', $this->strict_metric_keys, $this->is_strict() );
			$metrics = array_intersect_key( $metrics, array_flip( $keys ) );
		}

		$this->allowed_metrics = apply_filters( 'burst_allowed_metrics', $metrics, $this->is_strict() );
	}

	/**
	 * Get allowed filter keys based on strict mode
	 */
	private function initialize_allowed_filter_keys(): void {
		$keys = [
			'page_type',
			'page_id',
			'page_url',
			'referrer',
			'device',
			'browser',
			'platform',
		];

		if ( ! $this->is_strict() ) {
			$extra = [
				'goal_id',
				'bounces',
				'new_visitor',
				'device_id',
				'browser_id',
				'platform_id',
			];

			$keys = array_merge( $keys, $extra );
		}

		$this->allowed_filter_keys = apply_filters( 'burst_statistics_allowed_filter_keys', $keys, $this->is_strict() );
	}

	/**
	 * Get allowed group_by values based on strict mode
	 */
	private function initialize_allowed_group_by(): void {
		if ( $this->is_strict() ) {
			$group_by = [
				'page_type',
				'page_id',
				'page_url',
				'referrer',
				'device',
				'browser',
				'platform',
				'period',
				'continent_code',
			];
		} else {
			$group_by   = $this->get_allowed_metrics();
			$group_by[] = 'period';
		}

		$this->allowed_group_by = apply_filters( 'burst_statistics_allowed_group_by', $group_by, $this->is_strict() );
	}

	/**
	 * Get allowed order_by values based on strict mode
	 */
	private function initialize_allowed_order_by(): void {

		$metrics  = $this->get_allowed_metrics();
		$order_by = [];
		foreach ( $metrics as $metric ) {
			$order_by[] = $metric . ' DESC';
			$order_by[] = $metric . ' ASC';
			$order_by[] = $metric;
		}

		$this->allowed_order_by = apply_filters( 'burst_statistics_allowed_order_by', $order_by, $this->is_strict() );
	}

	/**
	 * Assign and sanitize a property value.
	 *
	 * @param string $key   Property name.
	 * @param mixed  $value Property value.
	 */
	private function assign_property( string $key, mixed $value ): void {
		if ( $key === 'filters' ) {
			$this->filters = $this->sanitize_filters( is_array( $value ) ? $value : [] );
			return;
		}

		if ( $key === 'select' ) {
			$this->select = $this->sanitize_metrics( is_array( $value ) ? $value : [ $value ] );
			return;
		}

		if ( $key === 'custom_where' && ! $this->strict ) {
			$this->custom_where = $this->get_prepared_custom_sql( $value, 'where' );
			return;
		}

		if ( $key === 'custom_select' && ! $this->strict ) {
			$this->custom_select = $this->get_prepared_custom_sql( $value, 'select' );
			return;
		}

		if ( $key === 'group_by' ) {
			$array_values   = $this->ensure_array_if_applicable( $value );
			$this->group_by = $this->sanitize_group_by( is_array( $array_values ) ? $array_values : [ $array_values ] );
			return;
		}

		if ( $key === 'order_by' ) {
			$array_values   = $this->ensure_array_if_applicable( $value );
			$this->order_by = is_array( $array_values ) ? $array_values : [ $array_values ];
			$this->order_by = $this->validate_order_by( $this->order_by );
			return;
		}

		if ( $key === 'date_modifiers' ) {
			$this->date_modifiers = $value;
			return;
		}

		if ( is_array( $value ) ) {
			$this->$key = $this->sanitize_array_values( $value );
		} elseif ( is_string( $value ) ) {
			$this->$key = esc_sql( $value );
		} elseif ( is_int( $value ) ) {
			$this->$key = absint( $value );
		} elseif ( is_bool( $value ) || is_float( $value ) ) {
			$this->$key = $value;
		} else {
			static::error_log( 'QueryData error: sanitize_arg arg not found: ' . $key . ' with value: ' . wp_json_encode( $value ) );
		}
	}

	/**
	 * Flexibly sanitize filters for statistics queries.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	public function sanitize_filters_flexibly( array $filters ): array {
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
						static::error_log( 'QueryData error: Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} elseif ( is_callable( [ $this, $sanitize_function ] ) ) {
					try {
						$output[ $key ] = call_user_func( [ $this, $sanitize_function ], $value );
					} catch ( \Exception $e ) {
						static::error_log( 'QueryData error: Error sanitizing filter ' . $key . ': ' . $e->getMessage() );
						$output[ $key ] = sanitize_text_field( $value );
					}
				} else {
					// Fallback to default sanitization.
					static::error_log( 'QueryData error: Sanitization function not found for filter: ' . $key );
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
	 * Strictly sanitize filters for statistics queries.
	 *
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	private function sanitize_filters_strictly( array $filters ): array {
		// Filter out false or empty values.
		$filters = array_filter(
			$filters,
			function ( $item ) {
				return $item !== false && $item !== '';
			}
		);

		// Sanitize keys and values and limit to allowed keys.
		$sanitized = [];
		foreach ( $filters as $key => $value ) {
			// Only allow filters with whitelisted keys.
			if ( in_array( $key, $this->get_allowed_filter_keys(), true ) ) {
				$sanitized_key = sanitize_key( $key );

				// Use appropriate sanitization based on filter type.
				switch ( $key ) {
					case 'page_url':
						// For URLs, use wp_parse_url to extract path component.
						$parsed_url      = wp_parse_url( $value, PHP_URL_PATH );
						$sanitized_value = ( $parsed_url !== false && $parsed_url !== null ) ? $parsed_url : sanitize_text_field( $value );
						break;
					case 'referrer':
						// For referrers, sanitize as URL.
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
						// For device/browser/platform, use sanitize_key for consistency.
						$sanitized_value = sanitize_key( $value );
						break;
					default:
						// Default to text field sanitization.
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
	 * @param array $filters Array of filters to sanitize.
	 * @return array<string, mixed> Sanitized filters.
	 */
	public function sanitize_filters( array $filters ): array {
		if ( $this->is_strict() ) {
			return $this->sanitize_filters_strictly( $filters );
		} else {
			return $this->sanitize_filters_flexibly( $filters );
		}
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

		$allowed_metrics = $this->get_allowed_metrics();
		$default_metric  = $this->default_metric();

		if ( in_array( $metric, $allowed_metrics, true ) ) {
			return $metric;
		} else {
			self::error_log( "QueryData error: Metric '$metric' is not allowed. Returning default metric '$default_metric'." );
		}

		return $default_metric;
	}

	/**
	 * Recursively sanitize array values.
	 *
	 * @param array $values Array to sanitize.
	 * @return array Sanitized array.
	 */
	private function sanitize_array_values( array $values ): array {
		foreach ( $values as $array_key => $array_value ) {
			if ( is_array( $array_value ) ) {
				$values[ $array_key ] = $this->sanitize_array_values( $array_value );
				continue;
			}

			if ( is_string( $array_value ) ) {
				$values[ $array_key ] = esc_sql( $array_value );
			}
		}

		return $values;
	}

	/**
	 * Sanitize device filter value
	 *
	 * @param string $device Device value to sanitize.
	 * @return string Sanitized device value
	 */
	public function sanitize_device_filter( string $device ): string {
		$allowed_devices = [ 'desktop', 'tablet', 'mobile', 'other' ];

		if ( in_array( $device, $allowed_devices, true ) ) {
			return $device;
		} else {
			self::error_log( "QueryData error: Device filter value '$device' is not allowed." );
		}

		return '';
	}

	/**
	 * Sanitize group_by parameters.
	 *
	 * @param array $group_by Group by parameters to sanitize.
	 * @return array<string> Sanitized group_by array.
	 */
	public function sanitize_group_by( array $group_by ): array {
		$allowed_group_by   = $this->get_allowed_group_by();
		$sanitized_group_by = [];

		foreach ( $group_by as $field ) {
			$field = sanitize_text_field( trim( $field ) );
			if ( empty( $field ) ) {
				continue;
			}
			// Only allow valid metric fields for group_by.
			if ( in_array( $field, $allowed_group_by, true ) ) {
				$sanitized_group_by[] = $field;
			} else {
				self::error_log( "QueryData error: Group by field '$field' is not allowed." );
			}
		}

		// Remove duplicates and return.
		return array_unique( $sanitized_group_by );
	}

	/**
	 * Validate group_by against allowlist.
	 *
	 * @param string|string[] $group_by Group by clause(s) to validate.
	 * @return string[] Validated group_by or empty array.
	 */
	public function validate_group_by( array|string $group_by ): array {
		// Normalize to array.
		$group_by = is_array( $group_by ) ? $group_by : [ $group_by ];

		$allowed   = $this->get_allowed_group_by();
		$validated = [];

		foreach ( $group_by as $item ) {
			$item = trim( (string) $item );
			if ( in_array( $item, $allowed, true ) ) {
				$validated[] = $item;
			}
		}

		return $validated;
	}

	/**
	 * Validate order_by against allowlist.
	 *
	 * @param string|string[] $order_by Order by clause(s) to validate.
	 * @return string[] Validated order_by or empty array.
	 */
	public function validate_order_by( array|string $order_by ): array {
		// Normalize to array.
		$order_by = is_array( $order_by ) ? $order_by : [ $order_by ];

		$allowed   = $this->get_allowed_order_by();
		$validated = [];

		foreach ( $order_by as $item ) {
			$item = trim( (string) $item );
			if ( empty( $item ) ) {
				continue;
			}
			if ( in_array( $item, $allowed, true ) ) {
				$validated[] = $item;
			} else {
				self::error_log( "QueryData error: Order by clause '$item' is not allowed." );
			}
		}

		return $validated;
	}

	/**
	 * Get allowed metrics (public accessor)
	 *
	 * @return array<string> List of allowed metrics.
	 */
	public function get_allowed_metrics(): array {
		return array_keys( $this->allowed_metrics );
	}

	/**
	 * Get allowed filter keys (public accessor)
	 *
	 * @return array<string> List of allowed filter keys.
	 */
	public function get_allowed_filter_keys(): array {
		return $this->allowed_filter_keys;
	}

	/**
	 * Get allowed group_by values (public accessor)
	 *
	 * @return array<string> List of allowed group_by values.
	 */
	public function get_allowed_group_by(): array {
		return $this->allowed_group_by;
	}

	/**
	 * Get allowed order_by values (public accessor)
	 *
	 * @return array<string> List of allowed order_by values.
	 */
	public function get_allowed_order_by(): array {
		return $this->allowed_order_by;
	}

	/**
	 * Get allowed metrics labels based on strict mode
	 *
	 * @return array<string, string> Associative array of metric keys and their labels.
	 */
	public function get_allowed_metrics_labels(): array {
		$labels = apply_filters(
			'burst_allowed_metrics_labels',
			[
				'host'                  => __( 'Domain', 'burst-statistics' ),
				'page_url'              => __( 'Page', 'burst-statistics' ),
				'referrer'              => __( 'Referrer', 'burst-statistics' ),
				'pageviews'             => __( 'Pageviews', 'burst-statistics' ),
				'sessions'              => __( 'Sessions', 'burst-statistics' ),
				'visitors'              => __( 'Visitors', 'burst-statistics' ),
				'avg_time_on_page'      => __( 'Avg. time on page', 'burst-statistics' ),
				'avg_session_duration'  => __( 'Avg. session duration', 'burst-statistics' ),
				'conversion_rate'       => __( 'Goal conv. rate', 'burst-statistics' ),
				'first_time_visitors'   => __( 'New visitors', 'burst-statistics' ),
				'conversions'           => __( 'Goal completions', 'burst-statistics' ),
				'bounces'               => __( 'Bounced visitors', 'burst-statistics' ),
				'bounce_rate'           => __( 'Bounce rate', 'burst-statistics' ),
				'device'                => __( 'Device', 'burst-statistics' ),
				'browser'               => __( 'Browser', 'burst-statistics' ),
				'platform'              => __( 'Platform', 'burst-statistics' ),
				'device_id'             => __( 'Device', 'burst-statistics' ),
				'browser_id'            => __( 'Browser', 'burst-statistics' ),
				'platform_id'           => __( 'Platform', 'burst-statistics' ),
				'country_code'          => __( 'Country', 'burst-statistics' ),
				'city'                  => __( 'City', 'burst-statistics' ),
				'state'                 => __( 'State', 'burst-statistics' ),
				'continent'             => __( 'Continent', 'burst-statistics' ),
				'continent_code'        => __( 'Continent', 'burst-statistics' ),
				'source'                => __( 'Source', 'burst-statistics' ),
				'medium'                => __( 'Medium', 'burst-statistics' ),
				'campaign'              => __( 'Campaign', 'burst-statistics' ),
				'term'                  => __( 'Term', 'burst-statistics' ),
				'content'               => __( 'Content', 'burst-statistics' ),
				'parameter'             => __( 'Parameter', 'burst-statistics' ),
				'parameters'            => __( 'Parameters', 'burst-statistics' ),
				'product'               => __( 'Product', 'burst-statistics' ),
				'sales'                 => __( 'Sales', 'burst-statistics' ),
				'revenue'               => __( 'Revenue', 'burst-statistics' ),
				'page_value'            => __( 'Page value', 'burst-statistics' ),
				'sales_conversion_rate' => __( 'Sales conv. rate', 'burst-statistics' ),
				'entrances'             => __( 'Entrances', 'burst-statistics' ),
				'exit_rate'             => __( 'Exit rate', 'burst-statistics' ),
				'avg_order_value'       => __( 'Avg. order value', 'burst-statistics' ),
				'adds_to_cart'          => __( 'Added to cart', 'burst-statistics' ),
			]
		);

		// Filter labels to only include allowed metrics.
		$allowed_keys = array_keys( $this->allowed_metrics );
		return array_intersect_key( $labels, array_flip( $allowed_keys ) );
	}

	/**
	 * Get the start date timestamp for the query.
	 *
	 * @return int Start date (timestamp).
	 */
	public function get_date_start(): int {
		return $this->date_start;
	}

	/**
	 * Get the end date timestamp for the query.
	 *
	 * @return int End date (timestamp).
	 */
	public function get_date_end(): int {
		return $this->date_end;
	}

	/**
	 * Get the selected metrics for the query.
	 *
	 * @return array Selected metrics.
	 */
	public function get_select(): array {
		return $this->select;
	}

	/**
	 * Get the filters applied to the query.
	 *
	 * @return array Filters array.
	 */
	public function get_filters(): array {
		return $this->filters;
	}

	/**
	 * Get the order_by value for the query.
	 *
	 * @return string[] Order by clause.
	 */
	public function get_order_by_value(): array {
		return $this->order_by;
	}

	/**
	 * Get the date modifiers applied to the query.
	 *
	 * @return array Date modifiers.
	 */
	public function get_date_modifiers(): array {
		return $this->date_modifiers;
	}

	/**
	 * Get the prepared custom WHERE clause
	 *
	 * @return string Prepared custom WHERE clause
	 */
	public function get_prepared_custom_sql( string $custom_sql, string $context ): string {
		global $wpdb;

		if ( empty( $custom_sql ) ) {
			return '';
		}

		$custom_parameters = $context === 'select' ? $this->custom_select_parameters : $this->custom_where_parameters;

		// If no params, return empty (required).
		if ( empty( $custom_parameters ) ) {
			self::error_log( 'QueryData error: Custom SQL clause has no parameters, these are required. Use empty string if not needed. Returning empty custom_' . $context );
			return '';
		}

		if ( ! $this->validate_custom_sql_safety( $custom_sql, $context ) ) {
			self::error_log( "QueryData error: Custom $context clause failed safety validation. Returning empty custom_" . $context );
			return '';
		}

		if ( count( $custom_parameters ) === 1 && $custom_parameters[0] === '' && str_contains( $custom_sql, '%s' ) ) {
			// remove the placeholder %s and return sql as is.
			return str_replace( '%s', '', $custom_sql );
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- The custom sql does not contain dynamic properties, any dynamic data is prepared below.
		return $wpdb->prepare( $custom_sql, ...$custom_parameters );
	}

	/**
	 * Check if bounces should be excluded from statistics.
	 *
	 * @return bool True if bounces should be excluded, false otherwise.
	 */
	private function exclude_bounces(): bool {
		if ( ! isset( $this->filters['bounces'] ) ) {
			return false;
		}

		return $this->filters['bounces'] === 'exclude';
	}

	/**
	 * Check if strict mode is enabled
	 *
	 * @return bool True if strict mode is enabled.
	 */
	public function is_strict(): bool {
		return $this->strict;
	}


	/**
	 * Validate custom SELECT/WHERE clauses for safe SQL patterns
	 *
	 * @param string $sql SQL clause to validate.
	 * @param string $context 'select' or 'where' for better error messages.
	 * @return bool True if valid, false if suspicious.
	 */
	private function validate_custom_sql_safety( string $sql, string $context = 'select' ): bool {
		// Remove all whitespace for easier pattern matching.
		$normalized = preg_replace( '/\s+/', ' ', trim( $sql ) );

		// 1. Check for dangerous SQL keywords.
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

		// 2. Check for suspicious patterns.
		$suspicious_patterns = [
			// Multiple statements (semicolon followed by more SQL).
			'/;.*\w/',
			// SQL comments with content after them.
			'/--\s*[^\s]/',
			// MySQL comments with content.
			'/#.*[^\s]/',
			// Block comments (can hide malicious code).
			'/\/\*.*\*\//',
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

		// 4. Check for balanced parentheses (prevents injection via unclosed brackets).
		$open  = substr_count( $sql, '(' );
		$close = substr_count( $sql, ')' );
		if ( $open !== $close ) {
			self::error_log(
				"QueryData error: Unbalanced parentheses in custom_$context. Query blocked. " .
				'SQL: ' . substr( $sql, 0, 100 )
			);
			return false;
		}

		// 5. Check for balanced quotes (prevents injection via unclosed strings).
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
