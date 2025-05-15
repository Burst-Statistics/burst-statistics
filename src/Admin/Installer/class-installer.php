<?php
namespace Burst\Admin\Installer;

use Burst\Traits\Admin_Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! function_exists( 'is_plugin_active' ) ) {
	include_once ABSPATH . 'wp-admin/includes/plugin.php';
}
/**
 * Install suggested plugins
 */
class Installer {
	use Admin_Helper;

	private $slug = '';
	/**
	 * Constructor
	 */
	public function __construct( string $slug ) {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$this->slug = $slug;
	}

	/**
	 * Check if plugin is downloaded
	 */
	public function plugin_is_downloaded(): bool {
		return file_exists( trailingslashit( WP_PLUGIN_DIR ) . $this->get_activation_slug() );
	}
	/**
	 * Check if plugin is activated
	 */
	public function plugin_is_activated(): bool {
		return is_plugin_active( $this->get_activation_slug() );
	}

	/**
	 * Install plugin
	 */
	public function install( string $step ): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		if ( $step === 'download' ) {
			$this->download_plugin();
		}
		if ( $step === 'activate' ) {
			$this->activate_plugin();
		}
	}

	/**
	 * Get slug to activate plugin with
	 */
	public function get_activation_slug(): string {
		$slugs = [
			'wp-optimize'                         => 'wp-optimize/wp-optimize.php',
			'updraftplus'                         => 'updraftplus/updraftplus.php',
			'all-in-one-wp-security-and-firewall' => 'all-in-one-wp-security-and-firewall/wp-security.php',
		];
		return $slugs[ $this->slug ];
	}

	/**
	 * Download the plugin
	 */
	public function download_plugin(): bool {
		if ( ! $this->user_can_manage() ) {
			return false;
		}
		if ( get_transient( 'burst_plugin_download_active' ) !== $this->slug ) {
			set_transient( 'burst_plugin_download_active', $this->slug, MINUTE_IN_SECONDS );
			$info = $this->get_plugin_info();
			if ( ! is_wp_error( $info ) && isset( $info->versions ) ) {
				$download_link = esc_url_raw( $info->versions['trunk'] );
				require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
				require_once ABSPATH . 'wp-admin/includes/file.php';
				include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
				$skin     = new \WP_Ajax_Upgrader_Skin();
				$upgrader = new \Plugin_Upgrader( $skin );
				$result   = $upgrader->install( $download_link );
				if ( is_wp_error( $result ) ) {
					delete_transient( 'burst_plugin_download_active' );
					return false;
				}
			}

			delete_transient( 'burst_plugin_download_active' );
		}
		return true;
	}

	/**
	 * Activate the plugin
	 */
	public function activate_plugin(): bool {
		if ( ! $this->user_can_manage() ) {
			return false;
		}
		$slug        = $this->get_activation_slug();
		$networkwide = is_multisite();
		$result      = activate_plugin( $slug, '', $networkwide );
		if ( is_wp_error( $result ) ) {
			return false;
		}
		return true;
	}

    //phpcs:disable
	/**
	 * Get plugin info
	 */
	public function get_plugin_info() {
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		$plugin_info = get_transient( 'burst_' . $this->slug . '_plugin_info' );
		if ( empty( $plugin_info ) ) {
			$plugin_info = plugins_api( 'plugin_information', [ 'slug' => $this->slug ] );
			if ( ! is_wp_error( $plugin_info ) ) {
				set_transient( 'burst_' . $this->slug . '_plugin_info', $plugin_info, WEEK_IN_SECONDS );
			}
		}

		return $plugin_info;
	}
    //phpcs:enable
}
