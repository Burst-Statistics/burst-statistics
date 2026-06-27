<?php
/**
 * Query Builder
 *
 * @package Burst\Admin\Database
 */

namespace Burst\Admin\Database;

use Burst\Traits\Database_Helper;
use wpdb;

/**
 * Class Query - Handles structured querying.
 * Provides a fluent interface for building and executing database queries
 * with proper sanitization, caching, and error handling.
 */
class Query {
	use Database_Helper;

	/**
	 * Database instance.
	 */
	private wpdb $wpdb;

	/**
	 * Query SELECT fields.
	 */
	private array $select = [];

	/**
	 * Raw SELECT expressions with prepared values.
	 */
	private array $select_values = [];

	/**
	 * Values from a compiled subquery used in FROM, bound after SELECT values.
	 */
	private array $subquery_values = [];

	/**
	 * Query FROM table.
	 */
	private string $from = '';

	/**
	 * Query JOIN clauses.
	 */
	private array $joins = [];

	/**
	 * Query WHERE conditions.
	 */
	private array $where = [];

	/**
	 * Query WHERE condition values for preparation.
	 */
	private array $where_values = [];

	/**
	 * Query GROUP BY clause.
	 */
	private string $group_by = '';

	/**
	 * Query ORDER BY clause.
	 */
	private string $order_by = '';

	/**
	 * Query LIMIT.
	 */
	private int $limit = 0;

	/**
	 * Having clause for grouped data.
	 */
	private array $having = [];

	/**
	 * Values for Having clause.
	 */
	private array $having_values = [];

	/**
	 * Constructor.
	 */
	public function __construct() {
		global $wpdb;
		$this->wpdb = $wpdb;
	}

	/**
	 * Create a new query instance.
	 *
	 * @return self Return the current instance for chaining use.
	 */
	public static function create(): self {
		return new self();
	}

	/**
	 * Set SELECT fields.
	 *
	 * @param string|array $fields Fields to select.
	 * @return self Return the current instance for chaining use.
	 */
	public function select( string|array $fields ): self {
		if ( is_string( $fields ) ) {
			$this->select[] = $fields;
		} elseif ( is_array( $fields ) ) {
			$this->select = array_merge( $this->select, $fields );
		}
		return $this;
	}

	/**
	 * Add a raw SELECT expression, optionally with alias and prepared values.
	 *
	 * @param string       $expression Raw SQL expression to append to SELECT.
	 * @param string|array $alias      Column alias, or values array for back-compat.
	 * @param array        $values     Values to bind (matched to %s/%d/%f placeholders).
	 * @return self Return the current instance for chaining use.
	 * @throws \InvalidArgumentException If placeholder count does not match values count.
	 */
	public function select_raw( string $expression, string|array $alias = '', array $values = [] ): self {
		// Back-compat: if $alias is an array, treat it as $values.
		if ( is_array( $alias ) ) {
			$values = $alias;
			$alias  = '';
		}

		if ( ! empty( $values ) ) {
			$placeholder_count = preg_match_all( '/%(s|d|f)/', $expression, $m );
			if ( $placeholder_count !== count( $values ) ) {
				throw new \InvalidArgumentException(
					'select_raw(): placeholder count does not match values count.'
				);
			}
		}

		if ( $alias !== '' ) {
			$safe_alias = $this->sanitize_identifier( $alias );
			$expression = '(' . $expression . ') AS ' . $safe_alias;
		}

		$this->select[]      = $expression;
		$this->select_values = array_merge( $this->select_values, array_values( $values ) );
		return $this;
	}

	/**
	 * Add a period SELECT expression for time-grouped queries.
	 *
	 * Convenience wrapper: DATE_FORMAT(FROM_UNIXTIME(time + {tz_offset}), '{sql_format}') AS period
	 *
	 * @param int    $tz_offset  Timezone offset in seconds.
	 * @param string $sql_format MySQL date format string (e.g. '%Y-%m-%d').
	 * @return self Return the current instance for chaining use.
	 */
	public function period_select( int $tz_offset, string $sql_format ): self {
		return $this->select_raw(
			'DATE_FORMAT(FROM_UNIXTIME(time + %d), %s) AS period',
			[ $tz_offset, $sql_format ]
		);
	}

	/**
	 * Create from using subquery.
	 *
	 * @param \Burst\Admin\Database\Query $query Query instance to create subquery from.
	 * @param string                      $alias Alias for subquery.
	 * @return self Return the current instance for chaining use.
	 */
	public function from_subquery( Query $query, string $alias ): self {
		[ $sub_sql, $sub_values ] = $query->compile();
		$this->from               = '(' . $sub_sql . ') AS ' . $this->sanitize_identifier( $alias );
		$this->subquery_values    = $sub_values;
		return $this;
	}

	/**
	 * Set FROM table.
	 *
	 * @param string $table Table name (without prefix).
	 * @param string $alias Optional table alias.
	 * @return self Return the current instance for chaining use.
	 * @throws \InvalidArgumentException If table name looks like a subquery (starts with '(').
	 */
	public function from( string $table, string $alias = '' ): self {
		if ( str_starts_with( trim( $table ), '(' ) ) {
			throw new \InvalidArgumentException(
				'from() does not support subqueries. Use from_subquery() instead.'
			);
		}

		$this->from = $this->sanitize_table_name( $table );

		if ( ! empty( $alias ) ) {
			$this->from .= ' AS ' . $this->sanitize_identifier( $alias );
		}

		return $this;
	}

	/**
	 * Add INNER JOIN.
	 *
	 * @param string $table Table name (without prefix).
	 * @param string $condition Join condition.
	 * @param string $alias Optional table alias.
	 * @return self Return the current instance for chaining use.
	 */
	public function inner_join( string $table, string $condition, string $alias = '' ): self {
		return $this->add_join( 'INNER', $table, $condition, $alias );
	}

	/**
	 * Add LEFT JOIN.
	 *
	 * @param string $table Table name (without prefix).
	 * @param string $condition Join condition.
	 * @param string $alias Optional table alias.
	 * @return self Return the current instance for chaining use.
	 */
	public function left_join( string $table, string $condition, string $alias = '' ): self {
		return $this->add_join( 'LEFT', $table, $condition, $alias );
	}

	/**
	 * Add WHERE condition.
	 *
	 * @param string $column Column name.
	 * @param mixed  $value Value to compare.
	 * @param string $operator Comparison operator (=, !=, >, <, >=, <=, IN, NOT IN, LIKE).
	 * @param string $type Value type for wpdb::prepare (%s, %d, %f).
	 * @return self Return the current instance for chaining use.
	 *
	 * Mixed $value: a query value is intentionally polymorphic — string|int|float for scalar comparisons, array for IN/NOT IN, null for IS NULL.
	 */
	public function where( string $column, mixed $value, string $operator = '=', string $type = '%s' ): self {
		$column   = $this->sanitize_qualified_column( $column );
		$operator = strtoupper( trim( $operator ) );

		// Validate operator.
		$allowed_operators = [ '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL' ];

		if ( ! in_array( $operator, $allowed_operators, true ) ) {
			$operator = '=';
		}

		$allowed_types = [ '%s', '%d', '%f' ];
		if ( ! in_array( $type, $allowed_types, true ) ) {
			$type = '%s';
		}

		// Handle IS NULL and IS NOT NULL operators (no value/placeholder).
		if ( in_array( $operator, [ 'IS NULL', 'IS NOT NULL' ], true ) ) {
			$this->where[] = sprintf( '%s %s', $column, $operator );
			return $this;
		}

		// Handle IN and NOT IN operators.
		if ( in_array( $operator, [ 'IN', 'NOT IN' ], true ) ) {
			if ( ! is_array( $value ) ) {
				$value = [ $value ];
			}
			$placeholders       = implode( ', ', array_fill( 0, count( $value ), $type ) );
			$this->where[]      = sprintf( '%s %s (%s)', $column, $operator, $placeholders );
			$this->where_values = array_merge( $this->where_values, array_values( $value ) );
		} else {
			$this->where[]        = sprintf( '%s %s %s', $column, $operator, $type );
			$this->where_values[] = $value;
		}

		return $this;
	}

	/**
	 * Add WHERE BETWEEN condition into SQL>
	 *
	 * @param string $column         Column name.
	 * @param mixed  $boundary_start Start value for BETWEEN condition.
	 * @param mixed  $boundary_end   End value for BETWEEN condition.
	 * @param string $type           Type of the boundary_start and boundary_end value.
	 *
	 * Mixed $boundary_start/$boundary_end: BETWEEN bounds are scalar query values (string|int|float) supplied by callers; kept generic like where().
	 */
	public function where_between( string $column, mixed $boundary_start, mixed $boundary_end, string $type = '%s' ): self {
		$allowed_types = [ '%s', '%d', '%f' ];
		if ( ! in_array( $type, $allowed_types, true ) ) {
			$type = '%s';
		}

		$this->where[]        = sprintf( '%s BETWEEN %s AND %s', $column, $type, $type );
		$this->where_values[] = $boundary_start;
		$this->where_values[] = $boundary_end;

		return $this;
	}

	/**
	 * Add WHERE condition with raw SQL (use with caution).
	 *
	 * @param string $condition Raw SQL condition.
	 * @param array  $values Optional values to prepare.
	 * @return self Return the current instance for chaining use.
	 * @throws \InvalidArgumentException If condition contains user input without placeholders.
	 */
	public function where_raw( string $condition, array $values = [] ): self {
		// Count only real wpdb placeholders; LIKE wildcards ('%foo%') and date format
		// tokens ('%Y-%m-%d') are not placeholders and would falsely trip a bare '%' count.
		if ( ! empty( $values ) && preg_match_all( '/%[sdf]/', $condition ) !== count( $values ) ) {
			throw new \InvalidArgumentException(
				'where_raw(): placeholder count does not match values count.'
			);
		}

		$this->where[] = $condition;

		if ( ! empty( $values ) ) {
			$this->where_values = array_merge( $this->where_values, array_values( $values ) );
		}
		return $this;
	}

	/**
	 * Add date range WHERE condition.
	 *
	 * @param string $column Column name.
	 * @param int    $start_timestamp Start timestamp.
	 * @param int    $end_timestamp End timestamp.
	 * @param bool   $inclusive_end Include end date + 1 second.
	 * @return self Return the current instance for chaining use.
	 */
	public function where_date_range( string $column, int $start_timestamp, int $end_timestamp, bool $inclusive_end = true ): self {
		$start_date = gmdate( 'Y-m-d H:i:s', $start_timestamp );
		$end_date   = gmdate( 'Y-m-d H:i:s', $inclusive_end ? $end_timestamp + 1 : $end_timestamp );

		$this->where[]        = sprintf( '%s >= %%s AND %s < %%s', $column, $column );
		$this->where_values[] = $start_date;
		$this->where_values[] = $end_date;

		return $this;
	}

	/**
	 * Add WHERE IN condition.
	 *
	 * @param string $column Column name.
	 * @param array  $values Array of values.
	 * @param string $type Value type (%s, %d, %f).
	 * @return self Return the current instance for chaining use.
	 */
	public function where_in( string $column, array $values, string $type = '%s' ): self {
		return $this->where( $column, $values, 'IN', $type );
	}

	/**
	 * Add WHERE NOT IN condition.
	 *
	 * @param string $column Column name.
	 * @param array  $values Array of values.
	 * @param string $type Value type (%s, %d, %f).
	 * @return self Return the current instance for chaining use.
	 */
	public function where_not_in( string $column, array $values, string $type = '%s' ): self {
		return $this->where( $column, $values, 'NOT IN', $type );
	}

	/**
	 * Add WHERE IS NULL condition.
	 *
	 * @param string $column Column name.
	 * @return self Return the current instance for chaining use.
	 */
	public function where_null( string $column ): self {
		return $this->where( $column, null, 'IS NULL' );
	}

	/**
	 * Add WHERE IS NOT NULL condition.
	 *
	 * @param string $column Column name.
	 * @return self Return the current instance for chaining use.
	 */
	public function where_not_null( string $column ): self {
		return $this->where( $column, null, 'IS NOT NULL' );
	}

	/**
	 * Add a grouped WHERE condition with AND/OR relation.
	 *
	 * @param array $conditions Array of conditions with optional 'relation' key.
	 * @return self Return the current instance for chaining use.
	 */
	public function where_group( array $conditions ): self {
		if ( empty( $conditions ) ) {
			return $this;
		}
		[ $sql, $values ] = $this->compile_where_group( $conditions );
		if ( $sql !== '' ) {
			$this->where[]      = $sql;
			$this->where_values = array_merge( $this->where_values, $values );
		}
		return $this;
	}

	/**
	 * Set GROUP BY clause.
	 *
	 * @param string $column Column name, or a comma-separated list of column names.
	 * @return self Return the current instance for chaining use.
	 */
	public function group_by( string $column ): self {
		// Column names only — same guard as where(); keeps a future caller from
		// ever feeding user input into the clause.
		$columns        = array_filter(
			array_map( [ $this, 'sanitize_qualified_column' ], explode( ',', $column ) ),
			static fn( string $col ): bool => '' !== $col
		);
		$this->group_by = 'GROUP BY ' . implode( ', ', $columns );
		return $this;
	}

	/**
	 * Add HAVING condition.
	 *
	 * @param string $condition Column or expression (e.g. COUNT(*)).
	 * @param mixed  $value Value to compare.
	 * @param string $operator Comparison operator.
	 * @param string $type Value type for wpdb::prepare (%s, %d, %f).
	 * @return self Return the current instance for chaining use.
	 *
	 * Mixed $value: like where(), a HAVING value is polymorphic — string|int|float for scalar comparisons, array for IN/NOT IN, null for IS NULL.
	 */
	public function having( string $condition, mixed $value, string $operator = '=', string $type = '%s' ): self {
		$operator = strtoupper( trim( $operator ) );

		$allowed_operators = [ '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE' ];
		if ( ! in_array( $operator, $allowed_operators, true ) ) {
			$operator = '=';
		}

		$allowed_types = [ '%s', '%d', '%f' ];
		if ( ! in_array( $type, $allowed_types, true ) ) {
			$type = '%s';
		}

		// Handle IN and NOT IN operators.
		if ( in_array( $operator, [ 'IN', 'NOT IN' ], true ) ) {
			if ( ! is_array( $value ) ) {
				$value = [ $value ];
			}
			$placeholders        = implode( ', ', array_fill( 0, count( $value ), $type ) );
			$this->having[]      = sprintf( '%s %s (%s)', $condition, $operator, $placeholders );
			$this->having_values = array_merge( $this->having_values, array_values( $value ) );
		} else {
			$this->having[]        = sprintf( '%s %s %s', $condition, $operator, $type );
			$this->having_values[] = $value;
		}

		return $this;
	}

	/**
	 * Add a raw HAVING condition (pre-formatted string, no parameter binding).
	 *
	 * @param string $condition Already-escaped HAVING condition.
	 * @return self Return the current instance for chaining use.
	 */
	public function having_raw( string $condition ): self {
		if ( $condition !== '' ) {
			$this->having[] = $condition;
		}
		return $this;
	}

	/**
	 * Set ORDER BY clause.
	 *
	 * @param string $column Column name.
	 * @param string $direction Sort direction (ASC or DESC).
	 * @return self Return the current instance for chaining use.
	 */
	public function order_by( string $column, string $direction = 'ASC' ): self {
		$direction      = strtoupper( $direction ) === 'DESC' ? 'DESC' : 'ASC';
		$this->order_by = sprintf( 'ORDER BY %s %s', $column, $direction );
		return $this;
	}

	/**
	 * Set ORDER BY clause from a pre-built string (no direction appended).
	 *
	 * Use for multi-column or already-directioned ORDER BY strings.
	 *
	 * @param string $clause Pre-built ORDER BY expression, e.g. "pageviews DESC, visitors ASC".
	 * @return self Return the current instance for chaining use.
	 */
	public function order_by_raw( string $clause ): self {
		if ( $clause !== '' ) {
			$this->order_by = 'ORDER BY ' . $clause;
		}
		return $this;
	}

	/**
	 * Set LIMIT.
	 *
	 * @param int $limit Number of rows to limit.
	 * @return self Return the current instance for chaining use.
	 */
	public function limit( int $limit ): self {
		$this->limit = max( 0, $limit );
		return $this;
	}

	/**
	 * Build the final SQL query: compile, prepare once, and add timeout hint.
	 */
	public function build_sql(): string {
		[ $sql, $values ] = $this->compile();

		if ( empty( $sql ) ) {
			return '';
		}

		if ( ! empty( $values ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$sql = $this->wpdb->prepare( $sql, $values );
		}

		$timeout_ms = $this->resolve_query_timeout_ms(
			'burst_subscription_query_timeout_ms',
			'burst_subscription_query_timeout_ms_background',
			null,
			30000,
			900000,
			0,
			true
		);

		return $this->add_query_timeout_hint( $sql, $timeout_ms );
	}

	/**
	 * Compile and prepare SQL without adding a query timeout hint.
	 *
	 * Use when the caller handles timeout and hint injection separately
	 * (e.g. Statistics::build_query_sql()).
	 *
	 * @return string Prepared SQL without timeout hint.
	 */
	public function prepare_sql(): string {
		[ $sql, $values ] = $this->compile();

		if ( ! empty( $values ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$sql = $this->wpdb->prepare( $sql, $values );
		}

		return $sql;
	}

	/**
	 * Compile to [sql_with_placeholders, values] without preparing — allows safe merging into a parent query.
	 *
	 * @return array{0: string, 1: array}
	 */
	private function compile(): array {
		$sql_parts = [];

		// SELECT.
		$select_fields = ! empty( $this->select ) ? implode( ', ', $this->select ) : '*';
		$sql_parts[]   = 'SELECT ' . $select_fields;

		// FROM.
		if ( empty( $this->from ) ) {
			return [ '', [] ];
		}
		$sql_parts[] = 'FROM ' . $this->from;

		// JOINs.
		if ( ! empty( $this->joins ) ) {
			$sql_parts[] = implode( ' ', $this->joins );
		}

		// WHERE.
		if ( ! empty( $this->where ) ) {
			$sql_parts[] = 'WHERE ' . implode( ' AND ', $this->where );
		}

		// GROUP BY.
		if ( ! empty( $this->group_by ) ) {
			$sql_parts[] = $this->group_by;
		}

		if ( ! empty( $this->having ) ) {
			$sql_parts[] = 'HAVING ' . implode( ' AND ', $this->having );
		}

		// ORDER BY.
		if ( ! empty( $this->order_by ) ) {
			$sql_parts[] = $this->order_by;
		}

		// LIMIT.
		if ( $this->limit > 0 ) {
			$sql_parts[] = sprintf( 'LIMIT %d', $this->limit );
		}

		$sql = implode( ' ', $sql_parts );
		// Value order matches SQL clause order: SELECT, FROM (subquery), WHERE, HAVING.
		$values = array_merge( $this->select_values, $this->subquery_values, $this->where_values, $this->having_values );

		return [ $sql, $values ];
	}

	/**
	 * Add a JOIN clause.
	 *
	 * @param string $type Join type (INNER, LEFT, RIGHT).
	 * @param string $table Table name (without prefix).
	 * @param string $condition Join condition.
	 * @param string $alias Optional table alias.
	 * @return self Return the current instance for chaining use.
	 */
	private function add_join( string $type, string $table, string $condition, string $alias = '' ): self {
		$table_name = $this->sanitize_table_name( $table );

		if ( ! empty( $alias ) ) {
			$table_name .= ' AS ' . $this->sanitize_identifier( $alias );
		}

		$this->joins[] = sprintf( '%s JOIN %s ON %s', $type, $table_name, $condition );

		return $this;
	}

	/**
	 * Compile a where_group condition array into [sql, values].
	 *
	 * @param array $group Condition array with optional 'relation' key and numeric leaf entries.
	 * @param int   $depth Current recursion depth.
	 * @return array{0: string, 1: array}
	 */
	private function compile_where_group( array $group, int $depth = 0 ): array {
		if ( $depth > 5 || empty( $group ) ) {
			return [ '', [] ];
		}

		$relation = strtoupper( $group['relation'] ?? 'AND' );
		if ( ! in_array( $relation, [ 'AND', 'OR' ], true ) ) {
			$relation = 'AND';
		}

		$allowed_operators = [ '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL' ];
		$allowed_types     = [ '%s', '%d', '%f' ];

		$parts  = [];
		$values = [];

		foreach ( $group as $key => $child ) {
			if ( ! is_int( $key ) || ! is_array( $child ) ) {
				continue;
			}

			// Nested group.
			if ( isset( $child['relation'] ) ) {
				[ $sub_sql, $sub_values ] = $this->compile_where_group( $child, $depth + 1 );
				if ( $sub_sql !== '' ) {
					$parts[] = $sub_sql;
					$values  = array_merge( $values, $sub_values );
				}
				continue;
			}

			// Leaf condition.
			if ( ! isset( $child['column'] ) ) {
				continue;
			}

			$column   = $this->sanitize_qualified_column( $child['column'] );
			$operator = strtoupper( trim( $child['operator'] ?? '=' ) );
			$type     = $child['type'] ?? '%s';
			$value    = $child['value'] ?? null;

			if ( ! in_array( $operator, $allowed_operators, true ) ) {
				$operator = '=';
			}
			if ( ! in_array( $type, $allowed_types, true ) ) {
				$type = '%s';
			}

			if ( in_array( $operator, [ 'IS NULL', 'IS NOT NULL' ], true ) ) {
				$parts[] = sprintf( '%s %s', $column, $operator );
				continue;
			}

			if ( in_array( $operator, [ 'IN', 'NOT IN' ], true ) ) {
				if ( ! is_array( $value ) ) {
					$value = [ $value ];
				}
				$placeholders = implode( ', ', array_fill( 0, count( $value ), $type ) );
				$parts[]      = sprintf( '%s %s (%s)', $column, $operator, $placeholders );
				$values       = array_merge( $values, array_values( $value ) );
				continue;
			}

			$parts[]  = sprintf( '%s %s %s', $column, $operator, $type );
			$values[] = $value;
		}

		if ( empty( $parts ) ) {
			return [ '', [] ];
		}

		return [ '( ' . implode( ' ' . $relation . ' ', $parts ) . ' )', $values ];
	}

	/**
	 * Sanitize table name.
	 *
	 * @param string $table Table name.
	 */
	private function sanitize_table_name( string $table ): string {
		// Subqueries are already fully formed — pass through as-is.
		if ( str_starts_with( ltrim( $table ), '(' ) ) {
			return $table;
		}

		$table = preg_replace( '/[^a-zA-Z0-9_]/', '', $table );

		if ( ! str_starts_with( $table, $this->wpdb->prefix ) ) {
			$table = $this->wpdb->prefix . $table;
		}

		return $table;
	}

	/**
	 * Sanitize identifier (table/column alias).
	 *
	 * @param string $identifier Identifier to sanitize.
	 */
	private function sanitize_identifier( string $identifier ): string {
		// Only allow alphanumeric characters and underscores.
		return preg_replace( '/[^a-zA-Z0-9_]/', '', $identifier );
	}

	/**
	 * Sanitize a qualified column name (table.column or bare column).
	 *
	 * @param string $col Column name, optionally qualified with table prefix.
	 */
	private function sanitize_qualified_column( string $col ): string {
		return preg_replace( '/[^a-zA-Z0-9_.]/', '', $col );
	}
}
