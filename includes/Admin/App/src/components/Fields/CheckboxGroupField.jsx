import { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import CheckboxGroupInput from '@/components/Inputs/CheckboxGroupInput';

/**
 * CheckboxGroupField component
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props (including required, disabled, options, indeterminate, etc.).
 * @returns {JSX.Element}
 */
const CheckboxGroupField = forwardRef(
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
        <CheckboxGroupInput
          {...field}
          id={inputId}
          label={label}
          ref={ref}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

CheckboxGroupField.displayName = 'CheckboxGroupField';

export default CheckboxGroupField;
