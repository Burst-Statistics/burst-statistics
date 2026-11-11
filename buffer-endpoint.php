<?php
/**
 * Burst Statistics standalone high-traffic buffer endpoint.
 *
 * Appends hits to a local disk buffer without bootstrapping WordPress or connecting to MySQL.
 *
 * @package Burst
 */

// phpcs:disable WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
// phpcs:disable WordPress.Security.ValidatedSanitizedInput.MissingUnslash
// phpcs:disable WordPress.WP.AlternativeFunctions
// phpcs:disable WordPress.PHP.NoSilencedErrors.Discouraged
// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited

namespace Burst;

// Define marker constant so burst-buffer-config.php allows inclusion without direct web disclosure.
if ( ! defined( 'BURST_BUFFER_ENDPOINT' ) ) {
	define( 'BURST_BUFFER_ENDPOINT', true );
}

require_once __DIR__ . '/includes/base-path.php';

$burst_wp_path     = burst_find_wordpress_base_path();
$burst_config_file = $burst_wp_path . 'burst-buffer-config.php';

// 1. Fallback: Missing config file or invalid configuration structure.
clearstatcache( true, $burst_config_file );
if ( ! file_exists( $burst_config_file ) ) {
	require __DIR__ . '/endpoint.php';
	return;
}

$burst_config = include $burst_config_file;
if (
	! is_array( $burst_config )
	|| 1 !== ( $burst_config['format'] ?? 0 )
	|| empty( $burst_config['enabled'] )
	|| empty( $burst_config['buffer_dir'] )
) {
	require __DIR__ . '/endpoint.php';
	return;
}

$burst_buffer_dir     = rtrim( (string) $burst_config['buffer_dir'], '/' ) . '/';
$burst_heartbeat_file = $burst_buffer_dir . 'heartbeat';

// 2. Fallback: Missing or stale heartbeat (more than 600s old).
clearstatcache( true, $burst_heartbeat_file );
if ( ! file_exists( $burst_heartbeat_file ) || ( time() - (int) @filemtime( $burst_heartbeat_file ) ) > 600 ) {
	require __DIR__ . '/endpoint.php';
	return;
}

// 3. Fallback: Buffer directory is not writable.
clearstatcache( true, $burst_buffer_dir );
if ( ! is_dir( $burst_buffer_dir ) || ! is_writable( $burst_buffer_dir ) ) {
	require __DIR__ . '/endpoint.php';
	return;
}

// 4. Fallback: Buffer directory files total more than 100 MB.
$burst_files       = @scandir( $burst_buffer_dir );
$burst_total_bytes = 0;
if ( is_array( $burst_files ) ) {
	foreach ( $burst_files as $burst_file ) {
		if ( '.' === $burst_file || '..' === $burst_file ) {
			continue;
		}
		$burst_file_path = $burst_buffer_dir . $burst_file;
		if ( is_file( $burst_file_path ) ) {
			$burst_total_bytes += (int) @filesize( $burst_file_path );
		}
	}
}
if ( $burst_total_bytes > 104857600 ) { // 100 MB.
	require __DIR__ . '/endpoint.php';
	return;
}

// Handle CORS preflight if requested.
if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
	header( 'Access-Control-Allow-Origin: *' );
	header( 'Access-Control-Allow-Methods: POST, OPTIONS' );
	header( 'Access-Control-Allow-Headers: Content-Type' );
	header( 'Access-Control-Max-Age: 3600' );
	http_response_code( 204 );
	exit;
}

$burst_raw_input = file_get_contents( 'php://input' );
if ( ( false === $burst_raw_input || '' === $burst_raw_input ) && 'cli' === PHP_SAPI ) {
	$burst_raw_input = file_get_contents( 'php://stdin' );
}

// The admin endpoint test (Endpoint_Test::endpoint_test_request()) posts this
// form-encoded probe to the beacon URL. Answer it like endpoint.php does;
// a 400 would switch the site to REST tracking and bypass the buffer.
if ( 'request=test' === $burst_raw_input ) {
	http_response_code( 200 );
	echo 'success';
	exit;
}

// Check 1: Request body is at most 16 KB (16384 bytes).
if ( false === $burst_raw_input || strlen( $burst_raw_input ) > 16384 ) {
	http_response_code( 400 );
	exit;
}

// Check 2: It is valid JSON.
$burst_payload = json_decode( $burst_raw_input, true );
if ( ! is_array( $burst_payload ) ) {
	http_response_code( 400 );
	exit;
}

// Check 3: It contains a non-empty uid or fingerprint.
$burst_uid         = isset( $burst_payload['uid'] ) ? trim( (string) $burst_payload['uid'] ) : '';
$burst_fingerprint = isset( $burst_payload['fingerprint'] ) ? trim( (string) $burst_payload['fingerprint'] ) : '';
if ( '' === $burst_uid && '' === $burst_fingerprint ) {
	http_response_code( 400 );
	exit;
}

// Extract the raw $_SERVER headers that Ip::get_ip_address() and GeoIP/CDN country lookups read.
$burst_header_keys = [
	'HTTP_CF_CONNECTING_IP',
	'HTTP_TRUE_CLIENT_IP',
	'HTTP_X_FORWARDED_FOR',
	'HTTP_X_REAL_IP',
	'HTTP_X_CLUSTER_CLIENT_IP',
	'HTTP_CLIENT_IP',
	'HTTP_CF_IPCOUNTRY',
	'HTTP_X_VERCEL_IP_COUNTRY',
	'HTTP_CLOUDFRONT_VIEWER_COUNTRY',
	'HTTP_X_COUNTRY_CODE',
	'HTTP_X_COUNTRY',
	'HTTP_X_REAL_IP_COUNTRY',
	'HTTP_USER_AGENT',
];

$burst_headers = [];
foreach ( $burst_header_keys as $burst_key ) {
	if ( isset( $_SERVER[ $burst_key ] ) ) {
		$burst_headers[ $burst_key ] = (string) $_SERVER[ $burst_key ];
	}
}

$burst_entry = [
	'v'           => 1,
	'time'        => time(),
	'remote_addr' => (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ),
	'headers'     => $burst_headers,
	'payload'     => $burst_payload,
];

$burst_line = json_encode( $burst_entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
if ( false === $burst_line ) {
	http_response_code( 500 );
	exit;
}

$burst_active_file = $burst_buffer_dir . 'burst-buffer.log';
// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
$burst_written = @file_put_contents( $burst_active_file, $burst_line . "\n", FILE_APPEND | LOCK_EX );
if ( false === $burst_written ) {
	http_response_code( 500 );
	exit;
}

header( 'Content-Type: application/json; charset=UTF-8' );
header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
http_response_code( 200 );
echo '{"success":"hit_buffered"}';
exit;
