import { forwardRef } from 'react';
import SwitchInput from '@/components/Inputs/SwitchInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * SwitchField component
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Other props from react-hook-form's Controller.
 * @returns {JSX.Element}
 */
const SwitchField = forwardRef(
  ({ field, fieldState, label, help, context, className, ...props }, ref ) => {
    const inputId = props.id || field.name;

    return (
      <FieldWrapper
        label={label}
        help={help}
        error={fieldState?.error?.message}
        context={context}
        className={className + ' flex-row'}
        inputId={inputId}
        required={props.required}
        alignWithLabel={true}
        recommended={props.recommended}
        disabled={props.disabled}
        {...props}
      >
        <SwitchInput
          {...field}
          id={inputId}
          aria-invalid={!! fieldState?.error?.message}
          ref={ref}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

SwitchField.displayName = 'SwitchField';

export default SwitchField;
