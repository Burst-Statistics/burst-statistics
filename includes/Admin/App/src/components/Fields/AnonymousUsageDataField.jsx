import { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import SwitchInput from '@/components/Inputs/SwitchInput';
import CommunityComparisonExample from '@/components/Fields/AnonymousUsageData/CommunityComparisonExample';
import DataSharingDetails from '@/components/Fields/AnonymousUsageData/DataSharingDetails';
import DataSharingStatusText from '@/components/Fields/AnonymousUsageData/DataSharingStatusText';

/**
 * AnonymousUsageDataField component.
 *
 * Sharing anonymous usage data unlocks the comparison with similar websites on
 * the dashboard. Leads with that comparison, shows an example of it and when the
 * data was last synced, and keeps the details of what is shared always visible.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} setting - The field config, with the saved value and the sync status.
 * @param {object} props - Additional props from react-hook-form's Controller.
 * @returns {JSX.Element}
 */
const AnonymousUsageDataField = forwardRef(
	({ field, fieldState, help, context, setting, ...props }, ref ) => {
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
				<div className="w-full flex flex-col gap-5 px-6">
					{/* Heading: the same title and explanation as the onboarding step */ }
					<div className="flex flex-col gap-2">
						<h3 className="text-md font-semibold text-text-black">
							{ __( 'Share usage data and learn how you compare', 'burst-statistics' ) }
						</h3>
						<p className="text-sm leading-relaxed text-text-gray">
							{ __( 'See how your site compares to similar websites. Burst also uses this anonymous data to learn which features are used.', 'burst-statistics' ) }
						</p>
						<p className="text-sm leading-relaxed text-text-gray">
							{ __( 'No URLs, IP addresses or personal data.', 'burst-statistics' ) }
						</p>
					</div>

					{/* Control: Toggle with label and status */ }
					<div className="flex items-center justify-between gap-4">
						<div className="flex flex-col gap-1">
							<span className="text-md font-medium text-text-black">
								{ __( 'Share anonymous usage data with Burst', 'burst-statistics' ) }
							</span>
							<DataSharingStatusText isEnabled={ isEnabled } setting={ setting } />
						</div>
						<SwitchInput
							id={ inputId }
							value={ isEnabled }
							onChange={ ( checked ) => field.onChange( checked ) }
							disabled={ props.disabled }
							ref={ ref }
						/>
					</div>

					<CommunityComparisonExample />

					<DataSharingDetails />
				</div>
			</FieldWrapper>
		);
	}
);

AnonymousUsageDataField.displayName = 'AnonymousUsageDataField';

export default AnonymousUsageDataField;
