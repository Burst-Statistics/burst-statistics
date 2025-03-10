<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! function_exists( 'is_plugin_active' ) ) {
	include_once ABSPATH . 'wp-admin/includes/plugin.php';
}
/**
 * Install suggested plugins
 */

if ( ! class_exists( 'burst_installer' ) ) {
	class burst_installer {
		private $slug = '';
		public function __construct( $slug ) {
			if ( ! burst_user_can_manage() ) {
				return;
			}

			$this->slug = $slug;
		}

		/**
		 * Check if plugin is downloaded
		 *
		 * @return bool
		 */
		public function plugin_is_downloaded() {
			return file_exists( trailingslashit( WP_PLUGIN_DIR ) . $this->get_activation_slug() );
		}
		/**
		 * Check if plugin is activated
		 *
		 * @return bool
		 */
		public function plugin_is_activated() {
			return is_plugin_active( $this->get_activation_slug() );
		}

		/**
		 * Install plugin
		 *
		 * @param string $step
		 *
		 * @return void
		 */
		public function install( $step ) {
			if ( ! burst_user_can_manage() ) {
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
		 *
		 * @return string
		 */
		public function get_activation_slug() {
			$slugs = array(
				'wp-optimize'           => 'wp-optimize/wp-optimize.php',
				'updraftplus'             => 'updraftplus/updraftplus.php',
				'all-in-one-wp-security-and-firewall'          => 'all-in-one-wp-security-and-firewall/wp-security.php',
			);
			return $slugs[ $this->slug ];
		}

		/**
		 * Download the plugin
		 *
		 * @return bool
		 */
		public function download_plugin() {
			if ( ! burst_user_can_manage() ) {
				return false;
			}
			if ( get_transient( 'burst_plugin_download_active' ) !== $this->slug ) {
				set_transient( 'burst_plugin_download_active', $this->slug, MINUTE_IN_SECONDS );
				$info          = $this->get_plugin_info();
				$download_link = esc_url_raw( $info->versions['trunk'] );
				require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
				require_once ABSPATH . 'wp-admin/includes/file.php';
				include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
				$skin     = new WP_Ajax_Upgrader_Skin();
				$upgrader = new Plugin_Upgrader( $skin );
				$result   = $upgrader->install( $download_link );
				if ( is_wp_error( $result ) ) {
					return false;
				}
				delete_transient( 'burst_plugin_download_active' );
			}
			return true;
		}

		/**
		 * Activate the plugin
		 *
		 * @return bool
		 */
		public function activate_plugin() {
			if ( ! burst_user_can_manage() ) {
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

		/**
		 * Get plugin info
		 *
		 * @return array|WP_Error
		 */
		public function get_plugin_info() {
			require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
			$plugin_info = get_transient( 'burst_' . $this->slug . '_plugin_info' );
			if ( empty( $plugin_info ) ) {
				$plugin_info = plugins_api( 'plugin_information', array( 'slug' => $this->slug ) );
				if ( ! is_wp_error( $plugin_info ) ) {
					set_transient( 'burst_' . $this->slug . '_plugin_info', $plugin_info, WEEK_IN_SECONDS );
				}
			}
			return $plugin_info;
		}
	}

}
