<?php
namespace Burst;

use Burst\Admin\Admin;
use Burst\Admin\Capability\Capability;
use Burst\Frontend\Frontend;
use Burst\Frontend\Frontend_Admin;
use Burst\Pro\Pro;
use Burst\Integrations\Integrations;
use Burst\Traits\Admin_Helper;
use Burst\Admin\AutoInstaller\Auto_Installer;

	// ignore the 'only one object' rule, as it is a trick for compatibility.
    //phpcs:ignore
	class Burst {

	use Admin_Helper;

	private static ?Burst $instance = null;
	private bool $booted            = false;

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
	private function __construct() {
		add_action( 'plugins_loaded', [ $this, 'init' ], 9 );
	}

	/**
	 * Return instance of the class
	 */
	public static function instance(): Burst {
		// Single entrypoint for everyone.
		if ( self::$instance instanceof self ) {
			return self::$instance;
		}
		// constructor registers hooks.
		self::$instance = new self();
		return self::$instance;
	}

	/**
	 * Initialize the constants
	 */
	private function constants(): void {
		$plugin_file = defined( 'BURST_PRO_FILE' ) ? BURST_PRO_FILE : BURST_FREE_FILE;
		define( 'BURST_FILE', $plugin_file );
		define( 'BURST_PATH', defined( 'BURST_PRO_FILE' ) ? dirname( BURST_PRO_FILE ) . '/' : dirname( BURST_FREE_FILE ) . '/' );

		$plugin_url = plugin_dir_url( BURST_FILE );
		$scheme     = ( strpos( site_url(), 'https://' ) === 0 ) ? 'https' : 'http';
		$plugin_url = set_url_scheme( $plugin_url, $scheme );
		define( 'BURST_URL', $plugin_url );
		define( 'BURST_DASHBOARD_URL', admin_url( 'admin.php?page=burst' ) );
		define( 'BURST_PLUGIN', plugin_basename( BURST_FILE ) );
		define( 'BURST_PLUGIN_NAME', defined( 'BURST_PRO' ) ? 'Burst Pro' : 'Burst Statistics' );
		define( 'BURST_VERSION', '2.2.6.1' );
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
		if ( $this->booted ) {
			return;
		}
		$this->booted = true;

		$this->constants();
		// not using the formdata.
		//phpcs:ignore
		if ( isset( $_GET['install_pro'] ) ) {
			new Auto_Installer( 'burst-statistics' );
		}

		$this->integrations = new Integrations();
		$this->integrations->init();

		if ( is_user_logged_in() ) {
			$this->frontend_admin = new Frontend_Admin();
			$this->frontend_admin->init();
		}

		if ( $this->has_admin_access() ) {
			$this->admin = new Admin();
			$this->admin->init();
			$capability = new Capability();
			$capability->init();

			if ( defined( 'BURST_PRO_FILE' ) ) {
				$this->pro = new Pro();
				$this->pro->init();
			}
		}
		$this->frontend = new Frontend();
		$this->frontend->init();
	}
}
