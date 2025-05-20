<?php
/**
 * Plugin Name: Burst Statistics - Privacy-Friendly Analytics for WordPress
 * Plugin URI: https://www.wordpress.org/plugins/burst-statistics
 * Description: Get detailed insights into visitors’ behavior with Burst Statistics, the privacy-friendly analytics dashboard.
 * Version: 2.0.6
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Text Domain: burst-statistics
 * Domain Path: /languages
 * Author: Burst Statistics - Stats & Analytics for WordPress
 * Author URI: https://burst-statistics.com
 */

/*
    Copyright 2023  Burst BV  (email : support@burst-statistics.com)

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as
    published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

namespace Burst;

defined( 'ABSPATH' ) || die();
if ( defined( 'BURST_PRO_FILE' ) ) {
    return;
}

define( 'BURST_FREE_FILE', __FILE__ );

require_once __DIR__ . '/src/autoload.php';

if ( ! function_exists( '\Burst\burst_loader' ) ) {
    global $burst;
    $burst = new Burst();

    require_once __DIR__ . '/src/functions.php';
    require_once __DIR__ . '/src/class-compatibility.php';

    /**
     * Get the Burst instance
     */
    function burst_loader(): Burst {
        global $burst;
        return $burst;
    }
}

if ( ! function_exists( '\Burst\burst_on_activation' ) && ! function_exists( 'burst_on_activation' ) ) {
    /**
     * Set an activation time stamp
     * This function has te have a different name, to ensure that it runs and deactivates free, if required.
     */
    function burst_on_activation(): void {
        update_option( 'burst_run_activation', true, false );

        // ensure that defaults are set only once.
        if ( ! get_option( 'burst_activation_time' ) ) {
            update_option( 'burst_set_defaults', true, false );
        }
    }
    register_activation_hook( __FILE__, '\Burst\burst_on_activation' );
}

if ( ! function_exists( '\Burst\burst_clear_scheduled_hooks' ) && ! function_exists( 'burst_clear_scheduled_hooks' ) ) {
    /**
     * Clear scheduled hooks
     */
    function burst_clear_scheduled_hooks(): void {
        wp_clear_scheduled_hook( 'burst_every_hour' );
        wp_clear_scheduled_hook( 'burst_daily' );
        wp_clear_scheduled_hook( 'burst_weekly' );
    }
    register_deactivation_hook( __FILE__, '\Burst\burst_clear_scheduled_hooks' );
}
