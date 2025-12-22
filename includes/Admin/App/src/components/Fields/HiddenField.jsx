import { forwardRef } from 'react';
import HiddenInput from '@/components/Inputs/HiddenInput';

/**
 * TextField component
 * @param {Object} field      - Provided by react-hook-form's Controller
 * @param {Object} fieldState - Contains validation state
 * @param {Object} props
 * @return {JSX.Element}
 */
const HiddenField = forwardRef( ({ field, fieldState, ...props }) => {
	const inputId = props.id || field.name;

	return (
		<HiddenInput
			{...field}
			id={inputId}
			type="hidden"
			aria-invalid={!! fieldState?.error?.message}
			{...props}
		/>
	);
});

HiddenField.displayName = 'HiddenField';
export default HiddenField;
