<?php
/**
 * Settings change log.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Settings_Change_Log
 *
 * Records when a tracking-affecting Burst setting last changed, so the
 * Recent_Changes_Collector can correlate a setting change with a tracking drop.
 * WordPress fires update_option_burst_options_settings with the old and new
 * values, so no separate snapshot is needed.
 */
class Settings_Change_Log {

	/**
	 * Option mapping setting key => last change timestamp.
	 *
	 * @var string
	 */
	private const OPTION = 'burst_settings_last_changed';

	/**
	 * Settings whose change can plausibly reduce recorded hits.
	 *
	 * @var string[]
	 */
	private const WATCHED = [
		'ip_blocklist',
		'user_role_blocklist',
		'enable_cookieless_tracking',
		'enable_turbo_mode',
		'track_url_change',
		'enable_do_not_track',
		'ghost_mode',
	];

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'update_option_burst_options_settings', [ $this, 'record' ], 10, 2 );
	}

	/**
	 * Store the current time for every watched setting whose value changed.
	 *
	 * Mixed $old_value/$new_value: WordPress passes the raw option values. They are
	 * the Burst settings arrays but are typed as mixed by the options API.
	 *
	 * @param mixed $old_value The settings before the update.
	 * @param mixed $new_value The settings after the update.
	 */
	public function record( mixed $old_value, mixed $new_value ): void {
		$old = is_array( $old_value ) ? $old_value : [];
		$new = is_array( $new_value ) ? $new_value : [];

		$log     = get_option( self::OPTION, [] );
		$log     = is_array( $log ) ? $log : [];
		$now     = time();
		$changed = false;

		foreach ( self::WATCHED as $key ) {
			if ( ( $old[ $key ] ?? null ) !== ( $new[ $key ] ?? null ) ) {
				$log[ $key ] = $now;
				$changed     = true;
			}
		}

		if ( $changed ) {
			update_option( self::OPTION, $log, false );
		}
	}
}
