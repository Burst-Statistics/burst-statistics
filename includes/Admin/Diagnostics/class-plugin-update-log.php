<?php
/**
 * Plugin update log.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Plugin_Update_Log
 *
 * Records when each plugin was last updated/installed by hooking the WordPress
 * upgrader, and when each plugin was last activated. WordPress keeps no such
 * history itself, so this gives the Recent_Changes_Collector a way to correlate
 * plugin updates and activations with a tracking drop.
 */
class Plugin_Update_Log {

	/**
	 * Option key mapping plugin basename => last update timestamp.
	 *
	 * @var string
	 */
	private const OPTION = 'burst_plugins_last_updated';

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'upgrader_process_complete', [ $this, 'record' ], 10, 2 );
		add_action( 'activated_plugin', [ $this, 'record_activation' ] );
	}

	/**
	 * Store the current time for every plugin touched by an upgrade.
	 *
	 * @param \WP_Upgrader $upgrader   Unused — present so $hook_extra arrives as the second argument.
	 * @param array        $hook_extra Context describing what was upgraded.
	 */
	public function record( \WP_Upgrader $upgrader, array $hook_extra ): void {
		if ( 'plugin' !== ( $hook_extra['type'] ?? '' ) ) {
			return;
		}

		$slugs = [];
		if ( ! empty( $hook_extra['plugins'] ) && is_array( $hook_extra['plugins'] ) ) {
			$slugs = $hook_extra['plugins'];
		} elseif ( ! empty( $hook_extra['plugin'] ) ) {
			$slugs = [ $hook_extra['plugin'] ];
		}

		$this->store( $slugs );
	}

	/**
	 * Store the current time for a plugin that was just activated.
	 *
	 * @param string $plugin Plugin basename that was activated.
	 */
	public function record_activation( string $plugin ): void {
		$this->store( [ $plugin ] );
	}

	/**
	 * Persist the current time against each given plugin basename.
	 *
	 * @param array $slugs Plugin basenames to timestamp.
	 */
	private function store( array $slugs ): void {
		if ( empty( $slugs ) ) {
			return;
		}

		$log = get_option( self::OPTION, [] );
		$log = is_array( $log ) ? $log : [];
		$now = time();
		foreach ( $slugs as $slug ) {
			$log[ sanitize_text_field( (string) $slug ) ] = $now;
		}

		update_option( self::OPTION, $log, false );
	}
}
