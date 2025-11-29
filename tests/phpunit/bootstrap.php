<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', 1);
//define('WP_DEBUG', true);
//define('WP_DEBUG_DISPLAY', true);
// Autoload plugin classes if needed
//require_once dirname( __DIR__, 2 ) . '/burst-pro.php';

//get wordpress
define( 'ABSPATH', '/var/www/html/' );
//define( 'ABSPATH', dirname( __DIR__, 5 ).'/' );
require_once ABSPATH . 'wp-load.php';

require_once ABSPATH . 'wp-content/plugins/burst-statistics/burst.php';