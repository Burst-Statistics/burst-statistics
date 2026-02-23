import {__, sprintf} from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import React, {useEffect, useRef} from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { useFormContext } from 'react-hook-form';
import { EmailSelectInput } from '@/components/Inputs/EmailSelectInput';

const isValidEmail = ( email: string ): boolean => {
	const trimmed = email.trim();
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test( trimmed );
};

const MAX_RECIPIENTS = 100;

export const Recipients = () => {
	const emails = useWizardStore( ( state ) => state.wizard.recipients );
	const setEmails = useWizardStore( ( state ) => state.setRecipients );

	const isFirstRender = useRef( true );
	const {
		register,
		setValue,
		formState: { errors }
	} = useFormContext();

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


	return (
		<>
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
				className="burst-reporting-wizard-gutter !pt-0 mt-5"
			>
				<p className="text-black text-md font-semibold">
					{__( 'Recipients', 'burst-statistics' )}
				</p>

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
