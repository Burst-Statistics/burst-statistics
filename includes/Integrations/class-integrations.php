<?php
namespace Burst\Integrations;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

use Burst\Traits\Admin_Helper;

class Integrations {
	use Admin_Helper;

	public array $integrations = [];
	/**
	 * Constructor
	 */
	public function init(): void {
		$this->integrations = apply_filters( 'burst_integrations', $this->default_integrations() );

		add_action( 'init', [ $this, 'load_translations' ] );

		// We can load integrations here directly, because our main plugin file instantiating this on plugins_loaded hook with priority 9.
		$this->load_integrations();
		$this->register_for_consent_api();
	}

	/**
	 * Determine if ecommerce features should be loaded based on active integrations.
	 *
	 * @return bool True if any active integration requires ecommerce features.
	 */
	public function should_load_ecommerce(): bool {
		$should_load = false;
		foreach ( $this->integrations as $plugin => $details ) {
			if ( isset( $details['load_ecommerce_integration'] ) && $details['load_ecommerce_integration'] && $this->plugin_is_active( $plugin ) ) {
				$should_load = true;
				break;
			}
		}

		return apply_filters( 'burst_load_ecommerce_integration', $should_load );
	}

	/**
	 * Check if there are any subscriptions
	 *
	 * @return bool True if there are subscriptions, false otherwise.
	 */
	public function has_subscription_integrations_enabled(): bool {
		return apply_filters( 'burst_subscription_integrations_enabled', false );
	}

	/**
	 * Register the plugin for the consent API
	 */
	public function register_for_consent_api(): void {
		$plugin = BURST_PLUGIN;
		add_filter( "wp_consent_api_registered_{$plugin}", '__return_true' );
	}

	/**
	 * Returns the default plugin integrations supported by Burst Statistics.
	 *
	 * @return array<string, array<string, mixed>> List of integrations keyed by plugin slug.
	 */
	private function default_integrations(): array {
		return require __DIR__ . '/integrations.php';
	}

	/**
	 * Load the integrations
	 */
	public function load_integrations(): void {
		$non_dependent_integrations = array_filter(
			$this->integrations,
			function ( $details ) {
				return empty( $details['required_plugins'] );
			}
		);

		$dependent_integrations = array_filter(
			$this->integrations,
			function ( $details ) {
				return ! empty( $details['required_plugins'] );
			}
		);

		foreach ( $non_dependent_integrations as $plugin => $details ) {
			if ( ! $this->plugin_is_active( $plugin ) ) {
				continue;
			}

			if ( empty( $details['php_scripts'] ) ) {
				continue;
			}

			$php_scripts_to_load = $this->get_integrations_to_load( $details['php_scripts'], $plugin );

			if ( empty( $php_scripts_to_load ) ) {
				continue;
			}

			foreach ( $php_scripts_to_load as $php_script ) {
				require_once $php_script['file'];
			}
		}

		foreach ( $dependent_integrations as $plugin => $details ) {
			if ( ! $this->plugin_is_active( $plugin ) ) {
				continue;
			}

			if ( isset( $details['required_plugins'] ) && ! $this->are_all_required_plugins_active( $details['required_plugins'] ) ) {
				continue;
			}

			if ( empty( $details['php_scripts'] ) ) {
				continue;
			}

			$php_scripts_to_load = $this->get_integrations_to_load( $details['php_scripts'], $plugin );

			if ( empty( $php_scripts_to_load ) ) {
				continue;
			}

			foreach ( $php_scripts_to_load as $php_script ) {
				require_once $php_script['file'];
			}
		}
	}

	/**
	 * Get the integrations to load
	 *
	 * @param array $php_script_lists Integration details.
	 * @return array List of integrations to load.
	 */
	public function get_integrations_to_load( array $php_script_lists, string $plugin ): array {
		$integrations = [];

		if ( ! empty( $php_script_lists['admin_scripts'] ) && is_array( $php_script_lists['admin_scripts'] ) ) {
			foreach ( $php_script_lists['admin_scripts'] as $script ) {
				$file = apply_filters( 'burst_integration_path', BURST_PATH . "includes/Integrations/plugins/{$plugin}/{$script}", $plugin );

				if ( ! file_exists( $file ) || ! $this->has_admin_access() ) {
					continue;
				}

				$integrations[] = [
					'type' => 'admin',
					'file' => $file,
				];
			}
		}

		if ( ! empty( $php_script_lists['frontend_scripts'] ) && is_array( $php_script_lists['frontend_scripts'] ) ) {
			foreach ( $php_script_lists['frontend_scripts'] as $script ) {
				$file = apply_filters( 'burst_integration_path', BURST_PATH . "includes/Integrations/plugins/{$plugin}/{$script}", $plugin );

				if ( ! file_exists( $file ) ) {
					continue;
				}

				$integrations[] = [
					'type' => 'frontend',
					'file' => $file,
				];
			}
		}

		return $integrations;
	}

	/**
	 * Are all required plugins active for a given integration
	 *
	 * @param array $required_plugins List of required plugins.
	 * @return bool True if all required plugins are active, false otherwise.
	 */
	public function are_all_required_plugins_active( array $required_plugins ): bool {
		foreach ( $required_plugins as $plugin ) {
			if ( ! $this->plugin_is_active( $plugin ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check if the plugin is active
	 *
	 * @param string $plugin The plugin slug.
	 * @return bool True if the plugin is active, false otherwise.
	 */
	public function plugin_is_active( string $plugin ): bool {
		if ( ! isset( $this->integrations[ $plugin ] ) ) {
			return false;
		}

		$details  = $this->integrations[ $plugin ];
		$constant = $details['constant_or_function'] ?? '';
		$theme    = wp_get_theme();

		return defined( $constant )
				|| function_exists( $constant )
				|| class_exists( $constant )
				|| ( isset( $theme->name ) && $theme->name === $constant );
	}

	/**
	 * Load translations for integrations in the react dashboard
	 */
	public function load_translations(): void {
		if ( ! $this->is_logged_in_rest() ) {
			return;
		}

		$translations = require __DIR__ . '/translations.php';

		foreach ( $this->integrations as $plugin => &$details ) {
			if ( ! empty( $translations[ $plugin ] ) && ! empty( $details['goals'] ) ) {
				foreach ( $details['goals'] as $key => &$goal ) {
					$translation = $translations[ $plugin ]['goals'][ $key ] ?? null;
					if ( $translation ) {
						$goal['title']       = $translation['title'] ?? $goal['title'] ?? '';
						$goal['description'] = $translation['description'] ?? $goal['description'] ?? '';
					}
				}
			}
		}
	}
}
