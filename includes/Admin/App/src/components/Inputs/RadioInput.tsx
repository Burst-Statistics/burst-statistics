import { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

interface RadioInputProps {
  /** ID for the radio input */
  id: string;
  /** Name attribute for the radio */
  name: string;
  /** Value of the radio button */
  value: string;
  /** Label text */
  label: string;
  /** Whether the radio is checked */
  checked: boolean;
  /** Optional disabled state */
  disabled?: boolean;
  /** Callback when radio is selected */
  onChange: (value: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Whether the radio is recommended */
  recommended?: boolean;
  /** Children to render inside the label */
  children?: React.ReactNode;
}

/**
 * RadioInput component
 *
 * Renders a single radio button with label
 */
const RadioInput = forwardRef<HTMLInputElement, RadioInputProps>(
  (
    { id, name, value, label, checked, disabled = false, onChange, className = '', tooltip = '', recommended = false, children },
    ref
  ) => {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          ref={ref}
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 my-1 mx-0"
        />
        <label htmlFor={id} className="text-sm text-gray cursor-pointer">
          {label} {children} {recommended && <span className="text-xs font-semibold">({__('Recommended', 'burst-statistics')})</span>}
        </label>
        {tooltip && <Icon tooltip={tooltip} color="blue" name="help" size={16} className='bg-blue-light rounded-full' />}
      </div>
    );
  }
);

RadioInput.displayName = 'RadioInput';

export default RadioInput; 