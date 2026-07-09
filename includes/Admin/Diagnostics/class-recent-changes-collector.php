<?php
/**
 * Recent-changes diagnostic collector.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Recent_Changes_Collector
 *
 * Correlates plugin updates and tracking-setting changes with the drop. It reads
 * the logs kept by Plugin_Update_Log and Settings_Change_Log and reports anything
 * that changed around the drop date taken from the Tracking_Health result.
 */
class Recent_Changes_Collector extends Diagnostic_Collector {

	/**
	 * Option holding plugin basename => last update timestamp.
	 *
	 * @var string
	 */
	private const OPTION = 'burst_plugins_last_updated';

	/**
	 * Option holding setting key => last change timestamp.
	 *
	 * @var string
	 */
	private const SETTINGS_OPTION = 'burst_settings_last_changed';

	/**
	 * How many days before the drop date count as "around" it.
	 *
	 * @var int
	 */
	private const WINDOW_DAYS = 3;

	/**
	 * {@inheritDoc}
	 */
	public function key(): string {
		return 'recent_changes';
	}

	/**
	 * {@inheritDoc}
	 */
	public function collect(): array {
		$label       = __( 'Recent plugin & setting changes', 'burst-statistics' );
		$plugin_log  = $this->read_log( self::OPTION );
		$setting_log = $this->read_log( self::SETTINGS_OPTION );

		if ( empty( $plugin_log ) && empty( $setting_log ) ) {
			return $this->result(
				'skipped',
				$label,
				__( 'No plugin or setting change history has been recorded yet, so changes around the drop date cannot be determined.', 'burst-statistics' )
			);
		}

		$drop_date = $this->get_drop_date();
		if ( '' === $drop_date ) {
			return $this->result(
				'skipped',
				$label,
				__( 'The drop date is unknown, so recent changes cannot be correlated.', 'burst-statistics' )
			);
		}

		$drop_ts      = (int) strtotime( $drop_date . ' 23:59:59' );
		$window_start = $drop_ts - ( self::WINDOW_DAYS * DAY_IN_SECONDS );
		$window_end   = $drop_ts + DAY_IN_SECONDS;

		$plugins  = $this->within_window( $plugin_log, $window_start, $window_end );
		$settings = $this->within_window( $setting_log, $window_start, $window_end );

		if ( empty( $plugins ) && empty( $settings ) ) {
			return $this->result(
				'ok',
				$label,
				__( 'No plugins were updated and no tracking settings changed around the time tracking dropped.', 'burst-statistics' )
			);
		}

		return $this->result(
			'warning',
			$label,
			__( 'A plugin update or tracking-setting change occurred around the time tracking dropped; it may be the cause.', 'burst-statistics' ),
			[
				'updated_plugins'  => $plugins,
				'changed_settings' => $settings,
			]
		);
	}

	/**
	 * Read a timestamp log option as an array.
	 *
	 * @param string $option Option name.
	 * @return array<string, int>
	 */
	private function read_log( string $option ): array {
		$log = get_option( $option, [] );
		return is_array( $log ) ? $log : [];
	}

	/**
	 * Reduce a timestamp log to the entries that fall within the window.
	 *
	 * @param array<string, int> $log   Map of key => timestamp.
	 * @param int                $start Window start (inclusive).
	 * @param int                $end   Window end (inclusive).
	 * @return array<string, string> Map of key => Y-m-d for entries in range.
	 */
	private function within_window( array $log, int $start, int $end ): array {
		$recent = [];
		foreach ( $log as $key => $timestamp ) {
			$timestamp = (int) $timestamp;
			if ( $timestamp >= $start && $timestamp <= $end ) {
				$recent[ $key ] = gmdate( 'Y-m-d', $timestamp );
			}
		}
		return $recent;
	}

	/**
	 * The date tracking is considered to have dropped, taken from Tracking_Health.
	 *
	 * @return string Y-m-d, or '' when unknown.
	 */
	private function get_drop_date(): string {
		$health = get_option( 'burst_tracking_health', [] );
		if ( ! is_array( $health ) ) {
			return '';
		}

		$since = (string) ( $health['incident_since'] ?? '' );
		if ( '' !== $since ) {
			return $since;
		}

		return (string) ( $health['checked_date'] ?? '' );
	}
}
