import CheckboxGroupInput from '@/components/Inputs/CheckboxGroupInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * CheckboxGroupField component
 */
const CheckboxGroupField = createFieldComponent( CheckboxGroupInput, {
	customizeInputProps: ( inputProps, { label }) => ({
		...inputProps,
		label
	})
});

CheckboxGroupField.displayName = 'CheckboxGroupField';

export default CheckboxGroupField;
