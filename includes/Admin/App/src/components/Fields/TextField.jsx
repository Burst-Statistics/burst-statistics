import TextInput from '@/components/Inputs/TextInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * TextField component
 */
const TextField = createFieldComponent( TextInput, {
	customizeInputProps: ( inputProps ) => ({
		...inputProps,
		type: 'text'
	})
});

TextField.displayName = 'TextField';
export default TextField;
