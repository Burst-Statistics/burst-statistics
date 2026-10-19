import { forwardRef } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import ProBadge from '@/components/Common/ProBadge';
import useLicenseData from '@/hooks/useLicenseData';
import AlertChannelSwitch from './AlertChannelSwitch';
import {
	ALERT_CHANNELS,
	getAlertValue,
	goToSlackWebhook,
	isSlackWebhookSet,
	setAlertValue
} from './alertSettings';
import type { AlertChannel, AlertRow, AlertRows, AlertValues } from './alertSettings';

interface AlertChannelsFieldProps {
	field: {
		name: string;
		value: AlertValues;
		onChange: ( value: AlertValues ) => void;
	};
	options?: AlertRows;
	setting: {
		default?: AlertValues;
		[key: string]: unknown;
	};

	/** Form control passed down by Field.jsx; the settings form has no FormProvider. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	control: Control<any>;
	disabled?: boolean;
}

/**
 * The alert grid in Settings › Notifications: one row per alert, one switch per
 * channel (Email, Slack). Pro rows and the Slack column need a valid license;
 * the Slack column also needs a webhook, which is watched live so typing one
 * enables the column before saving.
 */
const AlertChannelsField = forwardRef<HTMLDivElement, AlertChannelsFieldProps>(
	({ field, options = {}, setting, control, disabled = false }, ref ) => {
		const { isLicenseValid } = useLicenseData();
		const webhookUrl = useWatch({ control, name: 'slack_webhook_url' });
		const hasWebhook = isSlackWebhookSet( webhookUrl, window.burst_settings?.slack_webhook_prefix );
		const defaults = setting?.default;

		const channelLabels: Record<AlertChannel, string> = {
			email: __( 'Email', 'burst-statistics' ),
			slack: __( 'Slack', 'burst-statistics' )
		};

		// fallow-ignore-next-line complexity
		const getUnavailableReason = ( row: AlertRow, channel: AlertChannel ): string | undefined => {
			if ( disabled ) {
				return __( 'This setting is disabled.', 'burst-statistics' );
			}
			if ( ( row.pro || 'slack' === channel ) && ! isLicenseValid ) {
				return __( 'Available in Burst Pro.', 'burst-statistics' );
			}
			if ( 'slack' === channel && ! hasWebhook ) {
				return __( 'Add a Slack webhook below first.', 'burst-statistics' );
			}
			return undefined;
		};

		const handleChange = ( rowKey: string, channel: AlertChannel, checked: boolean ): void => {
			field.onChange( setAlertValue( field.value, defaults, options, rowKey, channel, checked ) );
		};

		const gridClass = 'grid grid-cols-[minmax(0,1fr)_5rem_5rem] items-center gap-x-2 px-6';

		return (
			<div ref={ref} className="w-full burst_field_alerts" data-tour="field-alerts">
				<div className={`${ gridClass } pb-2`}>
					<span />
					{ALERT_CHANNELS.map( ( channel ) => (
						<span key={channel} className="flex items-center justify-center gap-1.5 text-sm font-medium text-text-gray">
							{channelLabels[ channel ]}
							{'slack' === channel && ! isLicenseValid && (
								<ProBadge id="slack" label="Pro" />
							)}
						</span>
					) )}
				</div>

				{Object.entries( options ).map( ([ rowKey, row ]) => (
					<div key={rowKey} className={`${ gridClass } border-t border-gray-200 py-4 burst-alert-row-${ rowKey }`}>
						<div className="flex flex-col gap-0.5">
							<span className="flex items-center gap-2 text-md font-medium text-text-black">
								{row.label}
								{row.pro && ! isLicenseValid && (
									<ProBadge id={`alerts-${ rowKey }`} label="Pro" />
								)}
							</span>
							{row.context && (
								<span className="text-sm text-text-gray">{row.context}</span>
							)}
						</div>
						{ALERT_CHANNELS.map( ( channel ) => (
							<AlertChannelSwitch
								key={channel}
								id={`alerts-${ rowKey }-${ channel }`}
								alertLabel={row.label}
								channelLabel={channelLabels[ channel ]}
								checked={getAlertValue( field.value, defaults, rowKey, channel )}
								onChange={( checked ) => handleChange( rowKey, channel, checked )}
								unavailableReason={getUnavailableReason( row, channel )}
							/>
						) )}
					</div>
				) )}

				{isLicenseValid && ! hasWebhook && (
					<p className="border-t border-gray-200 px-6 pt-3 text-right text-sm text-text-gray">
						{createInterpolateElement(
							__( 'To get alerts in Slack, <a>add a webhook below</a>.', 'burst-statistics' ),
							{
								a: (
									<button
										type="button"
										className="cursor-pointer text-blue underline"
										onClick={goToSlackWebhook}
									/>
								)
							}
						)}
					</p>
				)}
			</div>
		);
	}
);

AlertChannelsField.displayName = 'AlertChannelsField';

export default AlertChannelsField;
