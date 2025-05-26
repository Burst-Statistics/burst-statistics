<?php
namespace Burst;

use Burst\Admin\Admin;
use Burst\Frontend\Frontend;
use Burst\Frontend\Frontend_Admin;
use Burst\Pro\Pro;
use Burst\Integrations\Integrations;
use Burst\Traits\Admin_Helper;
if ( class_exists( 'Burst' ) ) {
	class Burst {}
} else {
	// ignore the 'only one object' rule, as it is a trick for compatibility.
    //phpcs:ignore
	class Burst {

		use Admin_Helper;

		public Admin $admin;
		public Pro $pro;
		public Frontend $frontend;
		public Frontend_Admin $frontend_admin;
		public Integrations $integrations;

		public ?bool $user_can_manage   = null;
		public ?bool $user_can_view     = null;
		public ?bool $has_admin_access  = null;
		public ?bool $is_logged_in_rest = null;
		public string $admin_url;
		/**
		 * Constructor
		 */
		public function __construct() {
			add_action( 'plugins_loaded', [ $this, 'init' ], 9 );
		}

		/**
		 * Initialize the constants
		 */
		public function constants(): void {
			$plugin_file = defined( 'BURST_PRO_FILE' ) ? BURST_PRO_FILE : BURST_FREE_FILE;
			define( 'BURST_FILE', $plugin_file );
			define( 'BURST_PATH', defined( 'BURST_PRO_FILE' ) ? dirname( BURST_PRO_FILE ) . '/' : dirname( BURST_FREE_FILE ) . '/' );

			define( 'BURST_URL', plugin_dir_url( BURST_FILE ) );
			define( 'BURST_DASHBOARD_URL', admin_url( 'admin.php?page=burst' ) );
			define( 'BURST_PLUGIN', plugin_basename( BURST_FILE ) );
			define( 'BURST_PLUGIN_NAME', defined( 'BURST_PRO' ) ? 'Burst Pro' : 'Burst Statistics' );

			$burst_plugin = explode( '/', BURST_PLUGIN );
			array_pop( $burst_plugin );
			$burst_plugin = implode( '/', $burst_plugin );
			$debug        = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '#' . time() : '';
			define( 'BURST_VERSION', '2.0.7' . $debug );
			// deprecated constant.
            //phpcs:ignore
            define( 'burst_version', BURST_VERSION );
			define( 'BURST_ITEM_ID', 889 );
			define( 'BURST_PRODUCT_NAME', 'Burst Pro' );
		}

		/**
		 * Initialize the plugin
		 */
		public function init(): void {
			$this->constants();
			// not using the formdata.
            //phpcs:ignore
			if ( isset( $_GET['install_pro'] ) ) {
				require_once BURST_PATH . 'upgrade/class-auto-installer.php';
			}

			$this->integrations = new Integrations();

			if ( is_user_logged_in() ) {
				$this->frontend_admin = new Frontend_Admin();
			}
			if ( $this->has_admin_access() ) {
				$this->admin = new Admin();
				if ( defined( 'BURST_PRO_FILE' ) ) {
					$this->pro = new Pro();
				}
			}
			$this->frontend = new Frontend();
		}
	}
}
