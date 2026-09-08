<?php
defined( 'ABSPATH' ) || die();

/**
 * Exclude the public Burst tracking routes from SiteGround caching.
 *
 * @param string[] $excluded_urls URL patterns relative to the site URL.
 * @return string[]
 */
function burst_exclude_tracking_from_siteground_cache( array $excluded_urls ): array {
	// Prefix the home path so the pattern also matches on subdirectory installs.
	$home_path      = wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/';
	$tracking_paths = [
		$home_path . trim( rest_get_url_prefix(), '/' ) . '/burst/v1/track*',
		wp_parse_url( BURST_URL . 'endpoint.php', PHP_URL_PATH ) . '*',
	];

	foreach ( $tracking_paths as $tracking_path ) {
		if ( ! in_array( $tracking_path, $excluded_urls, true ) ) {
			$excluded_urls[] = $tracking_path;
		}
	}

	return $excluded_urls;
}
add_filter( 'sgo_exclude_urls_from_cache', 'burst_exclude_tracking_from_siteground_cache' );

/**
 * Disable SiteGround caching for Burst tracking responses.
 *
 * @param array<string, string|false> $headers Response headers.
 * @return array<string, string|false>
 */
function burst_disable_siteground_cache_for_tracking_response( array $headers ): array {
	$headers['X-Cache-Enabled'] = 'False';

	return $headers;
}
add_filter( 'burst_tracking_response_headers', 'burst_disable_siteground_cache_for_tracking_response' );
