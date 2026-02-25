import React from 'react';
import * as Select from '@radix-ui/react-select';
import { clsx } from 'clsx';
import Icon from '../../utils/Icon';

interface SelectOption {
	value: string;
	label: string;
}

type OptionsType = SelectOption[] | Record<string, string>;

interface SelectInputProps {
	value: string;
	onChange: ( value: string ) => void;
	options?: OptionsType;
	disabled?: boolean | string[];
}

/**
 * Converts options object or array to array of SelectOption
 * @param options
 */
const normalizeOptions = ( options: OptionsType = []): SelectOption[] => {
	if ( Array.isArray( options ) ) {
		return options;
	}

	return Object.entries( options ).map( ([ value, label ]) => ({
		value,
		label: String( label )
	}) );
};

/**
 * Returns whether a specific option value is disabled.
 * If disabled is a boolean, all options follow that value.
 * If disabled is an array, only options whose value is in the array are disabled.
 */
const isOptionDisabled = ( disabled: boolean | string[], value: string ): boolean => {
	if ( Array.isArray( disabled ) ) {
		return disabled.includes( value );
	}
	return disabled;
};

/**
 * Styled select input component
 * @param  props - Props for the select component
 * @return {JSX.Element} The rendered select component
 */
const SelectInput = React.forwardRef<HTMLButtonElement, SelectInputProps>(
	({ disabled = false, value, onChange, options = [] }, ref ) => {
		const normalizedOptions = normalizeOptions( options );

		// Disable the entire root only when disabled is a boolean true, not when it's an array.
		const rootDisabled = true === disabled;

		return (
			<Select.Root
				disabled={rootDisabled}
				value={value}
				onValueChange={( value ) => onChange( value )}
			>
				<Select.Trigger
					ref={ref}
					disabled={rootDisabled}
					className={clsx(
						'inline-flex items-center justify-center gap-1 rounded bg-white text-base leading-none outline outline-gray-400 px-2 py-2 focus:shadow-[0_0_0_2px]',
						rootDisabled ?
							'opacity-50 cursor-not-allowed bg-gray-100' :
							'hover:bg-gray-100 cursor-pointer'
					)}
				>
					<Select.Value placeholder="Select an option…" />
					<Select.Icon className="text-base">
						<Icon
							name="chevron-down"
							color="black"
							size={16}
							tooltip=""
							className=""
						/>
					</Select.Icon>
				</Select.Trigger>

				<Select.Portal container={document.getElementById( 'modal-root' )}>
					<Select.Content
						className="bg-gray-100 text-black border border-gray-400 rounded-md shadow-lg ring-1 ring-black/5 z-[100] shadow-gray-400/50"
						position="item-aligned"
					>
						<Select.ScrollUpButton className="">
							<Icon
								name="chevron-up"
								color="black"
								size={16}
								tooltip=""
								className=""
							/>
						</Select.ScrollUpButton>
						<Select.Viewport className="">
							{normalizedOptions.map( ( option ) => (
								<SelectItem
									key={option.value}
									value={option.value}
									disabled={isOptionDisabled( disabled, option.value )}
								>
									{option.label}
								</SelectItem>
							) )}
						</Select.Viewport>
						<Select.ScrollDownButton className="text-base">
							<Icon
								name="chevron-down"
								color="white"
								size={16}
								tooltip=""
								className=""
							/>
						</Select.ScrollDownButton>
					</Select.Content>
				</Select.Portal>
			</Select.Root>
		);
	}
);

SelectInput.displayName = 'SelectInput';

export default SelectInput;

interface SelectItemProps
	extends React.ComponentPropsWithoutRef<typeof Select.Item> {
	children: React.ReactNode;
	className?: string;
}

/**
 * Styled select item component
 * @param  props - Props for the select item component
 * @return {JSX.Element} The rendered select item component
 */
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
	({ children, className, disabled, ...props }, ref ) => {
		return (
			<Select.Item
				ref={ref}
				disabled={disabled}
				className={clsx(
					'cursor-default px-2 py-2 text-base select-none flex items-center gap-1 flex-row overflow-hidden',
					disabled ?
						'opacity-50 cursor-not-allowed' :
						'hover:bg-gray-300 hover:text-black focus:bg-gray-300',
					'transition-all duration-200',
					className
				)}
				{...props}
			>
				<div className="w-4 flex items-center">
					<Select.ItemIndicator>
						<Icon
							name="check"
							color="black"
							size={16}
							tooltip=""
							className=""
						/>
					</Select.ItemIndicator>
				</div>
				<Select.ItemText>{children}</Select.ItemText>
				<div className="w-4 flex items-center"></div>
			</Select.Item>
		);
	}
);

SelectItem.displayName = 'SelectItem';
