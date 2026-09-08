<?php
defined( 'ABSPATH' ) || die();

/**
 * Excludes the Burst dashboard app scripts from WP-Optimize minify/merge.
 *
 * The dashboard app loads its webpack chunks relative to the URL of the main
 * script (publicPath "auto"). When WP-Optimize moves that script into its
 * minify cache — which happens on the front-end shared dashboard page — chunk
 * requests resolve against the cache directory and 404 ("Loading chunk N
 * failed"). Entries are matched as case-insensitive substrings of the asset
 * URL. Only the app build is excluded; the tracking scripts are left to
 * WP-Optimize.
 *
 * @param array<int, string> $default_exclusions Substrings of asset URLs excluded from processing.
 */
function burst_wpo_minify_exclusions( array $default_exclusions ): array {
	$default_exclusions[] = 'includes/Admin/App/build';
	return $default_exclusions;
}
add_filter( 'wp-optimize-minify-default-exclusions', 'burst_wpo_minify_exclusions' );
