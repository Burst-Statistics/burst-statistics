import { forwardRef } from 'react';
import TextAreaInput from '@/components/Inputs/TextAreaInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * TextAreaField component
 */
const TextAreaField = forwardRef(
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
      >
        <TextAreaInput
          id={inputId}
          aria-invalid={!! fieldState?.error?.message}
          {...field}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

TextAreaField.displayName = 'TextAreaField';
export default TextAreaField;
