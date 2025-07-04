import { forwardRef } from 'react';
import TextInput from '@/components/Inputs/TextInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * TextField component
 * @param {object} field - Provided by react-hook-form's Controller
 * @param {object} fieldState - Contains validation state
 * @param {string} label
 * @param {string} help
 * @param {string} context
 * @param {string} className
 * @param {object} props
 * @return {JSX.Element}
 */
const TextField = forwardRef(
  ({ field, fieldState, label, help, context, className, ...props }, ref ) => {
    const inputId = props.id || field.name;

    return (
      <FieldWrapper
        label={label}
        help={help}
        error={fieldState?.error?.message}
        context={context}
        className={className}
        inputId={inputId}
        required={props.required}
        recommended={props.recommended}
        disabled={props.disabled}
        {...props}
      >
        <TextInput
          id={inputId}
          type="text"
          aria-invalid={!! fieldState?.error?.message}
          {...field}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

TextField.displayName = 'TextField';
export default TextField;
