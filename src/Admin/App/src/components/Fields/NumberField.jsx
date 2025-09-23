import { forwardRef } from 'react';
import TextInput from '@/components/Inputs/TextInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * NumberField component
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props (including min, max, step).
 * @returns {JSX.Element}
 */
const NumberField = forwardRef(
  ({ field, fieldState, label, help, setting, context, className, ...props }, ref ) => {
    const inputId = props.id || field.name;
    // Convert empty string to undefined to allow placeholder to show
      const value = String(field.value) ?? ''; // convert undefined to empty string for controlled input
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
          {...field}
          value={value} // leave number intact
          id={inputId}
          type="number"
          aria-invalid={!! fieldState?.error?.message}
          ref={ref}
          min={setting?.min}
          max={setting?.max}
          step={props.step}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onChange={(e) => field.onChange(e.target.value )}
        />
      </FieldWrapper>
    );
  }
);

NumberField.displayName = 'NumberField';

export default NumberField;
