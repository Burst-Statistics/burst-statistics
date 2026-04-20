<?php
defined( 'ABSPATH' ) || die();

/**
 * Excludes some Uncode inline scripts from combine JS.
 *
 * @since 3.1
 * @author Remy Perona
 * @param array<int, string> $inline_js Array of patterns to match for exclusion.
 * @return array<int, string> Updated array of exclusion patterns.
 */
function burst_exclude_inline_js( array $inline_js ): array {
	$inline_js[] = 'burst';

	return $inline_js;
}
add_filter( 'rocket_excluded_inline_js_content', 'burst_exclude_inline_js' );

/**
 * Excludes Uncode init and ai-uncode JS files from minification/combine
 *
 * @since 3.1
 * @author Remy Perona
 * @param array<int, string> $excluded_js Array of JS filepaths (regex patterns) to be excluded.
 * @return array<int, string> Updated array of excluded JS filepaths.
 */
function burst_exclude_js( array $excluded_js ): array {
	$excluded_js[] = '(.*)timeme(.*)';
	$excluded_js[] = '(.*)burst(.*)';
	return $excluded_js;
}
add_filter( 'rocket_exclude_js', 'burst_exclude_js' );
