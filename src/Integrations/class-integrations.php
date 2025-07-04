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
		add_action( 'plugins_loaded', [ $this, 'load_integrations' ] );
		add_action( 'plugins_loaded', [ $this, 'register_for_consent_api' ] );
		add_action( 'init', [ $this, 'load_translations' ] );

		$this->integrations = apply_filters( 'burst_integrations', $this->default_integrations() );
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
		foreach ( $this->integrations as $plugin => $details ) {
			if ( $this->plugin_is_active( $plugin ) ) {
				$file          = apply_filters( 'burst_integration_path', BURST_PATH . "src/Integrations/plugins/$plugin.php", $plugin );
				$is_admin_only = $details['admin_only'] ?? false;
				$can_load      = ( $is_admin_only && $this->has_admin_access() ) || ! $is_admin_only;

				if ( $can_load && file_exists( $file ) ) {
					require_once $file;
				}
			}
		}
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
