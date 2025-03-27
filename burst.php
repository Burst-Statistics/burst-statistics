<?php
/**
 * Plugin Name: Burst Statistics - Privacy-Friendly Analytics for WordPress
 * Plugin URI: https://www.wordpress.org/plugins/burst-statistics
 * Description: Get detailed insights into visitors’ behavior with Burst Statistics, the privacy-friendly analytics dashboard.
 * Version: 1.8.0.1
 * Requires at least: 6.2
 * Requires PHP: 7.2
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

defined( 'ABSPATH' ) or die();

if ( ! class_exists( 'BURST' ) ) {
	class BURST {
		private static $instance;
		public $endpoint;
		public $statistics;
		public $goal_statistics;
		public $sessions;
		public $goals;
		public $goals_tracker;
		public $admin;
		public $settings;
		public $frontend;
		public $review;
		public $config;
		public $tasks;
		public $archive;
		public $summary;
		public $mail_reports;
		public $dashboard_widget;
		public $db_upgrade;

		private function __construct() {
		}

		public static function instance() {
			if ( ! isset( self::$instance ) && ! ( self::$instance instanceof BURST ) ) {
				self::$instance = new BURST;
				self::$instance->setup_constants();
				self::$instance->includes();

				self::$instance->endpoint        = new burst_endpoint();
				self::$instance->sessions        = new burst_sessions();
				self::$instance->goals           = new burst_goals();
				self::$instance->goals_tracker   = new burst_goals_tracker();
				self::$instance->frontend        = new burst_frontend();

				if ( burst_admin_logged_in() ) {
					self::$instance->goals           = new burst_goals();
					self::$instance->statistics      = new burst_statistics();
					self::$instance->goal_statistics = new burst_goal_statistics();
					self::$instance->admin      = new burst_admin();
					self::$instance->mail_reports     = new burst_mail_reports();
					self::$instance->summary    = new burst_summary();
					self::$instance->review     = new burst_review();
					self::$instance->tasks    = new burst_tasks();
					self::$instance->db_upgrade = new burst_db_upgrade();
					self::$instance->dashboard_widget = new burst_dashboard_widget();
				}
				self::$instance->hooks();
			}

			return self::$instance;
		}

		/**
		 * Setup constants for the plugin
		 */

		private function setup_constants() {
			define( 'burst_free', true );
			define( 'burst_url', plugin_dir_url( __FILE__ ) );
			define( 'burst_dashboard_url', admin_url( 'index.php?page=burst' ) );
			define( 'burst_path', plugin_dir_path( __FILE__ ) );
			define( 'burst_plugin', plugin_basename( __FILE__ ) );
			define( 'burst_plugin_name', 'Burst Statistics' );
			$burst_plugin = explode( '/', burst_plugin );
			array_pop( $burst_plugin );
			$burst_plugin = implode( '/', $burst_plugin );
			define( 'burst_plugin_folder', $burst_plugin );
			$debug = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '#'.time() : '';
			define( 'burst_version', '1.8.0.1' . $debug );
			define( 'burst_plugin_file', __FILE__ );
			define( 'burst_main_menu_position', 100 );
			define( 'burst_pro_url', 'https://burst-statistics.com/pricing/?src=burst-plugin' );
			define( 'BURST_ITEM_ID', 889 );
			define( 'burst_product_name', 'Burst Pro' );
		}

		/**
		 * Instantiate the class.
		 *
		 * @return BURST
		 * @since 1.0.0
		 *
		 */
		public static function get_instance() {
			if ( ! isset( self::$instance )
			     && ! ( self::$instance instanceof BURST )
			) {
				self::$instance = new self();
			}

			return self::$instance;
		}

		private function includes() {
			require_once( burst_path . 'class-endpoint.php' );
			require_once( burst_path . 'functions.php' );
			require_once( burst_path . 'integrations/integrations.php' );
			require_once( burst_path . 'tracking/tracking.php' );
			require_once( burst_path . 'class-frontend.php' );
			require_once( burst_path . 'helpers/php-user-agent/UserAgentParser.php' );
			require_once( burst_path . 'sessions/class-sessions.php' );
			require_once( burst_path . 'goals/class-goals.php' );
			require_once( burst_path . 'goals/class-goals-tracker.php' );
			require_once( burst_path . 'cron.php' );
			require_once( burst_path . 'class-frontend.php' );

			if ( burst_admin_logged_in() ) {
				require_once( burst_path . 'upgrade.php' );
				require_once( burst_path . 'goals/class-goals.php' );
				require_once( burst_path . 'class-db-upgrade.php' );
				require_once( burst_path . 'statistics/class-statistics.php' );
				require_once( burst_path . 'statistics/class-goal-statistics.php' );
				require_once( burst_path . 'class-admin.php' );
				require_once burst_path . 'mailer/class-mail-reports.php';
				require_once( burst_path . 'statistics/class-summary.php' );
				require_once( burst_path . 'settings/settings.php' );
				require_once( burst_path . 'class-review.php' );
				require_once( burst_path . 'class-tasks.php' );
				require_once( burst_path . 'class-installer.php' );
				require_once( burst_path . 'dashboard-widget/dashboard-widget.php' );

				if ( isset( $_GET['install_pro'] ) ) {
					require_once( burst_path . 'upgrade/upgrade-to-pro.php' );
				}
			}
		}

		private function hooks() {
			$plugin = plugin_basename( __FILE__ );

			/**
			 * Tell the consent API we're following the api
			 */
			add_filter( "wp_consent_api_registered_$plugin", function() { return true; } );
		}
	} // End BURST class
} // End if class_exists check

if ( ! function_exists( 'BURST' ) ) {
	function BURST() {
		return BURST::instance();

	}

	add_action( 'plugins_loaded', 'BURST', 8 );
}

if ( ! function_exists( 'burst_on_activation' ) ) {
    /**
     * Set an activation time stamp
     *
     * @param $networkwide
     */
    function burst_on_activation() {
        if (!function_exists('burst_add_view_capability')) {
            require_once( plugin_dir_path( __FILE__ ) . 'functions.php' );
        }
        burst_add_view_capability();
        burst_add_manage_capability();
        update_option( 'burst_run_activation', true, false );
        update_option('burst_set_defaults', true, false);
    }

    register_activation_hook( __FILE__, 'burst_on_activation' );
}

if ( ! function_exists( 'burst_clear_scheduled_hooks' ) ) {
	register_deactivation_hook( __FILE__, 'burst_clear_scheduled_hooks' );
	function burst_clear_scheduled_hooks() {
		wp_clear_scheduled_hook( 'burst_every_hour' );
		wp_clear_scheduled_hook( 'burst_daily' );
		wp_clear_scheduled_hook( 'burst_weekly' );
		wp_clear_scheduled_hook( 'burst_every_5_minutes' );
	}
}
