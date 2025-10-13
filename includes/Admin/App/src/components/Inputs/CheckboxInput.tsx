import { memo } from 'react';
import { __ } from '@wordpress/i18n';
import * as Checkbox from '@radix-ui/react-checkbox';

interface CheckboxInputProps {
  /** Label for the checkbox */
  label: string;
  /** The current value */
  value: boolean;
  /** Base id for the element */
  id: string;
  /** Callback when the value changes */
  onChange: (value: boolean) => void;
  /** If true, the field is required */
  required?: boolean;
  /** If true, the field is disabled */
  disabled?: boolean;
}

/**
 * CheckboxInput component
 *
 * Renders a single checkbox with a label
 * Uses Radix UI Checkbox for accessibility and consistent styling.
 */
const CheckboxInput: React.FC<CheckboxInputProps> = ({
  label,
  value,
  id,
  onChange,
  required,
  disabled,
}) => {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center">
        <Checkbox.Root
          className="w-4 h-4 border border-gray-400 rounded flex-shrink-0 disabled:opacity-50"
          id={id}
          checked={value}
          aria-label={label}
          disabled={disabled}
          required={required}
          onCheckedChange={(checked) => onChange(!!checked)}
        >
          <Checkbox.Indicator className="flex items-center justify-center">
            {/* <Icon
              name="check"
              size={14}
              color="dark-blue"
              tooltip=""
              onClick={() => {}}
              className=""
            /> */}
            x
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label className="ml-2" htmlFor={id}>
          {label}
        </label>
      </div>
    </div>
  );
};

export default memo(CheckboxInput); 