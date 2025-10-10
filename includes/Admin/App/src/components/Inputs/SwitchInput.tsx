import { forwardRef } from 'react';
import * as Switch from '@radix-ui/react-switch';

interface SwitchInputProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'value' | 'onChange'> {
  /** Can be a boolean or a string ("0" or "1") */
  value: boolean | string;
  /** Callback when the checked state changes */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Size of the switch - "default" or "small" */
  size?: 'default' | 'small';
  // Note: The label is managed in the field component.
}

const SwitchInput = forwardRef<HTMLButtonElement, SwitchInputProps>(
  (
    { value, onChange, disabled, required, size = 'default', className = '', ...props },
    ref,
  ) => {
    // Convert string "0"/"1" values to boolean if necessary.
    let checkedVal: boolean =
      typeof value === 'string' ? value === '1' : Boolean(value);

    // Define size-based classes for the switch's root and thumb.
    const rootSizeClasses =
      size === 'small' ? 'w-8 h-5' : 'w-10 h-6'; // "default" uses current classes.
    const thumbSizeClasses =
      size === 'small'
        ? 'w-3 h-3 translate-x-1 data-[state=checked]:translate-x-4'
        : 'w-4 h-4 translate-x-1 data-[state=checked]:translate-x-5';

    return (
      <div className="flex items-center">
        <Switch.Root
          ref={ref}
          className={`${rootSizeClasses} bg-gray-400 rounded-full relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:bg-primary ${className}`}
          checked={checkedVal}
          onCheckedChange={onChange}
          disabled={disabled}
          required={required}
          {...props}
        >
          <Switch.Thumb className={`block ${thumbSizeClasses} bg-white rounded-full shadow transform transition-transform duration-200`} />
        </Switch.Root>
      </div>
    );
  },
);

SwitchInput.displayName = 'SwitchInput';

export default SwitchInput; 