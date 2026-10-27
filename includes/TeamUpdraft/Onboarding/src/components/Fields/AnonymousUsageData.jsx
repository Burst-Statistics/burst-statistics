import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import SwitchInput from '@/components/Fields/SwitchInput';
import Icon from '@/utils/Icon';
import { get_website_url } from '@/utils/lib.js';
import useOnboardingStore from '@/store/useOnboardingStore';
import ComparisonExample from './ComparisonExample';

/**
 * AnonymousUsageData component for the onboarding wizard.
 *
 * Displays a consent UI for sharing anonymous usage data. The plugin can pass
 * an `example` of what the user gets in return, a `privacy_note`, a
 * `toggle_label` and an `enabled_status` text.
 *
 * @param {Object}   props          - Component props.
 * @param {Object}   props.field    - Field configuration, optionally with `example` and `enabled_status`.
 * @param {Function} props.onChange - Callback when value changes.
 * @param {boolean}  props.value    - Current field value.
 * @return {JSX.Element}
 */
const AnonymousUsageData = ( { field, onChange, value } ) => {
	const { onboardingData } = useOnboardingStore();

	const learnMoreUrl = get_website_url(
		'https://burst-statistics.com/how-we-handle-anonymous-usage-data/',
		{
			utm_source: onboardingData.prefix + '_onboarding',
			utm_content: 'anonymous-usage-data',
		}
	);

	return (
		<FieldWrapper label="" inputId={ field.id }>
			<div className="w-full flex flex-col gap-5">
				{ field.privacy_note && (
					<p className="text-sm text-text-gray">
						{ field.privacy_note }
					</p>
				) }

				{ /* Toggle control */ }
				<div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
					<div className="flex flex-col gap-1">
						<span className="text-md font-medium text-text-gray">
							{ field.toggle_label ||
								__(
									'Share anonymous usage data',
									'burst-statistics'
								) }
						</span>
						<span
							className={ `text-sm ${
								value ? 'text-green-600' : 'text-text-gray'
							}` }
						>
							{ value
								? field.enabled_status ||
								  __( 'On', 'burst-statistics' )
								: __( 'Off', 'burst-statistics' ) }
						</span>
					</div>
					<SwitchInput
						id={ field.id }
						value={ value }
						onChange={ onChange }
					/>
				</div>

				<ComparisonExample example={ field.example } />

				{ /* Learn more link */ }
				<a
					href={ learnMoreUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
				>
					{ __(
						'Learn more about how we handle data',
						'burst-statistics'
					) }
					<Icon name="external-link" size={ 14 } color="blue" />
				</a>
			</div>
		</FieldWrapper>
	);
};

export default AnonymousUsageData;
