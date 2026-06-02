import { forwardRef, InputHTMLAttributes } from 'react';

interface ColorPickerInputProps extends InputHTMLAttributes<HTMLInputElement> {
	value?: string;
}

/**
 * Reusable ColorPickerInput component.
 * Uses a native color input with custom styling to match the project's design.
 */
const ColorPickerInput = forwardRef<HTMLInputElement, ColorPickerInputProps>(
	({ value, ...props }, ref ) => {
		return (
			<div className="flex items-center gap-3">
				<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-400 focus-within:border-primary-700 focus-within:ring-3 focus-within:ring-primary-700/20">
					<input
						ref={ref}
						type="color"
						value={value || '#000000'}
						className="absolute -inset-1 h-[150%] w-[150%] cursor-pointer border-none bg-transparent p-0"
						{...props}
					/>
				</div>
				<input
					type="text"
					value={value || ''}
					onChange={props.onChange}
					placeholder="#000000"
					className="w-32 rounded-md border border-gray-400 bg-white p-2 text-sm uppercase focus:border-primary-700 focus:outline-hidden focus:ring-3 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200"
					disabled={props.disabled}
				/>
			</div>
		);
	}
);

ColorPickerInput.displayName = 'ColorPickerInput';

export default ColorPickerInput;
