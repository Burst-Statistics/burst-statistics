import { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import RadioInput from '@/components/Inputs/RadioInput';
import RecommendBadge from '@/components/Common/RecommendBadge';

/**
 * RadioField component
 *
 * Renders a group of radio inputs within a FieldWrapper.
 * Now supports context information for individual options and recommended option indicators.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {boolean} disabled - Whether the field is disabled.
 * @param {object} options - Radio options as key-value pairs or objects with label, context, and recommended flag.
 * @returns {JSX.Element}
 */
const RadioField = forwardRef(
  (
    {
      field,
      fieldState,
      label,
      help,
      context,
      className,
      recommended,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = props.id || field.name;
    const options = props.options || {};

    return (
      <FieldWrapper
        label={label}
        help={help}
        error={fieldState?.error?.message}
        context={context}
        className={className}
        inputId={inputId}
        required={props.required}
        recommended={recommended}
        disabled={disabled}
        {...props}
      >
        <div className="space-y-4">
          {Object.entries( options ).map( ([ value, option ]) => {

            // Handle both simple string labels and object format with label and context
            const optionLabel =
              'string' === typeof option ? option : option.label;
            const optionContext =
              'object' === typeof option && option.context ?
                option.context :
                null;
            const isRecommended =
              'object' === typeof option && true === option.recommended;

            return (
              <div key={`${inputId}-${value}`} className="space-y-1">
                <div className="flex items-start gap-2 rounded-md border border-gray-400 bg-gray-100 px-3 py-2">
                  <RadioInput
                    id={`${inputId}-${value}`}
                    name={field.name}
                    value={value}
                    label={optionLabel}
                    checked={field.value === value}
                    disabled={disabled}
                    onChange={( value ) => field.onChange( value )}
                    className={className}
                  >
                    {isRecommended && <RecommendBadge />}

                    {optionContext && (
                      <div className="text-sm font-light text-gray">
                        {optionContext}
                      </div>
                    )}
                  </RadioInput>
                </div>
              </div>
            );
          })}
        </div>
      </FieldWrapper>
    );
  }
);

RadioField.displayName = 'RadioField';

export default RadioField;
