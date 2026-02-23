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
}

/**
 * SwitchInput component.
 *
 * A toggle switch built with Radix UI that provides a clean on/off control.
 *
 * @param {SwitchInputProps} props - Component props.
 * @returns {JSX.Element}
 */
const SwitchInput = forwardRef<HTMLButtonElement, SwitchInputProps>(
	(
		{ value, onChange, disabled, required, size = 'default', className = '', ...props },
		ref,
	) => {
		// Convert string "0"/"1" values to boolean if necessary.
		const checkedVal: boolean =
			typeof value === 'string' ? value === '1' : Boolean( value );

		// Define size-based classes for the switch's root and thumb.
		const rootSizeClasses =
			size === 'small' ? 'w-8 h-5' : 'w-10 h-6';
		const thumbSizeClasses =
			size === 'small'
				? 'w-3 h-3 translate-x-1 data-[state=checked]:translate-x-4'
				: 'w-4 h-4 translate-x-1 data-[state=checked]:translate-x-5';

		return (
			<div className="flex items-center">
				<Switch.Root
					ref={ ref }
					className={ `switch-root ${ rootSizeClasses } bg-gray-400 rounded-full relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${ className }` }
					checked={ checkedVal }
					onCheckedChange={ onChange }
					disabled={ disabled }
					required={ required }
					{ ...props }
				>
					<Switch.Thumb className={ `block ${ thumbSizeClasses } bg-white rounded-full shadow transform transition-transform duration-200` } />
				</Switch.Root>
			</div>
		);
	},
);

SwitchInput.displayName = 'SwitchInput';

export default SwitchInput;

