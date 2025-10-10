import { forwardRef } from 'react';
import HiddenInput from '@/components/Inputs/HiddenInput';

/**
 * TextField component
 * @param {object} field - Provided by react-hook-form's Controller
 * @param {object} fieldState - Contains validation state
 * @param {object} props
 * @return {JSX.Element}
 */
const HiddenField = forwardRef(
  ({ field, fieldState, ...props }, ref ) => {
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
  }
);

HiddenField.displayName = 'HiddenField';
export default HiddenField;
