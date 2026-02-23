import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import SwitchInput from '@/components/Fields/SwitchInput';
import Icon from '@/utils/Icon';
import { get_website_url } from '@/utils/lib.js';
import useOnboardingStore from '@/store/useOnboardingStore';

/**
 * AnonymousUsageData component for the onboarding wizard.
 *
 * Displays a consent UI for sharing anonymous usage data with clear information
 * about what is and isn't collected.
 *
 * @param {object} props - Component props.
 * @param {object} props.field - Field configuration.
 * @param {Function} props.onChange - Callback when value changes.
 * @param {boolean} props.value - Current field value.
 * @returns {JSX.Element}
 */
const AnonymousUsageData = ( { field, onChange, value } ) => {
	const { onboardingData } = useOnboardingStore();

	const learnMoreUrl = get_website_url( 'https://burst-statistics.com/how-we-handle-anonymous-usage-data/', {
		utm_source: onboardingData.prefix + '_onboarding',
		utm_content: 'anonymous-usage-data',
	} );

	return (
		<FieldWrapper label="" inputId={ field.id }>
			<div className="w-full space-y-5">
				{/* Toggle control */ }
				<div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
					<div className="flex flex-col gap-1">
						<span className="text-md font-medium text-gray-800">
							{ __( 'Share anonymous usage data', 'burst-statistics' ) }
						</span>
						<span className={ `text-sm ${ value ? 'text-green-600' : 'text-gray-500' }` }>
							{ value
								? __( 'Enabled — thank you for helping us improve!', 'burst-statistics' )
								: __( 'Disabled', 'burst-statistics' )
							}
						</span>
					</div>
					<SwitchInput
						id={ field.id }
						value={ value }
						onChange={ onChange }
					/>
				</div>

				{/* Learn more link */ }
				<a
					href={ learnMoreUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
				>
					{ __( 'Learn more about how we handle data', 'burst-statistics' ) }
					<Icon name="external-link" size={ 14 } color="blue" />
				</a>
			</div>
		</FieldWrapper>
	);
};

export default AnonymousUsageData;

