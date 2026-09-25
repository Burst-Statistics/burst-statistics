import { clsx } from 'clsx';
import RadioFieldOptionDetails from '@/components/Fields/RadioFieldOptionDetails';
import RadioFieldPrivacyMeter from '@/components/Fields/RadioFieldPrivacyMeter';
import useLicenseData from '@/hooks/useLicenseData';

/**
 * Normalizes a RadioField option into a consistent shape.
 *
 * Options may be a plain string (used as the label) or an object carrying
 * optional icon/returning/description/meter/level metadata.
 *
 * @param {string|Object} option - Raw option value from the field config.
 * @return {{label: string, icon: ?string, returning: ?string, description: ?string, meter: number, level: ?string, pro: ?(boolean|Object), disabled: boolean}}
 */
const normalizeOption = ( option ) => {
	if ( 'string' === typeof option ) {
		return { label: option, icon: null, returning: null, description: null, meter: 0, level: null, pro: false, disabled: false };
	}

	const { label, icon = null, returning = null, description = null, meter = 0, level = null, pro = false, disabled = false } = option;
	return { label, icon, returning, description, meter, level, pro, disabled };
};

/**
 * RadioFieldOption component.
 *
 * Renders a single selectable option card within a RadioField, wiring up the
 * underlying radio input and delegating option content/meter rendering.
 *
 * @param {Object}        props
 * @param {string}        props.inputId  - Base id for the radio group.
 * @param {string}        props.value    - Value represented by this option.
 * @param {Object}        props.field    - react-hook-form field object (value/onChange/name).
 * @param {string|Object} props.option   - Raw option config (string or object).
 * @param {boolean}       props.disabled - Whether the option is disabled.
 * @return {JSX.Element}
 */
// fallow-ignore-next-line complexity
const RadioFieldOption = ({ inputId, value, field, option, disabled }) => {
	const { isLicenseValid } = useLicenseData();
	const { label, icon, returning, description, meter, level, pro, disabled: optionDisabled } = normalizeOption( option );
	const isChecked = field.value === value;
	const optionId = `${inputId}-${value}`;
	const isOptionDisabled = Boolean( disabled || optionDisabled || ( pro && ! isLicenseValid ) );

	return (
		<label
			htmlFor={optionId}
			className={clsx(
				'flex items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200',
				isChecked ?
					'border-primary bg-primary-50' :
					'border-gray-200 bg-white hover:border-gray-300',
				isOptionDisabled ?
					'opacity-50 cursor-not-allowed' :
					'cursor-pointer'
			)}
		>
			<input
				type="radio"
				id={optionId}
				name={field.name}
				value={value}
				checked={isChecked}
				disabled={isOptionDisabled}
				onChange={() => field.onChange( value )}
				className={clsx(
					'h-5 w-5 shrink-0 rounded-full border border-gray-400 text-primary focus:ring-primary focus:ring-offset-0 mt-0.5',
					isOptionDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			/>
			<div className="flex flex-1 items-start justify-between gap-4">
				<RadioFieldOptionDetails
					label={label}
					icon={icon}
					returning={returning}
					description={description}
					pro={pro}
					inputId={inputId}
				/>
				{level && (
					<RadioFieldPrivacyMeter inputId={optionId} meter={meter} level={level} />
				)}
			</div>
		</label>
	);
};

RadioFieldOption.displayName = 'RadioFieldOption';

export default RadioFieldOption;
