<?php
namespace Burst\TeamUpdraft\Installer;

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

	private string $slug = '';
	/**
	 * The slug of the plugin that is calling this class.
	 * It is used to remove the calling plugin from the recommended list.
	 */
	private string $caller_slug = '';
	private array $plugins      = [];
	private string $endpoint    = 'https://burst.ams3.cdn.digitaloceanspaces.com/teamupdraft/';
	/**
	 * Constructor
	 */
	public function __construct( string $caller_slug, string $slug = '' ) {
		if ( ! current_user_can( 'install_plugins' ) ) {
			return;
		}

		$this->caller_slug = $this->sanitize_slug( $caller_slug );
		$this->slug        = $this->sanitize_slug( $slug );
	}

	/**
	 * Sanitize the slug against our list of accepted plugins.
	 */
	private function sanitize_slug( string $slug ): string {
		// get array of slugs from plugins array.
		$plugins = $this->get_plugins_raw();
		$slugs   = array_map(
			function ( $plugin ) {
				return $plugin['slug'];
			},
			$plugins
		);

		// check if slug is in array.
		if ( in_array( $slug, $slugs, true ) ) {
			return $slug;
		}
		return '';
	}

	/**
	 * Check if plugin is downloaded
	 */
	public function plugin_is_downloaded( string $slug ): bool {
		return file_exists( trailingslashit( WP_PLUGIN_DIR ) . $this->get_activation_slug( $slug ) );
	}

	/**
	 * Get a single plugin by slug
	 *
	 * @param string $slug The slug of the plugin to get. This is actually the folder name, but used as 'slug' in the WP Api.
	 * @param bool   $raw Optional, default false. If true, return the raw array of plugins. If false, return the cleaned and enriched array. Normally only used within this class to prevent infinite loops.
	 * @return array<string, mixed>|null
	 */
	public function get_plugin( string $slug, bool $raw = false ): ?array {
		if ( empty( $slug ) ) {
			return null;
		}

		$plugins = $this->get_plugins_raw();

		$found_plugins = array_filter(
			$plugins,
			function ( $plugin ) use ( $slug ) {
				return $plugin['slug'] === $slug;
			}
		);

		if ( empty( $found_plugins ) ) {
			return null;
		}

		if ( $raw ) {
			// If raw is true, return the first found plugin without enrichment.
			return reset( $found_plugins );
		}

		$found_plugin = $this->enrich_plugin_data( $found_plugins );
		return reset( $found_plugin );
	}

	/**
	 * Get plugins array, filtered by conditions, enriched with additional information, and limited to a maximum number of plugins.
	 * 1) Remove plugins with conditions that do not meet the requirements (e.g. WooCommerce but no WooCommerce).
	 * 2) If still over 3 plugins, drop plugins where a similar  possibly conflicting plugin already is installed. E.g. WordFence is installed => drop AIOS
	 * 3) Still over 3? Remove plugins that are already installed
	 * 4) Still over 3? grab a random set of 3, keep this stable for one week.
	 *
	 * @param bool $include_niche_plugins If '$include_niche_plugins' = true, plugins that are only useful in a specific niche are not shown. E.g. specific niche WooCommerce plugins where we cannot determine if
	 *        the user has any use for them.
	 * @param int  $max Optional, default 3. Determines how many plugins to return. If more than $max plugins are available, only the first $max will be returned.
	 * @return array<int, array<string, mixed>>
	 *         Returns a list of plugin arrays, a single plugin array, or null if not found.
	 */
	public function get_plugins( bool $include_niche_plugins = true, int $max = 3 ): array {
		$plugins = $this->get_plugins_raw();
		// Remove the calling plugin from the list.
		foreach ( $plugins as $index => $plugin ) {
			if ( $plugin['slug'] === $this->caller_slug ) {
				unset( $plugins[ $index ] );
			}
		}

		$plugins = $this->enrich_plugin_data( $plugins );

		// If we don't want niche plugins, remove them from the list.
		if ( ! $include_niche_plugins ) {
			foreach ( $plugins as $index => $plugin ) {
				if ( isset( $plugin['niche'] ) && $plugin['niche'] === true ) {
					unset( $plugins[ $index ] );
				}
			}
		}

		// Remove plugins where the conditions regarding required plugins or other are not met.
		foreach ( $plugins as $index => $plugin ) {
			if ( ! isset( $plugin['conditions'] ) ) {
				continue;
			}

			foreach ( $plugin['conditions'] as $condition_type => $condition_value ) {
				if ( $condition_type === 'plugin' && ! defined( $condition_value ) ) {
					unset( $plugins[ $index ] );
					// Skip to the next plugin.
					continue 2;
				}
			}
		}

		// still more than $max plugins? Check if similar plugins are already installed.
		if ( count( $plugins ) > $max ) {
			foreach ( $plugins as $index => $plugin ) {
				$conflicting_plugins = $plugin['conflicting_plugins'] ?? [];
				foreach ( $conflicting_plugins as $conflicting_plugin_constant ) {
					if ( defined( $conflicting_plugin_constant ) ) {
						unset( $plugins[ $index ] );
					}
					if ( count( $plugins ) <= $max ) {
						break;
					}
				}
			}
		}

		// if more than 3 plugins in the list, remove installed plugins until we're down to 3.
		if ( count( $plugins ) > $max ) {
			foreach ( $plugins as $index => $plugin ) {
				if ( $plugin['action'] === 'installed' || $plugin['action'] === 'upgrade-to-pro' ) {
					unset( $plugins[ $index ] );
				}
				if ( count( $plugins ) <= $max ) {
					break;
				}
			}
		}
		$plugins = array_values( $plugins );

		// if still more than $max plugins, return $max plugins.
		// in other plugins, we randomize, showing 3 different each week.
		// in onboarding we always show the top 3.
		if ( count( $plugins ) > $max ) {
			if ( $include_niche_plugins ) {
				$plugins = $this->get_random_selection( $plugins, $max );
			} else {
				// just take the first $max plugins.
				$plugins = array_slice( $plugins, 0, $max );
			}
		}

		// reset array keys again to avoid gaps in the array.
		$plugins = array_values( $plugins );

		return $plugins;
	}

	/**
	 * Enrich plugin data with additional information.
	 *
	 * @param array<int, array<string, mixed>> $plugins
	 * @return array<int, array<string, mixed>>
	 */
	private function enrich_plugin_data( array $plugins ): array {
		$icon_url  = $this->endpoint . 'images/';
		$admin_url = is_multisite() ? network_admin_url( 'plugin-install.php?s=' ) : admin_url( 'plugin-install.php?s=' );
		foreach ( $plugins as $index => $plugin ) {
			$action                      = $this->get_plugin_action( $plugin['slug'] );
			$plugins[ $index ]['action'] = $action;
			$plugins[ $index ] ['id']    = $plugin['slug'];
			$plugins[ $index ]['icon']   = isset( $plugin['icon'] ) ? $icon_url . $plugin['icon'] : '';
			$search_url                  = '#';
			if ( $action !== 'installed' && $action !== 'upgrade-to-pro' ) {
				$search_url = isset( $plugin['search_url'] ) ? $admin_url . $plugin['search_url'] : '';
			}
			// add utm parameters to the upgrade_url.
			if ( isset( $plugin['upgrade_url'] ) ) {
				$plugins[ $index ]['upgrade_url'] = add_query_arg(
					[
						'utm_source' => 'teamupdraft',
						'utm_plugin' => $this->caller_slug,
					],
					$plugin['upgrade_url']
				);
			}
			$plugins[ $index ]['search_url'] = $search_url;
		}
		return $plugins;
	}

	/**
	 * Get raw plugins array, cached in the class variable.
	 *
	 * @return array<int, array<string, mixed>>
	 *         Returns a list of plugin arrays.
	 */
	private function get_plugins_raw(): array {
		if ( ! empty( $this->plugins ) ) {
			return $this->plugins;
		}

		$json_path = __DIR__ . '/plugins.json';
		// if the file is over one week old, delete it, so we can download a new one.
		if ( file_exists( $json_path ) && ( time() - filemtime( $json_path ) > WEEK_IN_SECONDS ) ) {
			wp_delete_file( $json_path );
		}

		if ( ! file_exists( $json_path ) ) {
			$this->download_json_file();
		}
		if ( ! file_exists( $json_path ) ) {
			$json_path = __DIR__ . '/plugins-fallback.json';
		}

        // phpcs:disable WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$json = file_get_contents( $json_path );
		// decode the json file.
		$this->plugins = json_decode( $json, true );

		// add slug to each plugin array.
		foreach ( $this->plugins as $index => $plugin ) {
			// the slug as used in this class is actually the foldername of the plugin, so we can use the file path to get it.
			$this->plugins[ $index ]['slug'] = explode( '/', $plugin['file'] )[0];
		}

		$defaults = [
			'file'                => '',
			'slug'                => '',
			'icon'                => '',
			'search_url'          => '',
			'constant_free'       => '',
			'premium'             => [
				'type'  => '',
				'value' => '',
			],
			'wordpress_url'       => '',
			'upgrade_url'         => '',
			'title'               => '',
			'description'         => '',
			'conflicting_plugins' => [],
		];

		$this->plugins = array_map(
			function ( $plugin ) use ( $defaults ) {
				return wp_parse_args( $plugin, $defaults );
			},
			$this->plugins
		);

		return $this->plugins;
	}

	/**
	 * Get the plugins.json file from the remote server.
	 */
	private function download_json_file(): void {
		$remote_json = $this->endpoint . 'json/plugins.json';
		$response    = wp_remote_get( $remote_json );
		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return;
		}
		$json = wp_remote_retrieve_body( $response );
		if ( ! empty( $json ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			global $wp_filesystem;
			if ( ! WP_Filesystem() ) {
				return;
			}

			if ( $wp_filesystem->is_writable( __DIR__ ) ) {
				$wp_filesystem->put_contents( __DIR__ . '/plugins.json', $json, FS_CHMOD_FILE );
			}
		}
	}

	/**
	 * Get random selection of plugins.
	 *
	 * @return array<int, array<string, mixed>>|array<string, mixed>
	 *          Returns a list of plugin arrays, a single plugin array
	 */
	private function get_random_selection( array $plugins, int $max ): array {
		$indexes = get_transient( 'teamupdraft_random_plugin_indexes' );
		if ( false === $indexes ) {
			$indexes = array_rand( $plugins, $max );
			$indexes = is_array( $indexes ) ? $indexes : [ $indexes ];
			set_transient( 'teamupdraft_random_plugin_indexes', $indexes, WEEK_IN_SECONDS );
		}

		$new_plugins = [];
		foreach ( $indexes as $index ) {
			if ( isset( $plugins[ $index ] ) ) {
				$new_plugins[] = $plugins[ $index ];
			}
		}
		return $new_plugins;
	}

	/**
	 * Check if a plugin is installed based on the detection type and value.
	 */
	public function premium_is_installed( string $slug ): bool {
		$plugin = $this->get_plugin( $slug, true );
		if ( empty( $plugin ) ) {
			return true;
		}

		if ( ! isset( $plugin['premium'] ) ) {
			return true;
		}

		$detection_type  = $plugin['premium']['type'] ?? '';
		$detection_value = $plugin['premium']['value'] ?? '';

		if ( $detection_type === 'constant' ) {
			return defined( $detection_value );
		} elseif ( $detection_type === 'slug' ) {
			return file_exists( WP_PLUGIN_DIR . '/' . $detection_value );
		} elseif ( $detection_type === 'function' ) {
			return function_exists( $detection_value );
		} elseif ( $detection_type === 'class' ) {
			return class_exists( $detection_value );
		}
		return false;
	}

	/**
	 * Get the next action that can be completed for this plugin.
	 */
	public function get_plugin_action( string $slug ): string {
		$action = 'installed';
		$plugin = $this->get_plugin( $slug, true );
		if ( $this->premium_is_installed( $slug ) ) {
			$action = 'installed';
		} elseif ( ! $this->plugin_is_downloaded( $slug ) && ! $this->plugin_is_activated( $slug ) ) {
			$action = 'download';
		} elseif ( $this->plugin_is_downloaded( $slug ) && ! $this->plugin_is_activated( $slug ) ) {
			$action = 'activate';
		} elseif ( isset( $plugin['premium'] ) ) {
			$action = 'upgrade-to-pro';
		}

		return $action;
	}

	/**
	 * Check if plugin is activated
	 */
	public function plugin_is_activated( string $slug ): bool {
		$plugin = $this->get_plugin( $slug, true );
		if ( isset( $plugin['constant_free'] ) &&
			( defined( $plugin['constant_free'] ) || class_exists( $plugin['constant_free'] ) )
		) {
			return true;
		}
		return is_plugin_active( $this->get_activation_slug( $slug ) );
	}

	/**
	 * Install plugin
	 */
	public function install( string $step ): void {
		if ( ! current_user_can( 'install_plugins' ) ) {
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
	public function get_activation_slug( string $slug ): ?string {
		$plugin = $this->get_plugin( $slug, true );
		if ( empty( $plugin ) ) {
			return null;
		}
		if ( ! isset( $plugin['file'] ) ) {
			return null;
		}
		return $plugin['file'];
	}

	/**
	 * Download the plugin
	 */
	public function download_plugin(): bool {
		if ( ! current_user_can( 'install_plugins' ) ) {
			return false;
		}

		if ( get_transient( 'teamupdraft_plugin_download_active' ) !== $this->slug ) {
			set_transient( 'teamupdraft_plugin_download_active', $this->slug, MINUTE_IN_SECONDS );
			$download_url = $this->get_plugin_info( $this->slug, 'download_url' );
			if ( ! empty( $download_url ) ) {
				require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
				require_once ABSPATH . 'wp-admin/includes/file.php';
				include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
				$skin     = new \WP_Ajax_Upgrader_Skin();
				$upgrader = new \Plugin_Upgrader( $skin );
				$result   = $upgrader->install( $download_url );
				delete_transient( 'teamupdraft_plugin_download_active' );
				if ( is_wp_error( $result ) ) {
					return false;
				}
			} else {
				delete_transient( 'teamupdraft_plugin_download_active' );
				return false;
			}
		}
		return true;
	}

	/**
	 * Activate the plugin
	 */
	public function activate_plugin(): bool {
		if ( ! current_user_can( 'install_plugins' ) ) {
			return false;
		}
		$file        = $this->get_activation_slug( $this->slug );
		$networkwide = is_multisite();
		$result      = activate_plugin( $file, '', $networkwide );
		if ( is_wp_error( $result ) ) {
			return false;
		}
		// plugin successfully activated. We save an option so the just installed plugin knows how it was installed.
		update_option( 'teamupdraft_installation_source_' . $this->slug, $this->caller_slug, false );
		return true;
	}

	/**
	 * Retrieve plugin info for rating or download.
	 *
	 * @uses plugins_api() Get the plugin data.
	 * @param  string $slug The WP.org directory repo slug of the plugin.
	 * @param string $type The type of info we need, download_url, rating, or num_ratings.
	 * @version 1.0
	 */
	public function get_plugin_info( string $slug, string $type ): string {

		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		$slug        = $this->sanitize_slug( $slug );
		$plugin_info = get_transient( 'teamupdraft_' . $slug . '_plugin_info' );
		if ( empty( $plugin_info ) ) {
			$plugin_info_total = plugins_api( 'plugin_information', [ 'slug' => $slug ] );
			if ( ! is_wp_error( $plugin_info_total ) ) {
				$plugin_info = [
					// the plugin_info properties are not described, but do exist.
					// @phpstan-ignore-next-line.
					'download_url' => esc_url_raw( $plugin_info_total->versions['trunk'] ),
					// @phpstan-ignore-next-line.
					'rating'       => $plugin_info_total->rating,
					// @phpstan-ignore-next-line.
					'num_ratings'  => $plugin_info_total->num_ratings,
				];
				set_transient( 'teamupdraft_' . $slug . '_plugin_info', $plugin_info, WEEK_IN_SECONDS );
			}
		}

		if ( isset( $plugin_info[ $type ] ) ) {
			return $plugin_info[ $type ];
		}

		return '';
	}
}
