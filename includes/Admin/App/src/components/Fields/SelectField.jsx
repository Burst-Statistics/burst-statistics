import SelectInput from '@/components/Inputs/SelectInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * SelectField component
 */
const SelectField = createFieldComponent( SelectInput, {
	alignWithLabel: true,
	customizeInputProps: ( inputProps, { field, props }) => ({
		...inputProps,
		value: field.value || '',
		onChange: ( value ) => field.onChange( value ),
		options: props.options || [],
		disabled: props.disabled
	})
});

SelectField.displayName = 'SelectField';

export default SelectField;
