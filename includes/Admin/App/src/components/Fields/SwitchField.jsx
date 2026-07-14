import SwitchInput from '@/components/Inputs/SwitchInput';
import { createFieldComponent } from '@/components/Fields/fieldHelpers';

/**
 * SwitchField component
 */
const SwitchField = createFieldComponent( SwitchInput, {
	alignWithLabel: true,
	extraClassName: 'flex-row'
});

SwitchField.displayName = 'SwitchField';

export default SwitchField;
