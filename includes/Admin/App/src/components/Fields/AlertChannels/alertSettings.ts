/**
 * Helpers for the alert grid in Settings › Notifications (field type
 * 'alert_channels'). Kept free of React so the rules can be unit tested.
 */

export type AlertChannel = 'email' | 'slack';

export const ALERT_CHANNELS: AlertChannel[] = [ 'email', 'slack' ];

/** One row of the alert grid, as configured in config/fields.php. */
export interface AlertRow {
	label: string;
	context?: string;
	pro?: boolean;
}

export type AlertRows = Record<string, AlertRow>;

/** Saved switches, keyed by alert row and channel. */
export type AlertValues = Record<string, Partial<Record<AlertChannel, boolean>>>;

/**
 * Whether a Slack webhook URL is set. The saved value comes back masked, but
 * keeps the Slack prefix, so the prefix check covers saved and typed values.
 * The prefix is localized by Pro (Slack_Channel::SLACK_WEBHOOK_PREFIX); without
 * it (free) no webhook counts as set.
 *
 * @param {unknown} value  Current value of the slack_webhook_url field.
 * @param {string}  prefix Required start of a Slack webhook URL.
 * @return {boolean} True when the value is a Slack webhook URL.
 */
export const isSlackWebhookSet = ( value: unknown, prefix?: string ): boolean => {
	return !! prefix && 'string' === typeof value && value.trim().startsWith( prefix );
};

/**
 * Scroll to the Slack webhook field and focus it.
 */
export const goToSlackWebhook = (): void => {
	if ( 'undefined' !== typeof window ) {
		window.dispatchEvent( new CustomEvent( 'burst_open_slack_webhook' ) );
	}
	document.getElementById( 'burst-settings-group-slack' )?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	document.getElementById( 'slack_webhook_url' )?.focus({ preventScroll: true });
};

/**
 * Read one switch, falling back to the field default for rows or channels
 * that were never saved.
 *
 * @param {unknown}      values   Current field value.
 * @param {AlertValues}  defaults Field default.
 * @param {string}       row      Alert row key.
 * @param {AlertChannel} channel  Channel.
 * @return {boolean} Whether the switch is on.
 */
export const getAlertValue = (
	values: unknown,
	defaults: AlertValues | undefined,
	row: string,
	channel: AlertChannel
): boolean => {
	const saved = ( values as AlertValues | undefined )?.[ row ]?.[ channel ];
	if ( 'boolean' === typeof saved ) {
		return saved;
	}
	return Boolean( defaults?.[ row ]?.[ channel ]);
};

/**
 * Return a copy of the alert values with one switch changed. Every row and
 * channel is filled in, so the saved value always has the full shape.
 *
 * @param {unknown}      values   Current field value.
 * @param {AlertValues}  defaults Field default.
 * @param {AlertRows}    rows     Configured rows.
 * @param {string}       row      Row to change.
 * @param {AlertChannel} channel  Channel to change.
 * @param {boolean}      enabled  New state.
 * @return {AlertValues} New field value.
 */
export const setAlertValue = (
	values: unknown,
	defaults: AlertValues | undefined,
	rows: AlertRows,
	row: string,
	channel: AlertChannel,
	enabled: boolean
): AlertValues => {
	const next: AlertValues = {};
	Object.keys( rows ).forEach( ( key ) => {
		next[ key ] = {};
		ALERT_CHANNELS.forEach( ( ch ) => {
			next[ key ][ ch ] = getAlertValue( values, defaults, key, ch );
		});
	});
	next[ row ] = { ...next[ row ], [ channel ]: enabled };
	return next;
};

/**
 * Whether any alert that the user can use is switched on for a channel.
 * Pro rows only count with a valid license.
 *
 * @param {unknown}      values         Current field value.
 * @param {AlertRows}    rows           Configured rows.
 * @param {AlertChannel} channel        Channel.
 * @param {boolean}      isLicenseValid Whether Pro is active.
 * @param {AlertValues}  defaults       Field default, for switches that were never saved.
 * @return {boolean} True when at least one usable switch is on.
 */
export const isChannelInUse = (
	values: unknown,
	rows: AlertRows,
	channel: AlertChannel,
	isLicenseValid: boolean,
	defaults?: AlertValues
): boolean => {
	return Object.entries( rows ).some(
		([ key, row ]) => ( ! row.pro || isLicenseValid ) && getAlertValue( values, defaults, key, channel )
	);
};
