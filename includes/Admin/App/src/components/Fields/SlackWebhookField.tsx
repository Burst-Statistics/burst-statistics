import React, { useState, forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import TextInput from '@/components/Inputs/TextInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import { doAction } from '@/utils/api';

interface SlackWebhookFieldProps {
	field: {
		name: string;
		value: string;
		onChange: ( value: string ) => void;
		onBlur?: () => void;
		ref?: React.Ref<HTMLInputElement>;
	};
	fieldState?: {
		error?: {
			message?: string;
		};
	};
	help?: string;
	context?: React.ReactNode;
	id?: string;
	disabled?: boolean;
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// fallow-ignore-next-line complexity
const SlackWebhookField = forwardRef<HTMLDivElement, SlackWebhookFieldProps>(
	({ field, fieldState, help, context, disabled = false, ...props }, ref ) => {
		const [ isTesting, setIsTesting ] = useState( false );
		const [ testResult, setTestResult ] = useState<{ success: boolean; message: string } | null>( null );

		const inputId = props.id || field.name;

		const currentValue = field.value !== undefined ? field.value : ( props.setting?.value || '' );
		const hasValue = Boolean( currentValue && 0 < currentValue.trim().length );
		const isMasked = Boolean( currentValue && currentValue.includes( '•' ) );

		// fallow-ignore-next-line complexity
		const handleSendTest = async() => {
			const webhookUrl = currentValue ? currentValue.trim() : '';

			if ( ! webhookUrl ) {
				setTestResult({
					success: false,
					message: __( 'Please enter a Slack webhook URL first.', 'burst-statistics' )
				});
				return;
			}

			setIsTesting( true );
			setTestResult( null );

			try {
				const response: any = await doAction( 'slack_test', { // eslint-disable-line @typescript-eslint/no-explicit-any
					webhook_url: webhookUrl
				});

				if ( response && response.success ) {
					setTestResult({
						success: true,
						message: response.message || __( 'Test message sent successfully!', 'burst-statistics' )
					});
				} else {
					setTestResult({
						success: false,
						message: ( response && response.message ) || __( 'Failed to send test message.', 'burst-statistics' )
					});
				}
			} catch ( error: any ) { // eslint-disable-line @typescript-eslint/no-explicit-any
				setTestResult({
					success: false,
					message: error?.message || __( 'Network error while testing webhook.', 'burst-statistics' )
				});
			} finally {
				setIsTesting( false );
			}
		};

		return (
			<div ref={ref} className="w-full">
				<FieldWrapper
					inputId={inputId}
					help={help}
					error={fieldState?.error?.message}
					context={context}
					label={props.label || __( 'Slack webhook URL', 'burst-statistics' )}
					disabled={disabled}
					className={props.className}
					{...props}
				>
					<div className="flex flex-col gap-2 mt-1">
						<div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
							<div className="relative flex-1 min-w-0">
								<TextInput
									id={inputId}
									name={field.name}
									value={currentValue}
									onChange={( e ) => {
										setTestResult( null );
										field.onChange( e.target.value );
									}}
									onBlur={field.onBlur}
									placeholder="https://hooks.slack.com/services/..."
									disabled={disabled}
									className={`w-full font-mono text-sm ${hasValue && ! disabled ? 'pr-8' : ''}`}
								/>
								{hasValue && ! disabled && (
									<button
										type="button"
										onClick={() => {
											field.onChange( '' );
											setTestResult( null );
										}}
										title={__( 'Clear webhook URL', 'burst-statistics' )}
										className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-gray hover:text-text-black p-0.5 cursor-pointer focus:outline-hidden"
									>
										<Icon name="close" size={14} />
									</button>
								)}
							</div>
							<ButtonInput
								btnVariant="tertiary"
								size="md"
								onClick={handleSendTest}
								disabled={disabled || isTesting || ! hasValue}
								className="whitespace-nowrap shrink-0 flex items-center justify-center"
							>
								{isTesting ? (
									<span className="flex items-center gap-1.5">
										<Icon name="loading" size={14} className="animate-spin" />
										{__( 'Sending…', 'burst-statistics' )}
									</span>
								) : (
									__( 'Send test message', 'burst-statistics' )
								)}
							</ButtonInput>
						</div>

						{/* Saved / Unsaved status indicator */}
						{isMasked && (
							<div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
								<Icon name="check" size={13} className="shrink-0" />
								<span>{__( 'Slack webhook configured and saved', 'burst-statistics' )}</span>
							</div>
						)}
						{hasValue && ! isMasked && (
							<div className="flex items-center gap-1.5 text-xs text-text-gray mt-0.5">
								<span>{__( 'Unsaved changes — click Save at the bottom to apply.', 'burst-statistics' )}</span>
							</div>
						)}

						{/* Test Feedback */}
						{testResult && (
							<div
								className={`p-3 rounded-lg text-sm flex items-center gap-2.5 border transition-all mt-1 ${
									testResult.success ?
										'bg-primary-50 text-text-black border-primary' :
										'bg-red-50 text-text-black border-red'
								}`}
							>
								<Icon
									name={testResult.success ? 'check' : 'warning'}
									size={16}
									className={`shrink-0 ${testResult.success ? 'text-primary' : 'text-red'}`}
								/>
								<span className="leading-relaxed">{testResult.message}</span>
							</div>
						)}
					</div>
				</FieldWrapper>
			</div>
		);
	}
);

SlackWebhookField.displayName = 'SlackWebhookField';
export default SlackWebhookField;
