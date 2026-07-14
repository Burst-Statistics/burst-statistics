import ColorPickerInput from '@/components/Inputs/ColorPickerInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * ColorPickerField component
 */
const ColorPickerField = createFieldComponent( ColorPickerInput );

ColorPickerField.displayName = 'ColorPickerField';

export default ColorPickerField;
