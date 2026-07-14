import RadioButtonsInput from '@/components/Inputs/RadioButtonsInput';
import {
	buildControllerFieldProps,
	renderWrappedField
} from '@/components/Fields/fieldHelpers';

/**
 * RadioButtonsField component
 *
 * Renders a group of radio buttons within a FieldWrapper.
 *
 * @param {Object} field      - Provided by react-hook-form's Controller.
 * @param {Object} fieldState - Contains validation state.
 * @param {string} label      - Field label.
 * @param {string} help       - Help text for the field.
 * @param {string} context    - Contextual information for the field.
 * @param {string} className  - Additional Tailwind CSS classes.
 * @return {JSX.Element}
 */
const RadioButtonsField =
	({ field, fieldState, label, help, context, className, ...props }) => {
		const { inputId, wrapperProps } = buildControllerFieldProps({
			field,
			fieldState,
			props,
			label,
			help,
			context,
			className
		});

		return renderWrappedField({
			wrapperProps,
			InputComponent: RadioButtonsInput,
			inputProps: {
				id: inputId,
				options: field.options,
				value: field.value,
				disabled: props.settingsIsUpdating || field.disabled,
				goalId: field.goal_id, // Optional goal id for namespacing, if provided.
				...props
			}
		});
	};

RadioButtonsField.displayName = 'RadioButtonsField';

export default RadioButtonsField;
