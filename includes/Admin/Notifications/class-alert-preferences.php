<?php
/**
 * Alert preferences: which alert goes to which channel, and who gets the alert emails.
 *
 * @package Burst\Admin\Notifications
 */

namespace Burst\Admin\Notifications;

use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || exit;

/**
 * Class Alert_Preferences
 *
 * Single source of truth for the Settings › Notifications alert grid. Every
 * delivery channel (email, Slack) asks this class whether a notification type
 * may be sent, so the gating lives in one place.
 */
class Alert_Preferences {
	use Sanitize;

	/**
	 * Settings field holding the per alert, per channel switches.
	 */
	public const FIELD_ALERTS = 'alerts';

	/**
	 * Settings field holding the alert email recipients.
	 */
	public const FIELD_RECIPIENTS = 'alert_email_recipients';

	/**
	 * Alert rows mapped to the notification type they control.
	 *
	 * @var array<string, string>
	 */
	public const ROWS = [
		'tracking_health' => 'health.degraded',
		'traffic_spike'   => 'anomaly.spike',
		'traffic_drop'    => 'anomaly.dip',
	];

	/**
	 * Alert rows that only Pro can send. Free never stores them, so a switch
	 * to Pro can tell a row the user never chose from one they turned off.
	 *
	 * @var string[]
	 */
	public const PRO_ROWS = [ 'traffic_spike', 'traffic_drop' ];

	/**
	 * Channels an alert can be delivered to.
	 *
	 * @var string[]
	 */
	public const CHANNELS = [ 'email', 'slack' ];

	/**
	 * Default switches. Email for spike and drop is off here: those alerts are
	 * Pro, and Pro turns them on for new installs (see Pro::setup_pro_defaults()),
	 * so an update never starts sending emails nobody asked for.
	 *
	 * @return array<string, array<string, bool>>
	 */
	public static function get_defaults(): array {
		return [
			'tracking_health' => [
				'email' => true,
				'slack' => true,
			],
			'traffic_spike'   => [
				'email' => false,
				'slack' => true,
			],
			'traffic_drop'    => [
				'email' => false,
				'slack' => true,
			],
		];
	}

	/**
	 * Get the alert rows this install stores. Free leaves out the Pro rows.
	 *
	 * @return string[] Row keys.
	 */
	public function get_storable_rows(): array {
		$rows = array_keys( self::ROWS );
		return $this->is_pro() ? $rows : array_values( array_diff( $rows, self::PRO_ROWS ) );
	}

	/**
	 * Get the alert row that controls a notification type.
	 *
	 * @param string $type Notification type, e.g. 'anomaly.spike'.
	 * @return string|null Row key, or null when the type is not an alert.
	 */
	public static function get_row_for_type( string $type ): ?string {
		$row = array_search( $type, self::ROWS, true );
		return false === $row ? null : (string) $row;
	}

	/**
	 * Get all alert switches, with defaults filled in for rows or channels that
	 * were never saved.
	 *
	 * Before the 3.7.3 upgrade has run, the tracking row falls back to the old
	 * `enable_diagnostic_email` setting, so a site that turned that email off
	 * does not get it back in the meantime.
	 *
	 * @return array<string, array<string, bool>>
	 */
	public function get_all(): array {
		if ( $this->has_stored_option( self::FIELD_ALERTS ) ) {
			// Rows that are not stored (the Pro rows on free) fall back to their default.
			return array_merge( self::get_defaults(), $this->sanitize_alert_channels( $this->get_option( self::FIELD_ALERTS ) ) );
		}

		$alerts = self::get_defaults();
		if ( $this->has_stored_option( 'enable_diagnostic_email' ) ) {
			$alerts['tracking_health']['email'] = $this->get_option_bool( 'enable_diagnostic_email' );
		}

		return $alerts;
	}

	/**
	 * Whether a notification type may be sent to a channel.
	 *
	 * Types that are not an alert row (such as 'report.story', which has its own
	 * per-report channel) are never enabled here.
	 *
	 * @param string $type    Notification type, e.g. 'health.degraded'.
	 * @param string $channel Channel, 'email' or 'slack'.
	 */
	public function is_enabled( string $type, string $channel ): bool {
		$row = self::get_row_for_type( $type );
		if ( null === $row || ! in_array( $channel, self::CHANNELS, true ) ) {
			return false;
		}

		$alerts = $this->get_all();
		return ! empty( $alerts[ $row ][ $channel ] );
	}

	/**
	 * Get the alert email recipients.
	 *
	 * Defaults to the site admin email only when the setting was never saved.
	 * An empty saved list stays empty: the settings page asks for an address
	 * instead, so an email is never sent somewhere the user did not choose.
	 *
	 * @return string[] Valid, unique email addresses.
	 */
	public function get_email_recipients(): array {
		$recipients = $this->has_stored_option( self::FIELD_RECIPIENTS )
			? $this->get_option( self::FIELD_RECIPIENTS )
			: [ (string) get_option( 'admin_email' ) ];

		/**
		 * Filter the recipients of alert emails (tracking problems, traffic spikes and drops).
		 *
		 * @param string[] $recipients Email addresses from Settings › Notifications › Email.
		 */
		$recipients = apply_filters( 'burst_alert_email_recipients', $this->sanitize_email_list( $recipients ) );

		return $this->sanitize_email_list( $recipients );
	}

	/**
	 * Set one alert switch and save it.
	 *
	 * @param string $row     Row key, e.g. 'traffic_spike'.
	 * @param string $channel Channel, 'email' or 'slack'.
	 * @param bool   $enabled Whether the alert goes to the channel.
	 */
	public function set_enabled( string $row, string $channel, bool $enabled ): void {
		$this->set_enabled_for_rows( [ $row ], $channel, $enabled );
	}

	/**
	 * Set one channel switch for several alert rows and save them in one write.
	 * Unknown rows and channels are ignored.
	 *
	 * @param string[] $rows    Row keys, e.g. [ 'traffic_spike', 'traffic_drop' ].
	 * @param string   $channel Channel, 'email' or 'slack'.
	 * @param bool     $enabled Whether the alerts go to the channel.
	 */
	public function set_enabled_for_rows( array $rows, string $channel, bool $enabled ): void {
		$rows = array_intersect( $rows, array_keys( self::ROWS ) );
		if ( empty( $rows ) || ! in_array( $channel, self::CHANNELS, true ) ) {
			return;
		}

		$alerts = $this->get_all();
		foreach ( $rows as $row ) {
			$alerts[ $row ][ $channel ] = $enabled;
		}
		burst_update_option( self::FIELD_ALERTS, $this->sanitize_alert_channels( $alerts ) );
	}

	/**
	 * Get the rows, out of the given ones, that were never saved.
	 *
	 * @param string[] $rows Row keys to check.
	 * @return string[] Row keys without a stored value.
	 */
	public function get_unsaved_rows( array $rows ): array {
		$stored = $this->has_stored_option( self::FIELD_ALERTS ) ? $this->get_option( self::FIELD_ALERTS ) : [];
		if ( ! is_array( $stored ) ) {
			$stored = [];
		}

		return array_values(
			array_filter(
				$rows,
				static function ( string $row ) use ( $stored ): bool {
					return ! isset( $stored[ $row ] );
				}
			)
		);
	}

	/**
	 * Move the old notification settings into the alert grid, once.
	 *
	 * - `enable_diagnostic_email` becomes the email switch of the tracking row.
	 * - Email for spike and drop stays off, Slack stays on for every alert.
	 * - The recipients list starts with the site admin email.
	 * - `enable_diagnostic_email` is removed. `default_report_channels` stays:
	 *   a stored choice still wins over the Slack default (Report::get_default_channels()).
	 *
	 * Safe to run more than once: saved values are never overwritten.
	 */
	public function migrate_legacy_settings(): void {
		if ( ! $this->has_stored_option( self::FIELD_ALERTS ) ) {
			// Free stores its own rows only, so a later switch to Pro still turns
			// on the Pro defaults (see Pro::setup_alert_email_defaults()).
			burst_update_option( self::FIELD_ALERTS, $this->sanitize_alert_channels( $this->get_all() ) );
		}

		if ( ! $this->has_stored_option( self::FIELD_RECIPIENTS ) ) {
			burst_update_option( self::FIELD_RECIPIENTS, $this->sanitize_email_list( [ (string) get_option( 'admin_email' ) ] ) );
		}

		burst_delete_option( 'enable_diagnostic_email' );
	}

	/**
	 * Whether a setting has been saved in burst_options_settings, as opposed to
	 * falling back to its default.
	 *
	 * @param string $name Setting name.
	 */
	private function has_stored_option( string $name ): bool {
		$options = get_option( 'burst_options_settings', [] );
		return is_array( $options ) && array_key_exists( $name, $options );
	}
}
