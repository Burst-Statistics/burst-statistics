import TextAreaInput from '@/components/Inputs/TextAreaInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * TextAreaField component
 */
const TextAreaField = createFieldComponent( TextAreaInput );

TextAreaField.displayName = 'TextAreaField';

export default TextAreaField;
