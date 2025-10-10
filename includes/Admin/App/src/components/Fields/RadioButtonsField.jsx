import { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import RadioButtonsInput from '@/components/Inputs/RadioButtonsInput';

/**
 * RadioButtonsField component
 *
 * Renders a group of radio buttons within a FieldWrapper.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @returns {JSX.Element}
 */
const RadioButtonsField = forwardRef(
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
        <RadioButtonsInput
          id={inputId}
          options={field.options}
          value={field.value}
          disabled={props.settingsIsUpdating || field.disabled}
          goalId={field.goal_id} // Optional goal id for namespacing, if provided.
          {...props}
        />
      </FieldWrapper>
    );
  }
);

RadioButtonsField.displayName = 'RadioButtonsField';

export default RadioButtonsField;
