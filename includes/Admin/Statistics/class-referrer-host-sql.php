<?php
/**
 * Referrer host SQL helpers.
 *
 * @package Burst
 */

namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Builds SQL fragments that match a stored referrer host against a list of
 * host patterns. Shared by the Pro source classifier and the telemetry
 * collectors so both classify a referrer the same way.
 */
class Referrer_Host_Sql {

	/**
	 * SQL expression that lowercases a referrer host column and strips a
	 * leading "www." so patterns only need the bare host.
	 *
	 * @param string $column Fully qualified referrer column, e.g. `sessions.referrer`.
	 */
	public static function normalized_host_expression( string $column ): string {
		return "LOWER(CASE WHEN {$column} LIKE 'www.%' THEN SUBSTRING({$column}, 5) ELSE {$column} END)";
	}

	/**
	 * Build an OR-ed SQL condition matching a host expression against patterns.
	 *
	 * A pattern ending in a dot (e.g. `google.`) matches every TLD variant; any
	 * other pattern matches the exact host and its subdomains.
	 *
	 * @param string $column   SQL expression yielding the normalized host.
	 * @param array  $patterns Host patterns.
	 * @return string SQL condition wrapped in parentheses, or '' when no pattern is usable.
	 */
	public static function build_host_match_sql( string $column, array $patterns ): string {
		global $wpdb;
		$conds = [];
		foreach ( $patterns as $pattern ) {
			$pattern = strtolower( trim( (string) $pattern ) );
			if ( '' === $pattern ) {
				continue;
			}
			$esc_pattern = esc_sql( $wpdb->esc_like( $pattern ) );
			if ( str_ends_with( $pattern, '.' ) ) {
				$base     = rtrim( $pattern, '.' );
				$esc_base = esc_sql( $base );
				$conds[]  = "$column = '$esc_base'";
				$conds[]  = "$column LIKE '$esc_pattern%'";
				$conds[]  = "$column LIKE '%.$esc_pattern%'";
			} else {
				$esc_base = esc_sql( $pattern );
				$conds[]  = "$column = '$esc_base'";
				$conds[]  = "$column LIKE '%.$esc_pattern'";
			}
		}
		if ( empty( $conds ) ) {
			return '';
		}
		return '(' . implode( ' OR ', $conds ) . ')';
	}
}
