import React, { forwardRef } from 'react';
import Icon from '@/utils/Icon';

interface RadioOption {
  type: string;
  icon: string;
  label: string;
  description?: string;
}

interface RadioButtonsInputProps {
  /** Base id for the radio group */
  inputId: string;
  /** Radio options defined as a record */
  options: Record<string, RadioOption>;
  /** Currently selected radio value */
  value: string;
  /** Optionally disable the whole radio group */
  disabled?: boolean;
  /** Optional id prefix (e.g. goal id) to namespace the name attribute */
  goalId?: string;
  /** Callback when a radio option is selected */
  onChange: (value: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RadioButtonsInput component
 *
 * Renders a group of radio buttons based on the given options.
 * Each option is rendered with an icon, label, and an optional tooltip if a description is provided.
 */
const RadioButtonsInput = forwardRef<HTMLDivElement, RadioButtonsInputProps>(
  (
    { inputId, options, value, disabled = false, goalId, onChange, className = '' },
    ref
  ) => {
    // Construct the radio group name using goalId if provided.
    const name = goalId ? `${goalId}-${inputId}` : inputId;

    return (

        <div className="burst-radio-buttons__list grid grid-cols-2 gap-4">
          {Object.keys(options).map((key) => {
            const option = options[key];
            const optionId = `${name}-${option.type}`;
            return (
                <div className="burst-radio-buttons__list__item" key={optionId}>
                  <input
                    type="radio"
                    checked={option.type === value}
                    name={optionId}
                    id={optionId}
                    value={option.type}
                    disabled={disabled}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                  />
                  <label htmlFor={optionId}>
                    <Icon 
                      name={option.icon} 
                      size={18} 
                      color="black"
                      tooltip=""
                      onClick={() => {}}
                      className=""
                    />
                    <h5>{option.label}</h5>
                    {option.description && option.description.length > 1 && (
                      <>
                        <div className="burst-divider" />
                        <p>{option.description}</p>
                      </>
                    )}
                  </label>
                </div>
            );
          })}
        </div>
    );
  }
);

RadioButtonsInput.displayName = 'RadioButtonsInput';

export default RadioButtonsInput; 