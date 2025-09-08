import React, { forwardRef } from 'react';
import clsx from 'clsx';
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
  /** Number of columns in the grid (1-4) */
  columns?: 1 | 2 | 3 | 4;
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
 * Each option is rendered with a styled radio button, icon, label, and an optional description.
 */
const RadioButtonsInput = forwardRef<HTMLDivElement, RadioButtonsInputProps>(
  (
    { inputId, options, value, columns = 2, disabled = false, goalId, onChange, className = '' },
    ref
  ) => {
    // Construct the radio group name using goalId if provided.
    const name = goalId ? `${goalId}-${inputId}` : inputId;

    // Get the appropriate grid class based on columns
    const getGridClass = (cols: number): string => {
      switch (cols) {
        case 1: return 'grid-cols-1';
        case 2: return 'grid-cols-2';
        case 3: return 'grid-cols-3';
        case 4: return 'grid-cols-4';
        default: return 'grid-cols-2';
      }
    };

    return (
      <div className={clsx('burst-radio-buttons__list grid gap-4', getGridClass(columns), className)} ref={ref}>
        {Object.keys(options).map((key) => {
          const option = options[key];
          const optionId = `${name}-${option.type}`;
          const isSelected = option.type === value;
          
          return (
            <div className="w-full bg-gray-200 rounded-m" key={optionId}>
              <input
                type="radio"
                checked={isSelected}
                name={name}
                id={optionId}
                value={option.type}
                disabled={disabled}
                onChange={(e) => {
                  onChange(e.target.value);
                }}
                className="sr-only opacity-0 absolute"
              />
              <label 
                htmlFor={optionId}
                className={clsx(
                  'flex gap-xs m-[1px] items-start space-x-3 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer',
                  'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
                  {
                    'border-primary bg-primary-light': isSelected,
                    'border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50': !isSelected,
                    'opacity-50 cursor-not-allowed': disabled,
                  }
                )}
              >
                {/* Custom styled radio button */}
                <div className="flex-shrink-0 mt-1">
                  <div className={clsx(
                    'w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
                    {
                      'border-primary bg-primary': isSelected,
                      'border-gray-300 bg-white': !isSelected,
                    }
                  )}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>

                {/* Content area */}
                <div className="flex items-center flex-row min-w-0 gap-1">
                  <div className="flex items-center space-x-3">
                    <Icon 
                      name={option.icon} 
                      size={18} 
                      className="flex-shrink-0"
                    />
                    <h5 className={clsx(
                      'text-base font-medium transition-colors text-gray-900'
                    )}>
                      {option.label}
                    </h5>
                  </div>
                  
                  {option.description && option.description.length > 1 && (
                    <>
                      <div className="w-px bg-gray-400 mx-3 h-5"></div>
                      <p className={clsx(
                        'text-sm transition-colors truncate',
                        {
                          'text-gray-600': isSelected,
                          'text-gray-500': !isSelected,
                        }
                      )}>
                        {option.description}
                      </p>
                    </>
                  )}
                </div>
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