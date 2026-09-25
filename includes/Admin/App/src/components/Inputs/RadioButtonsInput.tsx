import React, { forwardRef } from 'react';
import clsx from 'clsx';
import Icon from '@/utils/Icon';
import {__} from '@wordpress/i18n';
import ProBadge from '@/components/Common/ProBadge';
import useLicenseData from '@/hooks/useLicenseData';

export interface RadioOption {
	type: string;
	label: string;
	icon?: string;
	description?: string;
	disabled?: boolean;
	pro?: boolean | { url?: string; disabled?: boolean; [key: string]: unknown };
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
	onChange: ( value: string ) => void;

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
		{
			inputId,
			options,
			value,
			columns = 2,
			disabled = false,
			goalId,
			onChange,
			className = ''
		},
		ref
	) => {
		const { isTrial, isLicenseValid } = useLicenseData();

		// Construct the radio group name using goalId if provided.
		const name = goalId ? `${goalId}-${inputId}` : inputId;

		// Get the appropriate grid class based on columns
		const getGridClass = ( cols: number ): string => {
			switch ( cols ) {
				case 1:
					return 'grid-cols-1';
				case 2:
					return 'grid-cols-2';
				case 3:
					return 'grid-cols-3';
				case 4:
					return 'grid-cols-4';
				default:
					return 'grid-cols-2';
			}
		};

		return (
			<div
				className={clsx(
					'burst-radio-buttons__list grid gap-4',
					getGridClass( columns ),
					className
				)}
				ref={ref}
			>
				{/* fallow-ignore-next-line complexity */}
				{Object.keys( options ).map( ( key ) => {
					const option = options[key];
					const optionId = `${name}-${option.type}`;
					const isSelected = option.type === value;
					const isOptionDisabled = Boolean( disabled || option.disabled || ( option.pro && ! isLicenseValid ) );
					return (
						<div
							className="w-full h-full flex"
							key={optionId}
						>
							<input
								type="radio"
								checked={isSelected}
								name={name}
								id={optionId}
								value={option.type}
								disabled={isOptionDisabled}
								onChange={( e ) => {
									onChange( e.target.value );
								}}
								className="sr-only opacity-0 absolute"
							/>
							<label
								htmlFor={optionId}
								data-tour={`wizard-format-${option.type}`}
								className={clsx(
									'w-full h-full flex gap-3 items-center p-3.5 rounded-xl border-2 transition-all duration-200 select-none',
									'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
									isSelected ?
										'border-primary bg-primary-50' :
										'border-gray-200 bg-white hover:border-gray-300',
									isOptionDisabled ?
										'opacity-50 cursor-not-allowed' :
										'cursor-pointer'
								)}
							>
								{/* Custom styled radio button */}
								<div className="shrink-0 flex items-center justify-center">
									<div
										className={clsx(
											'w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
											isSelected ?
												'border-primary bg-primary' :
												'border-gray-400 bg-transparent'
										)}
									>
										{isSelected && (
											<div className="w-1.5 h-1.5 rounded-full bg-text-white" />
										)}
									</div>
								</div>

								{/* Content area */}
								<div className="flex items-center flex-row min-w-0 gap-2 flex-1">
									<div className="flex items-center gap-2">
										{
											option.icon && (
												<Icon
													name={option.icon}
													size={18}
													className={clsx(
														'shrink-0 transition-colors',
														isSelected ? 'text-primary' : 'text-text-gray'
													)}
												/>
											)
										}
										<h5
											className={clsx(
												'text-base font-medium transition-colors text-text-black',
												isSelected && 'font-semibold'
											)}
										>
											{option.label}
										</h5>
										{option.pro && (
											<ProBadge
												label={__( 'Pro', 'burst-statistics' )}
												id={'reporting'}
												url={'object' === typeof option.pro && option.pro?.url ? option.pro.url : undefined}
												type={isTrial ? 'icon' : 'badge'}
											/>
										)}
									</div>

									{option.description &&
										1 < option.description.length && (
											<>
												<div className="w-px bg-gray-300 mx-2 h-4 shrink-0" />
												<p
													className="text-sm transition-colors truncate text-text-gray"
												>
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
