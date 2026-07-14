import { css } from '@codemirror/lang-css';
import CodeEditorInput from '@/components/Inputs/CodeEditorInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * CssField component. Renders a CSS code editor wired to react-hook-form.
 */
const CssField = createFieldComponent( CodeEditorInput, {
	customizeInputProps: ( inputProps, { field, props }) => ({
		...inputProps,
		value: field.value || '',
		onChange: ( value ) => field.onChange( value ),
		extensions: [ css() ],
		disabled: props.disabled
	})
});

CssField.displayName = 'CssField';

export default CssField;
