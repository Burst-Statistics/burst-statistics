<?php

if ( ! class_exists( 'WP_CLI' ) ) {
	return;
}

$wpcli_export_autoloader = __DIR__ . '/vendor/autoload.php';
if ( file_exists( $wpcli_export_autoloader ) ) {
	require_once $wpcli_export_autoloader;
}

WP_CLI::add_command( 'export', 'Export_Command' );
