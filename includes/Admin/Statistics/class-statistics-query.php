<?php
namespace Burst\Admin\Statistics;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Metrics\Metric_Registry;
use Burst\Admin\Statistics\Query_Shapes\From_Strategy_Registry;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Sanitize;

use function Burst\burst_loader;

defined( 'ABSPATH' ) || die();

/**
 * Statistics_Query class for building complex SQL queries.
 *
 * This class provides a structured way to build SQL queries for the Burst Statistics plugin.
 * It supports filtering, grouping, ordering, custom WHERE clauses, and more.
 */
class Statistics_Query {
	use Sanitize;
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Strict mode - limits available options for frontend/non-privileged users
	 *
	 * @var bool $strict Whether strict mode is enabled.
	 */
	private bool $strict;

	/**
	 * Whitelist resolver — owns allowed metrics/filter keys/group_by/order_by.
	 */
	private Statistics_Allowlist $allowlist;

	/**
	 * Stable identifier for query family/source.
	 *
	 * @var string $id Query id used for deterministic fingerprinting.
	 */
	private string $id;

	/**
	 * Start date for the query (timestamp).
	 *
	 * @var int $date_start Start date for the query (timestamp).
	 */
	private int $date_start = 0;

	/**
	 * End date for the query (timestamp).
	 *
	 * @var int $date_end End date for the query (timestamp).
	 */
	private int $date_end = 0;

	/**
	 * Selected metrics for the query.
	 *
	 * @var array $select Metrics to select in the query.
	 */
	private array $select = [ '*' ];

	/**
	 * Filters for the query.
	 *
	 * @var array $filters Filters to apply in the query.
	 */
	private array $filters = [];

	/**
	 * Per-filter exclusion mode.
	 *
	 * Maps filter key → 'include' | 'exclude'.
	 *
	 * @var array<string, string> $filter_exclusions
	 */
	private array $filter_exclusions = [];

	/**
	 * When true, the builder emits a fixed `statistics.ID` SELECT and skips metric
	 * handling, yielding the set of statistics rows matching the active filters. Used
	 * to build IN(...) subqueries for feature blocks that assemble their own SQL.
	 */
	private bool $select_statistic_ids = false;

	/**
	 * When non-empty, a correlated `statistics.ID = <column>` condition is emitted, tying this
	 * (sub)query to an outer column. Used to build correlated EXISTS clauses for feature blocks.
	 * The value is a validated, developer-supplied column reference — never request data.
	 */
	private string $correlate_statistic_id_to = '';

	/**
	 * Group by clause for the query.
	 *
	 * @var string[] $group_by Group by clause for the query.
	 */
	private array $group_by = [];

	/**
	 * Order by clause for the query.
	 *
	 * @var string[] $order_by Order by clause for the query.
	 */
	private array $order_by = [];

	/**
	 * Offset for the query results.
	 *
	 * @var int $limit Limit for the query results.
	 */
	private int $limit = 0;

	/**
	 * Date modifiers for the query.
	 *
	 * @var array $date_modifiers Date modifiers for the query.
	 */
	private array $date_modifiers = [];

	/**
	 * Having clauses for the query.
	 *
	 * @var array $having HAVING clauses for the query.
	 */
	private array $having = [];

	/**
	 * Custom SELECT clause for the query.
	 *
	 * @var string $custom_select Custom SELECT clause for the query.
	 */
	private string $custom_select = '';

	/**
	 * Custom WHERE clause for the query.
	 *
	 * @var string $custom_where Custom WHERE clause for the query.
	 */
	private string $custom_where = '';

	private array $custom_where_parameters  = [];
	private array $custom_select_parameters = [];

	/**
	 * Accumulated SELECT expressions from metric handlers and strategies.
	 *
	 * @var array<int, array{expr: string, params: array}>
	 */
	private array $accumulated_selects = [];

	/**
	 * Ordered map of JOINs in caller insertion order. Every entry is a resolved JOIN
	 * (type/table/on/alias). Added by ->join() or ->with(). First write wins on
	 * alias collision.
	 *
	 * @var array<string, array{type: string, table: string, on: string, alias: string}>
	 */
	private array $joins = [];

	/**
	 * Subquery used as the FROM clause, or null for the default statistics table.
	 *
	 * @var \Burst\Admin\Database\Query|null
	 */
	private ?object $from_subquery_obj = null;

	/**
	 * Table alias for the FROM clause (subquery alias or 'statistics').
	 */
	private string $from_alias = 'statistics';

	/**
	 * Extra WHERE conditions added by metric handlers and strategies.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private array $additional_wheres = [];

	/**
	 * GROUP BY alias rewrites (e.g. 'parameter' → expanded SQL expression).
	 *
	 * @var array<string, string>
	 */
	private array $group_by_aliases = [];

	/**
	 * Cached TZ offset in seconds.
	 */
	private ?int $tz_offset_cache = null;

	/**
	 * Cached period SQL format string.
	 */
	private ?string $period_fmt_cache = null;

	/**
	 * Cached available join definitions.
	 *
	 * @var array<string, array>|null
	 */
	private ?array $avail_joins_cache = null;

	/**
	 * Exclude bounces flag for the query.
	 *
	 * @var bool $exclude_bounces Whether to exclude bounces from the query.
	 */
	private bool $exclude_bounces = false;

	/**
	 * Sanitizer instance for filter/metric/group_by/order_by/custom_sql validation.
	 */
	private Statistics_Sanitizer $sanitizer;

	/**
	 * Constructor to initialize the Statistics_Query object.
	 *
	 * @param string $id Query id used for deterministic fingerprinting.
	 */
	public function __construct( string $id ) {
		$this->strict    = $this->compute_strict_mode();
		$this->allowlist = new Statistics_Allowlist( $this->strict );
		$this->sanitizer = new Statistics_Sanitizer( $this );

		$this->id = sanitize_key( $id );

		if ( empty( $this->id ) ) {
			self::error_log( 'ID property is required for Query Data class.' );
		}
	}

	/**
	 * Set the exclusion mode ('include' or 'exclude') for a filter key.
	 * Used by Statistics_Sanitizer::normalize_filter_values().
	 *
	 * @param string $key  Filter key.
	 * @param string $mode 'include' or 'exclude'.
	 */
	public function set_filter_exclusion( string $key, string $mode ): void {
		$this->filter_exclusions[ $key ] = $mode;
		// The goals JOIN ON clause bakes in the inclusion/exclusion operator; invalidate
		// the cache so the next build emits the correct operator.
		$this->avail_joins_cache = null;
	}

	/**
	 * Restrict the allowed query options when the current request is a shareable link view.
	 */
	private function enforce_share_link_restrictions(): void {
		if ( ! self::is_shareable_link_viewer() ) {
			return;
		}

		$loader = burst_loader();
		if ( ! isset( $loader->admin, $loader->admin->share, $loader->admin->share->routing ) ) {
			return;
		}

		$routing = $loader->admin->share->routing;
		if ( ! is_object( $routing ) || ! method_exists( $routing, 'apply_share_link_restrictions' ) ) {
			return;
		}

		$args = $routing->apply_share_link_restrictions(
			[
				'date_start' => $this->date_start,
				'date_end'   => $this->date_end,
				'filters'    => $this->filters,
			]
		);

		if ( isset( $args['date_start'] ) ) {
			$this->date_start = absint( $args['date_start'] );
		}
		if ( isset( $args['date_end'] ) ) {
			$this->date_end = absint( $args['date_end'] );
		}
		if ( isset( $args['filters'] ) && is_array( $args['filters'] ) ) {
			$this->filters         = $this->sanitizer->normalize_filter_values( $args['filters'] );
			$this->filters         = $this->sanitizer->sanitize_filters( $this->filters );
			$this->exclude_bounces = $this->exclude_bounces();
		}
	}


	/**
	 * Sanitize device filter value.
	 *
	 * Kept on Statistics_Query (not moved to Statistics_Sanitizer) because the
	 * Sanitize trait's filter_validation_config() registers [$this, 'sanitize_device_filter']
	 * as a callback — that $this is the Statistics_Query instance.
	 *
	 * @param string $device Device value to sanitize.
	 * @return string Sanitized device value
	 */
	public function sanitize_device_filter( string $device ): string {
		$allowed_devices = [ 'desktop', 'tablet', 'mobile', 'other' ];

		if ( in_array( $device, $allowed_devices, true ) ) {
			return $device;
		}

		self::error_log( "QueryData error: Device filter value '$device' is not allowed." );
		return '';
	}

	/**
	 * Get the resolved allowlist for this query (instance, strict-mode-aware).
	 */
	public function get_allowlist(): Statistics_Allowlist {
		return $this->allowlist;
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
	 * Get the query id used by stats fingerprinting.
	 */
	public function get_id(): string {
		$id = sanitize_key( $this->id );

		return $id !== '' ? $id : 'unknown_query';
	}

	/**
	 * Build canonical payload for deterministic query fingerprinting.
	 *
	 * Absolute timestamps are intentionally excluded to avoid hash drift.
	 * We use date_range_days to keep range granularity in the key.
	 *
	 * @return array<string,mixed>
	 */
	public function get_fingerprint_payload(): array {
		$date_range_days = 0;
		if ( $this->date_start > 0 && $this->date_end > 0 && $this->date_end >= $this->date_start ) {
			$date_range_days = (int) ceil( ( $this->date_end - $this->date_start ) / DAY_IN_SECONDS );
		}

		$payload = [
			'id'                => $this->get_id(),
			'select'            => $this->normalize_list_for_fingerprint( $this->select ),
			'filters'           => $this->normalize_for_fingerprint( $this->filters ),
			'filter_exclusions' => $this->normalize_for_fingerprint( $this->filter_exclusions ),
			'group_by'          => $this->normalize_list_for_fingerprint( $this->group_by ),
			'order_by'          => $this->normalize_list_for_fingerprint( $this->order_by ),
			'limit'             => $this->limit,
			'exclude_bounces'   => $this->exclude_bounces,
			'date_range_days'   => $date_range_days,
		];

		ksort( $payload );

		return $payload;
	}

	/**
	 * Get deterministic hash for this query payload.
	 */
	public function get_fingerprint_hash(): string {
		$payload_json = wp_json_encode( $this->get_fingerprint_payload(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		if ( ! is_string( $payload_json ) || $payload_json === '' ) {
			$payload_json = $this->get_id();
		}

		// Use 64-bit hash to stay compatible with existing sql_hash column length.
		return hash( 'fnv1a64', $payload_json );
	}

	/**
	 * Normalize a list where element order is not semantically relevant.
	 *
	 * @param array<mixed> $values List values.
	 * @return array<mixed>
	 */
	private function normalize_list_for_fingerprint( array $values ): array {
		$values = array_map( [ $this, 'normalize_for_fingerprint' ], $values );
		usort( $values, [ $this, 'compare_normalized_values' ] );

		return $values;
	}

	/**
	 * Recursively normalize values for deterministic hashing.
	 *
	 * Mixed in/out: this recurses over arbitrary query-state values (arrays, scalars, bool, null) and returns the same shape normalized — genuinely polymorphic.
	 */
	private function normalize_for_fingerprint( mixed $value ): mixed {
		if ( is_array( $value ) ) {
			if ( $this->is_list_array( $value ) ) {
				$normalized = array_map( [ $this, 'normalize_for_fingerprint' ], $value );
				usort( $normalized, [ $this, 'compare_normalized_values' ] );

				return $normalized;
			}

			ksort( $value );
			foreach ( $value as $key => $item ) {
				$value[ $key ] = $this->normalize_for_fingerprint( $item );
			}

			return $value;
		}

		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || $value === null ) {
			return $value;
		}

		// @phpstan-ignore-next-line.
		if ( is_numeric( $value ) && ! str_contains( (string) $value, '.' ) ) {
			return (int) $value;
		}

		if ( is_numeric( $value ) ) {
			return (float) $value;
		}

		return (string) $value;
	}

	/**
	 * Polyfill for list array detection (for PHP < 8.1 compatibility).
	 *
	 * @param array<mixed> $value Array to inspect.
	 */
	private function is_list_array( array $value ): bool {
		$expected_key = 0;
		foreach ( array_keys( $value ) as $key ) {
			if ( $key !== $expected_key ) {
				return false;
			}
			++$expected_key;
		}

		return true;
	}

	/**
	 * Compare normalized values for deterministic list sorting.
	 *
	 * Mixed $a/$b: compares already-normalized values of any type by JSON-encoding them; the inputs are inherently polymorphic.
	 */
	private function compare_normalized_values( mixed $a, mixed $b ): int {
		$encoded_a = wp_json_encode( $a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		$encoded_b = wp_json_encode( $b, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		if ( ! is_string( $encoded_a ) ) {
			$encoded_a = (string) $a;
		}
		if ( ! is_string( $encoded_b ) ) {
			$encoded_b = (string) $b;
		}

		return strcmp( $encoded_a, $encoded_b );
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
	 * Get the group_by array.
	 *
	 * @return string[] Group by clauses.
	 */
	public function get_group_by(): array {
		return $this->group_by;
	}

	/**
	 * Get the limit value.
	 *
	 * @return int Limit.
	 */
	public function get_limit(): int {
		return $this->limit;
	}

	/**
	 * Get the having array.
	 *
	 * @return array Having clauses.
	 */
	public function get_having(): array {
		return $this->having;
	}

	/**
	 * Get the custom SELECT clause.
	 *
	 * @return string Custom SELECT clause.
	 */
	public function get_custom_select(): string {
		return $this->custom_select;
	}

	/**
	 * Get the custom WHERE clause.
	 *
	 * @return string Custom WHERE clause.
	 */
	public function get_custom_where(): string {
		return $this->custom_where;
	}

	/**
	 * Get the exclude_bounces flag.
	 *
	 * @return bool Whether bounces are excluded.
	 */
	public function get_exclude_bounces(): bool {
		return $this->exclude_bounces;
	}

	/**
	 * Get the filter_exclusions map.
	 *
	 * @return array<string, string> Per-filter exclusion modes.
	 */
	public function get_filter_exclusions(): array {
		return $this->filter_exclusions;
	}

	/**
	 * Set custom WHERE clause. Strict-mode gate: refused for share-link viewers.
	 *
	 * @param string $sql    Custom WHERE SQL template.
	 * @param array  $params Prepared statement parameters.
	 * @return $this
	 */
	public function set_custom_where( string $sql, array $params ): self {
		if ( $this->strict ) {
			self::error_log( 'QueryData error: custom_where is not allowed in strict mode.' );
			return $this;
		}
		$prepared = $this->get_prepared_custom_sql( $sql, 'where' );
		if ( $prepared !== '' || $sql === '' ) {
			$this->custom_where_parameters = $params;
			$this->custom_where            = $prepared;
		}
		return $this;
	}

	/**
	 * Append to custom SELECT clause. Strict-mode gate: refused for share-link viewers.
	 *
	 * @param string $sql    SQL fragment to append (template with %s/%d placeholders).
	 * @param array  $params Prepared statement parameters for this fragment.
	 * @return $this
	 */
	public function append_custom_select( string $sql, array $params ): self {
		if ( $this->strict ) {
			self::error_log( 'QueryData error: custom_select is not allowed in strict mode.' );
			return $this;
		}
		// Temporarily swap parameters so get_prepared_custom_sql sees only this fragment's
		// placeholders, then restore — $this->custom_select is already-prepared SQL so the
		// fragment params must not accumulate into $this->custom_select_parameters.
		$saved_params                   = $this->custom_select_parameters;
		$this->custom_select_parameters = $params;
		$prepared                       = $this->get_prepared_custom_sql( $sql, 'select' );
		$this->custom_select_parameters = $saved_params;
		if ( $prepared !== '' ) {
			$this->custom_select .= $prepared;
		}
		return $this;
	}

	/**
	 * Set date modifiers.
	 *
	 * @param array $value Date modifiers array.
	 * @return $this
	 */
	public function set_date_modifiers( array $value ): self {
		$this->date_modifiers = $value;
		return $this;
	}

	/**
	 * Create a new Statistics_Query instance.
	 *
	 * @param string $id Query ID.
	 */
	public static function create( string $id ): self {
		return new self( $id );
	}

	/**
	 * Set the metrics to SELECT.
	 *
	 * @param string|string[] $metrics Metric keys to select.
	 * @return $this
	 */
	public function select( string|array $metrics ): self {
		$this->select = $this->sanitizer->sanitize_metrics( is_array( $metrics ) ? $metrics : [ $metrics ] );
		return $this;
	}

	/**
	 * Append a raw SQL expression to the SELECT clause.
	 *
	 * @param string $sql    Raw SQL fragment (may contain %s placeholders).
	 * @param array  $params Ordered values for each %s placeholder.
	 * @return $this
	 */
	public function select_raw( string $sql, array $params = [] ): self {
		return $this->append_custom_select( $sql, $params );
	}

	/**
	 * Add a grouped WHERE condition (AND/OR group) to the query.
	 *
	 * @param array $conditions Group definition with 'relation' key and condition entries.
	 * @return $this
	 */
	public function where_group( array $conditions ): self {
		$this->additional_wheres[] = [
			'type'       => 'group',
			'conditions' => $conditions,
		];
		return $this;
	}

	/**
	 * Add an IS NULL condition for the given column.
	 *
	 * @param string $column Qualified column name.
	 * @return $this
	 */
	public function where_null( string $column ): self {
		$this->additional_wheres[] = [
			'type'   => 'null',
			'column' => $column,
		];
		return $this;
	}

	/**
	 * Add an IS NOT NULL condition for the given column.
	 *
	 * @param string $column Qualified column name.
	 * @return $this
	 */
	public function where_not_null( string $column ): self {
		$this->additional_wheres[] = [
			'type'   => 'not_null',
			'column' => $column,
		];
		return $this;
	}

	/**
	 * Add a WHERE condition.
	 *
	 * @param string $column   Qualified column name.
	 * @param mixed  $value    Value to compare against.
	 * @param string $operator SQL comparison operator.
	 * @param string $dtype    wpdb placeholder type ('%s', '%d', '%f').
	 * @return $this
	 *
	 * Mixed $value: a query value is intentionally polymorphic — string|int|float for scalar comparisons, array for IN/NOT IN, null for IS NULL.
	 */
	public function where( string $column, mixed $value, string $operator = '=', string $dtype = '%s' ): self {
		$this->additional_wheres[] = [
			'type'     => 'where',
			'column'   => $column,
			'value'    => $value,
			'operator' => $operator,
			'dtype'    => $dtype,
		];
		return $this;
	}

	/**
	 * Add a WHERE IN condition.
	 *
	 * @param string $column Qualified column name.
	 * @param array  $values Values to match.
	 * @param string $dtype  wpdb placeholder type.
	 * @return $this
	 */
	public function where_in( string $column, array $values, string $dtype = '%s' ): self {
		return $this->where( $column, $values, 'IN', $dtype );
	}

	/**
	 * Add a raw WHERE expression. Blocked in strict mode.
	 *
	 * @param string $expr   Raw SQL expression.
	 * @param array  $params Ordered values for any placeholders.
	 * @return $this
	 */
	public function where_raw( string $expr, array $params = [] ): self {
		if ( $this->strict ) {
			self::error_log( 'QueryData error: where_raw is not allowed in strict mode.' );
			return $this;
		}
		$this->additional_wheres[] = [
			'expr'   => $expr,
			'params' => $params,
		];
		return $this;
	}

	/**
	 * Add a raw HAVING condition. Blocked in strict mode.
	 *
	 * @param string $condition SQL condition string.
	 * @return $this
	 */
	public function having_raw( string $condition ): self {
		if ( $this->strict ) {
			self::error_log( 'QueryData error: having_raw is not allowed in strict mode.' );
			return $this;
		}
		$this->having[] = $condition;
		return $this;
	}

	/**
	 * Add a JOIN via the fluent API.
	 *
	 * @param string $alias Table alias.
	 * @param string $table Table name (without prefix).
	 * @param string $on    ON condition SQL.
	 * @param string $type  JOIN type ('INNER' or 'LEFT').
	 * @return $this
	 */
	public function join( string $alias, string $table, string $on, string $type = 'INNER' ): self {
		if ( ! isset( $this->joins[ $alias ] ) ) {
			$this->joins[ $alias ] = [
				'type'  => strtoupper( $type ),
				'table' => $table,
				'on'    => $on,
				'alias' => $alias,
			];
		}
		return $this;
	}

	/**
	 * Set GROUP BY columns.
	 *
	 * Accepts:
	 *  - a single token: 'page_url'
	 *  - a comma-separated string: 'd.ID, d.name'
	 *  - a JSON-encoded array: '["page_url","device"]'
	 *  - an actual array: [ 'page_url', 'device' ]
	 *
	 * @param string|string[] $columns GROUP BY columns.
	 * @return $this
	 */
	public function group_by( string|array $columns ): self {
		$array_values   = is_array( $columns ) ? $columns : $this->ensure_array_if_applicable( $columns );
		$this->group_by = $this->sanitizer->sanitize_group_by( is_array( $array_values ) ? $array_values : [ $array_values ] );
		return $this;
	}

	/**
	 * Set ORDER BY clause.
	 *
	 * Accepts the same shapes as group_by(): single token, comma-separated string,
	 * JSON-encoded array, or array.
	 *
	 * @param string|string[] $clause ORDER BY clause(s).
	 * @return $this
	 */
	public function order_by( string|array $clause ): self {
		$array_values   = is_array( $clause ) ? $clause : $this->ensure_array_if_applicable( $clause );
		$this->order_by = is_array( $array_values ) ? $array_values : [ $array_values ];
		$this->order_by = $this->sanitizer->validate_order_by( $this->order_by );
		return $this;
	}

	/**
	 * Set row limit.
	 *
	 * @param int $n Row limit.
	 * @return $this
	 */
	public function limit( int $n ): self {
		$this->limit = absint( $n );
		return $this;
	}

	/**
	 * Bulk-apply a query-args array to the builder. Centralizes dispatch + type
	 * coercion so callers don't need to know the per-setter signatures.
	 *
	 * Unknown keys are ignored. Values that are the wrong shape for a given setter
	 * are coerced where unambiguous (e.g. scalar→string, limit→int) and skipped
	 * with a logged warning where coercion would be lossy (e.g. non-array filters).
	 *
	 * @param array<string, mixed> $args Query args keyed by setter name.
	 * @return $this
	 */
	public function apply_args( array $args ): self {
		foreach ( $args as $key => $value ) {
			if ( $key === 'select' ) {
				if ( is_array( $value ) ) {
					$this->select( $value );
				} elseif ( is_scalar( $value ) ) {
					$this->select( (string) $value );
				} else {
					self::error_log( "QueryData error: apply_args ignoring 'select' — expected string|array, got " . gettype( $value ) );
				}
			} elseif ( $key === 'group_by' ) {
				if ( is_array( $value ) ) {
					$this->group_by( $value );
				} elseif ( is_scalar( $value ) ) {
					$this->group_by( (string) $value );
				} else {
					self::error_log( "QueryData error: apply_args ignoring 'group_by' — expected string|array, got " . gettype( $value ) );
				}
			} elseif ( $key === 'order_by' ) {
				if ( is_array( $value ) ) {
					$this->order_by( $value );
				} elseif ( is_scalar( $value ) ) {
					$this->order_by( (string) $value );
				} else {
					self::error_log( "QueryData error: apply_args ignoring 'order_by' — expected string|array, got " . gettype( $value ) );
				}
			} elseif ( $key === 'filters' ) {
				if ( is_array( $value ) || is_string( $value ) || $value === null ) {
					$this->filters( $value );
				} else {
					self::error_log( "QueryData error: apply_args ignoring 'filters' — expected array|string|null, got " . gettype( $value ) );
				}
			} elseif ( $key === 'limit' ) {
				if ( is_numeric( $value ) ) {
					$this->limit( (int) $value );
				} else {
					self::error_log( "QueryData error: apply_args ignoring 'limit' — expected numeric, got " . gettype( $value ) );
				}
			}
		}
		return $this;
	}

	/**
	 * Set the date range.
	 *
	 * @param int $start Unix timestamp for range start.
	 * @param int $end   Unix timestamp for range end.
	 * @return $this
	 */
	public function date_range( int $start, int $end ): self {
		$this->date_start = absint( $start );
		$this->date_end   = absint( $end );
		// Dynamic joins (session_orders, order_items, …) bake the date range into
		// their subquery SQL at resolve time; cached resolution would otherwise
		// retain stale dates if date_range() is called after the first with().
		$this->avail_joins_cache = null;
		return $this;
	}

	/**
	 * Set filters. Invalidates the registered-joins cache because the goals JOIN ON is
	 * built with the current goal_id (see get_available_joins()).
	 *
	 * Accepts an array, a JSON-encoded array string, or any falsy/empty scalar
	 * (treated as "no filters"). Anything else is logged and ignored.
	 *
	 * @param array<string, mixed>|string|null $filters Filter key/value pairs.
	 * @return $this
	 */
	public function filters( array|string|null $filters ): self {
		if ( ! is_array( $filters ) ) {
			if ( $filters === null || $filters === '' ) {
				$filters = [];
			} else {
				$decoded = json_decode( $filters, true );
				if ( is_array( $decoded ) ) {
					$filters = $decoded;
				} else {
					self::error_log( 'QueryData error: filters() ignoring non-array value: ' . substr( $filters, 0, 100 ) );
					$filters = [];
				}
			}
		}

		$this->filters           = $this->sanitizer->normalize_filter_values( $filters );
		$this->filters           = $this->sanitizer->sanitize_filters( $this->filters );
		$this->exclude_bounces   = $this->exclude_bounces();
		$this->avail_joins_cache = null;
		return $this;
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

		if ( ! $this->sanitizer->validate_custom_sql_safety( $custom_sql, $context ) ) {
			self::error_log( "QueryData error: Custom $context clause failed safety validation. Returning empty custom_" . $context );
			return '';
		}

		// Only %s, %d, %f are real placeholders; a bare '%' (e.g. inside LIKE '%term%') is not.
		$placeholder_count = preg_match_all( '/%[sdf]/', $custom_sql );
		if ( $placeholder_count !== count( $custom_parameters ) ) {
			self::error_log(
				'QueryData error: Custom SQL clause placeholder count (' . $placeholder_count
				. ') does not match parameter count (' . count( $custom_parameters )
				. '). Returning empty custom_' . $context
			);
			return '';
		}

		if ( $placeholder_count === 0 ) {
			return $custom_sql;
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
	 * Decide whether this query instance runs in strict mode.
	 *
	 * Strict mode = consumer is NOT a trusted admin/REST caller. Returns true only for
	 * frontend shortcode use, share-link viewers, or unauthenticated contexts. Logged-in
	 * admin REST callers (with view_burst_statistics) are non-strict and may use the
	 * full SELECT/WHERE surface.
	 */
	private function compute_strict_mode(): bool {
		return ! $this->has_admin_access();
	}

	/**
	 * Add a SELECT expression to the accumulator.
	 *
	 * @param string  $expression SQL expression (should include AS alias).
	 * @param mixed[] $params     Prepared-statement params for the expression.
	 * @return $this
	 */
	public function add_select( string $expression, array $params = [] ): self {
		$this->accumulated_selects[] = [
			'expr'   => $expression,
			'params' => $params,
		];
		return $this;
	}

	/**
	 * Request one or more named joins from Join_Registry. Each key's depends_on chain
	 * (e.g. 'locations' → 'sessions') is added first so dependents emit after their
	 * dependencies. First write wins on alias collision.
	 *
	 * @param string ...$keys Join keys defined in Join_Registry (e.g. 'sessions', 'goals').
	 * @return $this
	 */
	public function with( string ...$keys ): self {
		$available = $this->get_available_joins();
		$add       = function ( string $key ) use ( $available, &$add ): void {
			// Already added — first-write-wins. Common during dep recursion (e.g.
			// with('locations') pulls 'sessions', then a later with('sessions') no-ops).
			if ( isset( $this->joins[ $key ] ) ) {
				return;
			}

			// Unknown registry key — caller asked for a join that was never registered
			// via Join_Registry::register() / register_dynamic().
			if ( ! isset( $available[ $key ] ) ) {
				self::error_log( "Statistics_Query::with(): unknown join key '{$key}' — not registered in Join_Registry." );
				return;
			}

			foreach ( $available[ $key ]['depends_on'] ?? [] as $dep ) {
				$add( $dep );
			}
			$this->joins[ $key ] = $available[ $key ] + [ 'alias' => $key ];
		};
		foreach ( $keys as $key ) {
			$add( $key );
		}
		return $this;
	}

	/**
	 * Set a subquery as the FROM clause.
	 *
	 * @param \Burst\Admin\Database\Query $inner The inner Query object.
	 * @param string                      $alias The alias for the subquery.
	 * @return $this
	 */
	public function set_from_subquery( Query $inner, string $alias ): self {
		$this->from_subquery_obj = $inner;
		$this->from_alias        = $alias;
		return $this;
	}

	/**
	 * Add GROUP BY alias rewrites (e.g. 'parameter' → 'params.parameter, params.value').
	 *
	 * @param array<string, string> $aliases Map of group_by token → actual SQL expression.
	 * @return $this
	 */
	public function set_group_by_aliases( array $aliases ): self {
		$this->group_by_aliases = array_merge( $this->group_by_aliases, $aliases );
		return $this;
	}

	/**
	 * Get the computed MySQL timezone offset (cached per instance).
	 *
	 * @return int Offset in seconds.
	 */
	public function get_tz_offset(): int {
		if ( $this->tz_offset_cache === null ) {
			$date_modifiers        = $this->get_date_modifiers();
			$this->tz_offset_cache = empty( $date_modifiers ) ? 0 : self::compute_mysql_timezone_offset();
		}
		return $this->tz_offset_cache;
	}

	/**
	 * Get the MySQL date format string for period grouping (cached per instance).
	 *
	 * @return string Format string, or '' if no period grouping.
	 */
	public function get_period_sql_format(): string {
		if ( $this->period_fmt_cache === null ) {
			$date_modifiers         = $this->get_date_modifiers();
			$this->period_fmt_cache = $date_modifiers['sql_date_format'] ?? '';
		}
		return $this->period_fmt_cache;
	}

	/**
	 * Resolve every registered JOIN definition (static + dynamic) for this query and bake
	 * the goal_id filter into the goals JOIN ON clause when set. Cached per instance;
	 * invalidated by set_filters() because the goals ON depends on the current goal_id.
	 *
	 * Goal id is baked into the JOIN ON (not added as a WHERE) because goals is a LEFT
	 * JOIN — a WHERE on goals.goal_id would filter out rows with no matching goal row,
	 * silently downgrading the LEFT JOIN to an INNER JOIN and breaking conversion-rate
	 * math where the denominator must include sessions with no conversion.
	 *
	 * @return array<string, array{table: string, on: string, type?: string, depends_on?: array}>
	 */
	private function get_available_joins(): array {
		if ( $this->avail_joins_cache !== null ) {
			return $this->avail_joins_cache;
		}
		global $wpdb;
		$available_joins = Join_Registry::resolve( $this );
		$filters         = $this->get_filters();
		$goal_id_filter  = $filters['goal_id'] ?? 0;
		if ( $goal_id_filter === 'all' ) {
			if ( isset( $available_joins['goals'] ) ) {
				$active_goal_ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );
				if ( ! empty( $active_goal_ids ) ) {
					$active_goals_in = implode( ',', array_map( 'intval', $active_goal_ids ) );
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$available_joins['goals']['on'] .= " AND goals.goal_id IN ($active_goals_in)";
				} else {
					$available_joins['goals']['on'] .= ' AND 1 = 0';
				}
			}
		} elseif ( (int) $goal_id_filter > 0 && isset( $available_joins['goals'] ) ) {
			$goal_id       = (int) $goal_id_filter;
			$is_exclude    = ( $this->get_filter_exclusions()['goal_id'] ?? 'include' ) === 'exclude';
			$goal_operator = $is_exclude ? '!=' : '=';
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$goal_sql                        = $wpdb->prepare( "AND goals.goal_id $goal_operator %d", $goal_id );
			$available_joins['goals']['on'] .= ' ' . $goal_sql;
		}
		$this->avail_joins_cache = $available_joins;
		return $available_joins;
	}

	/**
	 * Build a Query object from all accumulated state. No parameters — self-contained.
	 */
	/**
	 * Emit a fixed `statistics.ID` SELECT and skip metric handling on the next build.
	 *
	 * The column is fixed and not user-controlled, so it is permitted even in strict
	 * mode (where arbitrary custom selects are blocked) — the IDs are consumed only as
	 * an IN(...) subquery, never returned to the caller.
	 *
	 * @return $this
	 */
	public function select_statistic_ids(): self {
		$this->select_statistic_ids = true;
		return $this;
	}

	/**
	 * Correlate this (sub)query to an outer column via `statistics.ID = <column>`.
	 *
	 * The condition is emitted directly during build, so — like select_statistic_ids() — it
	 * works even in strict mode (where where_raw() is blocked). The caller is responsible for
	 * passing a trusted, validated column reference (never request data).
	 *
	 * @param string $column Outer column reference (e.g. 's.ID').
	 * @return $this
	 */
	public function correlate_statistic_id( string $column ): self {
		$this->correlate_statistic_id_to = $column;
		return $this;
	}

	/**
	 * Build a prepared, correlated `EXISTS ( … )` clause that is true for outer rows whose
	 * statistic matches the active filters within the given date range.
	 *
	 * Feature blocks that assemble their own SQL (search terms, external links, forms) splice
	 * the result into their WHERE so the standard browser / page / referrer / country / …
	 * filters apply exactly as on the regular datatable query path. `$correlate_column` is the
	 * outer column holding the statistic id (e.g. `s.ID`, `ss.statistic_id`); the subquery is
	 * tied to it via `statistics.ID = <correlate_column>`.
	 *
	 * EXISTS — rather than `IN ( SELECT id … )` — is deliberate: it is a semi-join, so it never
	 * materialises the (potentially millions, on an all-time + filter query) set of matching
	 * ids, and it cannot double-count when a filter uses a 1:many join (e.g. `parameter`). Per
	 * outer row it is a primary-key seek on `statistics.ID`, so cost scales with the number of
	 * outer rows, not with how many statistics match the filter.
	 *
	 * Returns '' when no filters are active — callers then skip the constraint entirely.
	 *
	 * The returned SQL is already prepared (placeholder values substituted). When splicing it
	 * into a string passed through $wpdb->prepare() again, escape literal '%' first via
	 * str_replace( '%', '%%', $sql ) so the second prepare pass leaves LIKE wildcards intact.
	 *
	 * @param array  $filters          Active filter key/value pairs.
	 * @param int    $date_start       Range start as a Unix timestamp.
	 * @param int    $date_end         Range end as a Unix timestamp.
	 * @param string $correlate_column Outer column holding the statistic id (e.g. 's.ID').
	 * @return string Prepared `EXISTS ( … )` clause, or '' when no filters are active.
	 */
	public static function filtered_statistics_exists_sql( array $filters, int $date_start, int $date_end, string $correlate_column ): string {
		if ( empty( $filters ) ) {
			return '';
		}

		// $correlate_column is developer-supplied (never request data), but validate its shape
		// as defense-in-depth before splicing it into the raw correlation condition.
		if ( ! preg_match( '/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/', $correlate_column ) ) {
			self::error_log( 'QueryData error: filtered_statistics_exists_sql() rejected correlate column: ' . $correlate_column );
			return '';
		}

		$query = self::create( 'filtered_statistics_exists' )
			->date_range( $date_start, $date_end )
			->filters( $filters )
			->select_statistic_ids()
			->correlate_statistic_id( $correlate_column );

		// Honour share-link restrictions (date/filter tightening) like fetch() does.
		$query->enforce_share_link_restrictions();

		// If share-link restrictions stripped every filter, there is nothing left to
		// constrain on — skip the clause rather than emit an unbounded correlated scan.
		if ( empty( $query->get_filters() ) ) {
			return '';
		}

		return 'EXISTS ( ' . $query->to_query()->prepare_sql() . ' )';
	}

	/**
	 * Compile the current builder state into an executable Query object.
	 *
	 * @return Query The compiled query ready for prepare_sql() or execution.
	 */
	public function to_query(): Query {
		// Snapshot joins so per-build additions by From_Strategy / metric handlers don't
		// leak into the next to_query() call. Durable entries added by the caller via
		// ->join() / ->with() before to_query() are restored at the end.
		$durable_joins  = $this->joins;
		$durable_wheres = $this->additional_wheres;
		try {
			return $this->build_query_internal();
		} finally {
			$this->joins             = $durable_joins;
			$this->additional_wheres = $durable_wheres;
		}
	}

	/**
	 * Build the Query object. Called from to_query() inside a snapshot/restore guard.
	 */
	private function build_query_internal(): Query {
		$this->accumulated_selects = [];
		$this->from_subquery_obj   = null;
		$this->from_alias          = 'statistics';
		$this->group_by_aliases    = [];
		// NOTE: additional_wheres is intentionally NOT reset here. It holds caller-supplied
		// conditions from ->where()/->where_group()/->where_raw()/->where_not_null(), which
		// must survive into the build. to_query() snapshots and restores it (like joins) so
		// any per-build additions by From_Strategy / metric handlers don't leak across builds.

		// Order matters: strategy first (it may set the FROM subquery and add joins via
		// join()), then metric handlers (read selected metrics and call with() to add
		// named joins). Custom-select callers still go through the metric loop so handlers
		// can add their joins even when the SELECT is overridden.
		$strategy = From_Strategy_Registry::resolve( $this->get_id() );
		$strategy?->apply( $this );

		// Filter-only mode: feature blocks reuse this builder solely to resolve the set of
		// statistics rows matching the active filters. Emit a fixed, safe SELECT and skip
		// metric handling. statistics.ID is not user-controlled and is consumed only as an
		// IN(...) subquery, so it is allowed even in strict mode (where custom selects are not).
		if ( $this->select_statistic_ids ) {
			$this->accumulated_selects = [
				[
					'expr'   => 'statistics.ID',
					'params' => [],
				],
			];
		}

		$custom_select = $this->select_statistic_ids ? '' : $this->get_custom_select();
		foreach ( ( $this->select_statistic_ids ? [] : $this->get_select() ) as $metric ) {
			$handler = Metric_Registry::get( $metric );
			if ( $handler !== null ) {
				$handler->apply( $this );
			} elseif ( $custom_select === '' ) {
				// Chain-safe: handlers receive an accumulating SQL value (initially '')
				// so multiple registrants (core geo, Pro campaigns/ecommerce) compose
				// without clobbering each other. Each returns the incoming value when it
				// does not own the metric.
				$expr = apply_filters( 'burst_select_sql_for_metric', '', $metric, $this );
				if ( $expr !== $metric && $expr !== '' && $expr !== false ) {
					$safe_alias                  = preg_replace( '/[^a-zA-Z0-9_]/', '', $metric );
					$this->accumulated_selects[] = [
						'expr'   => "$expr AS $safe_alias",
						'params' => [],
					];
				}
			}
		}
		if ( $custom_select !== '' ) {
			$this->accumulated_selects = [
				[
					'expr'   => $custom_select,
					'params' => [],
				],
			];
		}

		// Guard against silent SELECT *: if no metric handler accumulated a SELECT
		// expression and no custom_select was supplied, force an explicit literal so
		// the downstream SELECT cannot leak every column of burst_statistics. This
		// path is reachable e.g. when select_raw() no-ops in strict mode.
		if ( empty( $this->accumulated_selects ) ) {
			self::error_log( 'QueryData error: build_query_internal produced no SELECT expressions; emitting "SELECT 0" placeholder. Query id: ' . $this->get_id() );
			$this->accumulated_selects[] = [
				'expr'   => '0 AS empty_select_guard',
				'params' => [],
			];
		}

		// Filter-driven auto-join. Filter_Registry maps frontend filter keys to qualified
		// SQL columns (e.g. 'country_code' → 'locations.country_code'). Pull in any
		// registry alias whose column is referenced by a filter but not yet joined.
		$filter_map = Filter_Registry::all();
		foreach ( $this->get_filters() as $filter_key => $_value ) {
			$col = $filter_map[ $filter_key ] ?? '';
			if ( $col === '' || strpos( $col, '.' ) === false ) {
				continue;
			}
			$alias = strstr( $col, '.', true );
			// 'statistics' is the base FROM table, never registered as a join.
			if ( $alias === 'statistics' ) {
				continue;
			}
			if ( ! isset( $this->joins[ $alias ] ) ) {
				$this->with( $alias );
			}
		}

		$q = Query::create();

		if ( $this->from_subquery_obj !== null ) {
			$q->from_subquery( $this->from_subquery_obj, $this->from_alias );
		} else {
			$q->from( 'burst_statistics', 'statistics' );
		}

		// JOINs emit in caller insertion order. A FROM subquery alias must not be
		// re-emitted as a JOIN — MySQL rejects `... AS statistics INNER JOIN ... AS
		// statistics ...`.
		$from_alias = $this->from_subquery_obj !== null ? $this->from_alias : '';
		foreach ( $this->joins as $alias => $join ) {
			if ( $alias === $from_alias ) {
				continue;
			}
			( $join['type'] ?? 'INNER' ) === 'LEFT'
				? $q->left_join( $join['table'], $join['on'], $alias )
				: $q->inner_join( $join['table'], $join['on'], $alias );
		}

		$this->build_filter_where( $q );
		$q->where_between( 'statistics.time', $this->get_date_start(), $this->get_date_end(), '%d' );

		// Correlated EXISTS support: tie this subquery to an outer statistic id. Emitted here
		// (not via where_raw) so it survives strict mode. The column is validated by the caller.
		if ( $this->correlate_statistic_id_to !== '' ) {
			$q->where_raw( 'statistics.ID = ' . $this->correlate_statistic_id_to );
		}

		foreach ( $this->accumulated_selects as [ 'expr' => $expr, 'params' => $params ] ) {
			$q->select_raw( $expr, $params );
		}

		$period_fmt = $this->get_period_sql_format();
		if ( $period_fmt !== '' ) {
			$q->period_select( $this->get_tz_offset(), $period_fmt );
		}

		foreach ( $this->additional_wheres as $entry ) {
			$type = $entry['type'] ?? 'raw';
			if ( $type === 'group' ) {
				$q->where_group( $entry['conditions'] );
			} elseif ( $type === 'null' ) {
				$q->where_null( $entry['column'] );
			} elseif ( $type === 'not_null' ) {
				$q->where_not_null( $entry['column'] );
			} elseif ( $type === 'where' ) {
				$q->where( $entry['column'], $entry['value'], $entry['operator'], $entry['dtype'] );
			} else {
				$q->where_raw( $entry['expr'], $entry['params'] );
			}
		}

		$group_cols = $this->get_group_by();
		if ( ! empty( $group_cols ) ) {
			$aliases = $this->group_by_aliases;
			$fixed   = array_map(
				static function ( string $col ) use ( $aliases ): string {
					return $aliases[ trim( $col ) ] ?? $col;
				},
				$group_cols
			);
			$q->group_by( implode( ', ', $fixed ) );
		}

		$order_parts = $this->get_order_by_value();
		if ( ! empty( $order_parts ) ) {
			// Values pass Statistics_Sanitizer::validate_order_by(): allowlist or regex limited to
			// [a-zA-Z_]\w*( (ASC|DESC))?. No injection chars survive the gate, but
			// esc_sql is retained as defense-in-depth.
			$q->order_by_raw( implode( ', ', array_map( static fn( string $v ): string => (string) esc_sql( $v ), $order_parts ) ) );
		}

		if ( $this->get_limit() > 0 ) {
			$q->limit( $this->get_limit() );
		}

		foreach ( $this->get_having() as $condition ) {
			$condition_string = is_array( $condition ) ? implode( ' ', $condition ) : (string) $condition;
			$q->having_raw( $condition_string );
		}

		return $q;
	}

	/**
	 * Compute the WP vs MySQL timezone delta in seconds.
	 * Rounds to half-hour granularity to handle unusual timezone offsets.
	 *
	 * @return int Offset in seconds (WP tz - MySQL tz).
	 */
	private static function compute_mysql_timezone_offset(): int {
		global $wpdb;
		$mysql_timestamp = $wpdb->get_var( 'SELECT FROM_UNIXTIME(UNIX_TIMESTAMP());' );
		$wp_tz_offset    = self::get_wp_timezone_offset();
		$mysql_tz_hours  = round( ( strtotime( $mysql_timestamp ) - time() ) / ( HOUR_IN_SECONDS / 2 ), 0 ) * 0.5;
		$wp_tz_hours     = round( $wp_tz_offset / ( HOUR_IN_SECONDS / 2 ), 0 ) * 0.5;
		return (int) ( $wp_tz_hours - $mysql_tz_hours ) * HOUR_IN_SECONDS;
	}

	/**
	 * Returns true when the query spans more than 30 days (triggers longer cache TTLs and timeouts).
	 */
	private function is_expensive_aggregation_window(): bool {
		return $this->compute_date_range_days() > 30;
	}

	/**
	 * Compute the date range in days from the current date_start/date_end.
	 *
	 * @return int Number of days (0 if timestamps are unset or invalid).
	 */
	private function compute_date_range_days(): int {
		$start = $this->get_date_start();
		$end   = $this->get_date_end();
		if ( $start <= 0 || $end <= 0 || $end < $start ) {
			return 0;
		}
		return (int) ceil( ( $end - $start ) / DAY_IN_SECONDS );
	}

	/**
	 * Resolve the per-query SQL execution timeout in milliseconds.
	 *
	 * @return int Timeout in milliseconds.
	 */
	private function get_query_timeout_ms(): int {
		return $this->resolve_query_timeout_ms(
			'burst_query_timeout_ms',
			'burst_query_timeout_ms_background',
			$this,
			30000,
			900000,
			0,
			true
		);
	}

	/**
	 * Resolve the result cache TTL in seconds. Extended for expensive (>30 day) windows.
	 *
	 * @return int TTL in seconds.
	 */
	private function get_query_cache_ttl(): int {
		$default_ttl = 30;
		if ( $this->is_expensive_aggregation_window() ) {
			$default_ttl = 300;
		}
		$option_ttl = (int) get_option( 'burst_query_results_cache_ttl', -1 );
		if ( $option_ttl >= 0 ) {
			$default_ttl = $option_ttl;
		}
		return max( 0, (int) apply_filters( 'burst_query_results_cache_ttl', $default_ttl, $this ) );
	}

	/**
	 * Check whether single-flight deduplication is active (requires an external object cache).
	 */
	private function is_query_single_flight_enabled(): bool {
		$enabled = function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache();
		return (bool) apply_filters( 'burst_query_single_flight_enabled', $enabled, $this );
	}

	/**
	 * How long (ms) a second request should poll waiting for the first to populate the cache.
	 *
	 * @return int Wait time in milliseconds.
	 */
	private function get_query_single_flight_wait_ms(): int {
		return max( 0, (int) apply_filters( 'burst_query_single_flight_wait_ms', 1200, $this ) );
	}

	/**
	 * Compute the single-flight lock TTL in seconds from the query timeout.
	 *
	 * @param int $timeout_ms Query timeout in milliseconds.
	 * @return int Lock TTL in seconds.
	 */
	private function get_query_single_flight_lock_ttl( int $timeout_ms ): int {
		$derived_ttl = (int) ceil( $timeout_ms / 1000 ) + 2;
		$default_ttl = max( 5, $derived_ttl );
		return max( 1, (int) apply_filters( 'burst_query_single_flight_lock_ttl', $default_ttl, $this, $timeout_ms ) );
	}

	/**
	 * Compute the cooldown TTL (seconds) applied after a timed-out query to prevent hammering.
	 *
	 * @param int $timeout_ms Query timeout in milliseconds.
	 * @return int Cooldown TTL in seconds.
	 */
	private function get_query_timeout_cooldown_ttl( int $timeout_ms ): int {
		$expensive_window = $this->is_expensive_aggregation_window();
		$base             = $expensive_window
			? max( 60, (int) ceil( $timeout_ms / 1000 ) )
			: max( 30, (int) ceil( $timeout_ms / 1000 ) );
		return (int) apply_filters( 'burst_query_timeout_cooldown_ttl', $base, $this, $timeout_ms );
	}

	/**
	 * Apply all active filters as WHERE conditions on the given Query object.
	 *
	 * @param Query $query The query being assembled.
	 */
	private function build_filter_where( Query $query ): void {
		$filters          = $this->get_filters();
		$possible_filters = Filter_Registry::all();

		// goal_id is normally enforced via the goals JOIN ON clause (see get_available_joins).
		// When campaign/parameter attribution shapes are active, the JOIN-side constraint is
		// the correct one and a WHERE on goals.goal_id would double-filter the subquery results.
		if ( $this->should_suppress_goal_id_filter() ) {
			unset( $possible_filters['goal_id'] );
		}

		// Frontend sends human-readable values for these filters (e.g. browser='Chrome'); the
		// SQL columns store lookup-table IDs. Resolve to IDs before building WHERE clauses.
		$mappable = [ 'browser', 'browser_version', 'platform', 'device' ];
		foreach ( $filters as $filter_name => $filter_value ) {
			if ( in_array( $filter_name, $mappable, true ) ) {
				$filters[ $filter_name ] = burst_loader()->frontend->tracking->get_lookup_table_id( $filter_name, $filter_value );
			}
		}

		foreach ( $filters as $filter => $value ) {
			if ( ! array_key_exists( $filter, $possible_filters ) ) {
				continue;
			}
			$column     = $possible_filters[ $filter ];
			$is_exclude = ( $this->get_filter_exclusions()[ $filter ] ?? 'include' ) === 'exclude';
			$this->add_filter_condition( $query, $filter, $column, $value, $is_exclude );
		}

		$custom = $this->get_custom_where();
		if ( $custom !== '' ) {
			$stripped = trim( preg_replace( '/^AND\s+/i', '', trim( $custom ) ) );
			if ( $stripped !== '' ) {
				$query->where_raw( str_replace( '%', '%%', $stripped ) );
			}
		}
	}

	/**
	 * Returns true when the goal_id filter should be omitted — specifically when a
	 * campaign or parameter metric is selected alongside conversion metrics, which uses a
	 * JOIN-based attribution subquery incompatible with a direct goal_id WHERE clause.
	 *
	 * Background: Campaign_Conversion_Shape and Parameter_Conversion_Shape pre-aggregate the
	 * inner statistics rows by attribution key (uid + campaign params or parameter/value).
	 * The goal_id constraint is already applied inside that subquery via the goals join.
	 * Re-applying it on the outer SELECT would filter out conversions whose attribution row
	 * doesn't itself contain a goals.goal_id column — incorrectly zeroing out valid metrics.
	 */
	private function should_suppress_goal_id_filter(): bool {
		$select          = $this->get_select();
		$campaign_params = [ 'source', 'medium', 'campaign', 'term', 'content' ];
		$goal_or_conv    = in_array( 'conversion_rate', $select, true )
			|| in_array( 'conversions', $select, true )
			|| isset( $this->get_filters()['goal_id'] );
		$sales_or_rev    = in_array( 'sales', $select, true ) || in_array( 'revenue', $select, true );
		$is_conversion   = $goal_or_conv || $sales_or_rev;
		$has_campaign    = ! empty( array_intersect( $campaign_params, $select ) );
		$has_parameter   = in_array( 'parameter', $select, true );
		return $is_conversion && ( $has_campaign || $has_parameter );
	}

	/**
	 * Emit a WHERE condition for a single filter key onto the Query.
	 *
	 * @param Query  $query      The query being assembled.
	 * @param string $filter     Filter key (e.g. 'referrer', 'parameter').
	 * @param string $column     Qualified SQL column for this filter.
	 * @param string $value      Filter value from the request.
	 * @param bool   $is_exclude Whether to negate the condition.
	 */
	private function add_filter_condition( Query $query, string $filter, string $column, string $value, bool $is_exclude ): void {
		global $wpdb;
		$eq_operator  = $is_exclude ? '!=' : '=';
		$like_keyword = $is_exclude ? 'NOT LIKE' : 'LIKE';

		if ( $filter === 'entry_exit_pages' && $value !== '' ) {
			// entry_exit_pages is not in Filter_Registry, so the auto-join loop
			// won't pull in sessions; force the join here.
			$this->with( 'sessions' );
			if ( $value === 'entry' ) {
				$query->where( 'sessions.first_time_visit', 1, '=', '%d' );
			} else {
				// Bound the subquery to the active date range; an unscoped
				// SELECT MAX(ID) ... GROUP BY session_id scans the whole table.
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				$query->where_raw(
					$wpdb->prepare(
						"statistics.ID IN ( SELECT MAX(ID) FROM {$wpdb->prefix}burst_statistics WHERE time BETWEEN %d AND %d GROUP BY session_id)",
						$this->date_start,
						$this->date_end
					)
				);
			}
		} elseif ( $value === 'include' ) {
			$query->where( $column, 1, '=', '%d' );
		} elseif ( $value === 'exclude' ) {
			$query->where( $column, 0, '=', '%d' );
		} elseif ( is_numeric( $value ) ) {
			$query->where( $column, (int) $value, $eq_operator, '%d' );
		} elseif ( str_ends_with( $value, '*' ) ) {
			$like = $wpdb->esc_like( substr( $value, 0, -1 ) ) . '%';
			$query->where( $column, $like, $like_keyword );
		} elseif ( str_contains( $value, ',' ) ) {
			$values = array_map( 'intval', explode( ',', $value ) );
			if ( $is_exclude ) {
				foreach ( $values as $v ) {
					$query->where( $column, $v, '!=', '%d' );
				}
			} else {
				$query->where_group(
					array_merge(
						[ 'relation' => 'OR' ],
						array_map(
							static fn( $v ) => [
								'column'   => $column,
								'value'    => $v,
								'operator' => '=',
								'type'     => '%d',
							],
							$values
						)
					)
				);
			}
		} elseif ( $filter === 'parameter' ) {
			$include_value = str_contains( $value, '=' );
			$value         = sanitize_text_field( $value );
			if ( $include_value ) {
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$query->where_raw( str_replace( '%', '%%', $wpdb->prepare( "CONCAT(params.parameter, '=', params.value) $eq_operator %s", $value ) ) );
			} elseif ( $is_exclude ) {
				$query->where_group(
					[
						'relation' => 'AND',
						[
							'column'   => 'params.parameter',
							'value'    => $value,
							'operator' => '!=',
							'type'     => '%s',
						],
						[
							'column'   => 'params.value',
							'value'    => $value,
							'operator' => '!=',
							'type'     => '%s',
						],
					]
				);
			} else {
				$query->where_group(
					[
						'relation' => 'OR',
						[
							'column'   => 'params.parameter',
							'value'    => $value,
							'operator' => '=',
							'type'     => '%s',
						],
						[
							'column'   => 'params.value',
							'value'    => $value,
							'operator' => '=',
							'type'     => '%s',
						],
					]
				);
			}
		} else {
			$value = sanitize_text_field( $value );
			if ( $filter === 'referrer' ) {
				$like = '%' . $wpdb->esc_like( $value ) . '%';
				if ( $is_exclude ) {
					$query->where_group(
						[
							'relation' => 'OR',
							[
								'column'   => $column,
								'value'    => $like,
								'operator' => $like_keyword,
								'type'     => '%s',
							],
							[
								'column'   => $column,
								'operator' => 'IS NULL',
							],
						]
					);
				} else {
					$query->where( $column, $like, $like_keyword );
				}
			} else {
				$query->where( $column, $value, $eq_operator );
			}
		}
	}

	/**
	 * Build a configured Query_Executor for running this query.
	 *
	 * @param int $timeout_ms Maximum execution time in milliseconds.
	 */
	private function build_executor( int $timeout_ms ): Query_Executor {
		return Query_Executor::create()
			->fingerprint( $this->get_fingerprint_hash() )
			->cache_ttl( $this->get_query_cache_ttl() )
			->cache_group( 'burst_stats_query_results' )
			->single_flight( $this->is_query_single_flight_enabled() )
			->single_flight_wait_ms( $this->get_query_single_flight_wait_ms() )
			->single_flight_lock_ttl( $this->get_query_single_flight_lock_ttl( $timeout_ms ) )
			->timeout_ms( $timeout_ms )
			->timeout_cooldown_ttl( $this->get_query_timeout_cooldown_ttl( $timeout_ms ) )
			->date_range_days( $this->compute_date_range_days() );
	}

	/**
	 * Execute the query and return all matching rows.
	 *
	 * @param string $output_type wpdb output type constant (ARRAY_A, ARRAY_N, OBJECT).
	 * @return array<int, mixed>
	 */
	public function fetch( string $output_type = ARRAY_A ): array {
		$this->enforce_share_link_restrictions();
		do_action( 'burst_statistics_query', $this );
		$q          = $this->to_query();
		$timeout_ms = $this->get_query_timeout_ms();
		$sql        = $this->add_query_timeout_hint( $q->prepare_sql(), $timeout_ms );
		$result     = $this->build_executor( $timeout_ms )->run( $sql, 'get', $output_type );
		return is_array( $result ) ? $result : [];
	}

	/**
	 * Execute the query and return the first matching row, or null if none.
	 *
	 * @template T of string
	 * @phpstan-param T $output_type
	 * @param string $output_type wpdb output type constant.
	 * @phpstan-return (T is 'OBJECT' ? object|null : array<string, mixed>|null)
	 */
	public function fetch_row( string $output_type = ARRAY_A ): null|array|object {
		$this->enforce_share_link_restrictions();
		do_action( 'burst_statistics_query', $this );
		$q          = $this->to_query();
		$timeout_ms = $this->get_query_timeout_ms();
		$sql        = $this->add_query_timeout_hint( $q->prepare_sql(), $timeout_ms );
		return $this->build_executor( $timeout_ms )->run( $sql, 'get_row', $output_type ) ?: null;
	}

	/**
	 * Execute the query and return the first column of the first row. Cache-bypassed.
	 */
	public function fetch_var(): string|int|float|null {
		$this->enforce_share_link_restrictions();
		do_action( 'burst_statistics_query', $this );
		$q          = $this->to_query();
		$timeout_ms = $this->get_query_timeout_ms();
		$sql        = $this->add_query_timeout_hint( $q->prepare_sql(), $timeout_ms );
		return $this->build_executor( $timeout_ms )
			->cache_ttl( 0 )
			->single_flight( false )
			->run( $sql, 'get_var' );
	}

	/**
	 * Build and return the prepared SQL string without executing it.
	 *
	 * @return string Prepared SQL.
	 */
	public function prepare_sql(): string {
		$this->enforce_share_link_restrictions();
		do_action( 'burst_statistics_query', $this );
		$q          = $this->to_query();
		$timeout_ms = $this->get_query_timeout_ms();
		return $this->add_query_timeout_hint( $q->prepare_sql(), $timeout_ms );
	}
}
