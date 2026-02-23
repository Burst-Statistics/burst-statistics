import { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import SwitchInput from '@/components/Inputs/SwitchInput';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';

/**
 * AnonymousUsageDataField component.
 *
 * Displays a comprehensive UI for managing anonymous usage data sharing preferences.
 * Uses a toggle switch for immediate visual feedback and shows transparency details by default.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props from react-hook-form's Controller.
 * @returns {JSX.Element}
 */
const AnonymousUsageDataField = forwardRef(
	({ field, fieldState, help, context, ...props }, ref ) => {
		const inputId = props.id || field.name;
		const isEnabled = Boolean( field.value );

		return (
			<FieldWrapper
				label=""
				help={ help }
				error={ fieldState?.error?.message }
				context={ context }
				inputId={ inputId }
				fullWidthContent={ true }
				recommended={ props.recommended }
				disabled={ props.disabled }
				{ ...props }
			>
				<div className="w-full space-y-5 px-6">
					{/* Control: Toggle with label and status */ }
					<div className="flex items-center justify-between gap-4">
						<div className="flex flex-col gap-1">
							<span className="text-md font-medium text-black">
								{ __( 'Share anonymous usage data', 'burst-statistics' ) }
							</span>
							<span className={ `text-sm ${ isEnabled ? 'text-primary' : 'text-gray' }` }>
								{ isEnabled ?
									__( 'Enabled — thank you for helping us improve!', 'burst-statistics' ) :
									__( 'Disabled', 'burst-statistics' )
								}
							</span>
						</div>
						<SwitchInput
							id={ inputId }
							value={ isEnabled }
							onChange={ ( checked ) => field.onChange( checked ) }
							disabled={ props.disabled }
							ref={ ref }
						/>
					</div>

					{/* Explanation */ }
					<p className="text-sm leading-relaxed text-gray">
						{ __(
							'Help us build better features, prioritize integrations, and improve recommendations by sharing anonymous usage data. We never collect personal information, your site URL, or IP addresses. Everything stays completely anonymous.',
							'burst-statistics'
						) }
					</p>

					{/* Details: Always visible for transparency */ }
					<div className="grid gap-4 sm:grid-cols-2">
						{/* What we collect */ }
						<div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
							<h4 className="flex items-center gap-2 text-sm font-semibold text-black">
								<Icon name="circle-check" color="green" size={ 16 } />
								{ __( 'What we collect', 'burst-statistics' ) }
							</h4>
							<ul className="space-y-1.5 text-sm text-gray">
								<li className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
									{ __( 'General site metrics (e.g., monthly visitors, bounce rate)', 'burst-statistics' ) }
								</li>
								<li className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
									{ __( 'Active plugins & WordPress/PHP versions', 'burst-statistics' ) }
								</li>
								<li className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
									{ __( 'Burst settings you use', 'burst-statistics' ) }
								</li>
							</ul>
						</div>

						{/* What we don't collect */ }
						<div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
							<h4 className="flex items-center gap-2 text-sm font-semibold text-black">
								<Icon name="ban" color="red" size={ 16 } />
								{ __( 'What we never collect', 'burst-statistics' ) }
							</h4>
							<ul className="space-y-1.5 text-sm text-gray">
								<li className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
									{ __( 'Your site URL, admin emails, or user data', 'burst-statistics' ) }
								</li>
								<li className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
									{ __( 'Visitor IP addresses or specific page URLs', 'burst-statistics' ) }
								</li>
							</ul>
						</div>
					</div>

					{/* Learn more link */ }
					<a
						href={burst_get_website_url( 'how-we-handle-anonymous-usage-data' )}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-sm text-wp-blue hover:underline"
					>
						{ __( 'Learn more about how we handle data', 'burst-statistics' ) }

					</a>
				</div>
			</FieldWrapper>
		);
	}
);

AnonymousUsageDataField.displayName = 'AnonymousUsageDataField';

export default AnonymousUsageDataField;
