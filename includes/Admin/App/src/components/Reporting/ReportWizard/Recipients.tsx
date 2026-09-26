import {__, sprintf} from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import React, {useEffect, useRef} from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { useFormContext } from 'react-hook-form';
import { EmailSelectInput } from '@/components/Inputs/EmailSelectInput';
import RadioButtonsInput, { RadioOption } from '@/components/Inputs/RadioButtonsInput';
import { DeliveryChannelType } from '@/store/reports/types';
import useLicenseData from '@/hooks/useLicenseData';

const isValidEmail = ( email: string ): boolean => {
	const trimmed = email.trim();
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test( trimmed );
};

const MAX_RECIPIENTS = 100;

export const Recipients = () => {
	const emails = useWizardStore( ( state ) => state.wizard.recipients );
	const setEmails = useWizardStore( ( state ) => state.setRecipients );
	const channels = useWizardStore( ( state ) => state.wizard.channels || 'email' );
	const setChannels = useWizardStore( ( state ) => state.setChannels );
	const format = useWizardStore( ( state ) => state.wizard.format );
	const { isLicenseValid } = useLicenseData();

	const isFirstRender = useRef( true );
	const {
		register,
		setValue,
		formState: { errors }
	} = useFormContext();

	// If format changes away from story or license is not valid and both was selected, reset to email.
	// fallow-ignore-next-line complexity
	useEffect( () => {
		const isBothValid = 'story' === format && isLicenseValid;
		if ( 'both' === channels && ! isBothValid ) {
			setChannels( 'email' );
		} else if ( 'email' !== channels && 'both' !== channels ) {
			setChannels( 'email' );
		}
	}, [ format, channels, isLicenseValid, setChannels ]);

	useEffect( () => {
		register( 'recipients', {
			value: emails,
			validate: {
				required: ( value: string[]) =>
					0 < value.length ||
					__( 'Please add at least one recipient', 'burst-statistics' ),

				max: ( value: string[]) =>
					value.length <= MAX_RECIPIENTS ||
					sprintf(
						__( 'Maximum %d recipients allowed', 'burst-statistics' ),
						MAX_RECIPIENTS
					),

				format: ( value: string[]) =>
					value.every( isValidEmail ) ||
					__( 'One or more email addresses are invalid', 'burst-statistics' ),

				unique: ( value: string[]) =>
					new Set( value ).size === value.length ||
					__( 'Duplicate email addresses are not allowed', 'burst-statistics' )
			}
		});
	}, [ register ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setValue( 'recipients', emails, {
			shouldValidate: true
		});
	}, [ emails, setValue ]); // eslint-disable-line react-hooks/exhaustive-deps

	const channelOptions: Record<string, RadioOption> = {
		email: {
			type: 'email',
			label: __( 'Email', 'burst-statistics' ),
			icon: 'mail'
		},
		both: {
			type: 'both',
			label: __( 'Email and Slack', 'burst-statistics' ),
			icon: 'webhook',
			disabled: 'story' !== format,
			pro: true
		}
	};

	return (
		<>
			<div className="burst-reporting-wizard-gutter">
				<p className="text-lg font-semibold">
					{__( 'Delivery channel', 'burst-statistics' )}
				</p>
			</div>

			<FieldWrapper
				label=""
				inputId="report-channels"
				fullWidthContent
				className="burst-reporting-wizard-gutter !pt-0 mt-3 mb-6"
			>
				<RadioButtonsInput
					inputId="report-channels"
					options={channelOptions}
					value={channels}
					columns={2}
					onChange={( value ) => {
						setChannels( value as DeliveryChannelType );
					}}
				/>
				{'both' === channels && (
					<p className="text-xs text-text-gray mt-2">
						{__( 'This report will be sent to your configured email addresses and your Slack channel.', 'burst-statistics' )}
					</p>
				)}
				{'story' !== format && (
					<p className="text-xs text-text-gray mt-2">
						{__( 'Slack delivery is available for story reports.', 'burst-statistics' )}
					</p>
				)}
			</FieldWrapper>

			<div className="burst-reporting-wizard-gutter">
				<p className="text-lg font-semibold">
					{__( 'Recipients', 'burst-statistics' )}
				</p>
			</div>

			<FieldWrapper
				label=""
				inputId="recipients"
				error={errors.recipients?.message as string}
				fullWidthContent
				className="burst-reporting-wizard-gutter !pt-0 mt-3"
			>
				<div className="mt-3">
					<EmailSelectInput
						value={emails}
						name="recipients"
						maxSelections={MAX_RECIPIENTS}
						onChange={( nextEmails ) => {
							setEmails( nextEmails );
						}}
					/>
				</div>
			</FieldWrapper>
		</>
	);
};
