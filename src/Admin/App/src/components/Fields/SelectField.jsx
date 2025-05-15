import { forwardRef } from 'react';
import SelectInput from '@/components/Inputs/SelectInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * SelectField component
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props (including options array).
 * @returns {JSX.Element}
 */
const SelectField = forwardRef(
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
        alignWithLabel={true}
      >
        <SelectInput
          {...field}
          id={inputId}
          aria-invalid={!! fieldState?.error?.message}
          ref={ref}
          value={field.value || ''}
          onChange={( value ) => field.onChange( value )}
          options={props.options || []}
          disabled={props.disabled}
        />
      </FieldWrapper>
    );
  }
);

SelectField.displayName = 'SelectField';

export default SelectField;
