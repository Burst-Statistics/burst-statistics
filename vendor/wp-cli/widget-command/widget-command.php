<?php

if ( ! class_exists( 'WP_CLI' ) ) {
	return;
}

$wpcli_widget_autoloader = __DIR__ . '/vendor/autoload.php';
if ( file_exists( $wpcli_widget_autoloader ) ) {
	require_once $wpcli_widget_autoloader;
}

WP_CLI::add_command( 'widget', 'Widget_Command' );
WP_CLI::add_command( 'sidebar', 'Sidebar_Command' );
