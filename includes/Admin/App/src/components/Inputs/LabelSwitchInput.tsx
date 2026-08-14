import { forwardRef } from 'react';
import clsx from 'clsx';

interface LabelSwitchInputProps {

	/** Whether the switch is in the "on" (right) state. */
	value: boolean;

	/** Callback when the state changes, receives the new boolean value. */
	onChange: ( checked: boolean ) => void;

	/** Label for the "off" (left) state, e.g. "is". */
	leftLabel: string;

	/** Label for the "on" (right) state, e.g. "is not". */
	rightLabel: string;

	disabled?: boolean;
	className?: string;
}

/**
 * Active segment styles matching the TabsTrigger green variant.
 */
const activeClasses = [
	'data-[active="true"]:bg-green-50',
	'data-[active="true"]:border-green',
	'data-[active="true"]:text-green'
] as const;

/**
 * LabelSwitchInput component.
 *
 * A two-state switch styled like `TabsList` / `TabsTrigger` (gray track with
 * white segments and a green active accent) so both states stay visible as
 * clickable labels.
 */
const LabelSwitchInput = forwardRef<HTMLDivElement, LabelSwitchInputProps>(
	(
		{
			value,
			onChange,
			leftLabel,
			rightLabel,
			disabled = false,
			className = ''
		},
		ref
	) => {

		/**
		 * Builds the shared classes for a single segment button.
		 *
		 * @return The class list for the segment button.
		 */
		const getSegmentClasses = () => clsx(
			'text-base px-4 py-1 transition-colors rounded-sm bg-white focus:outline-hidden text-text-gray-light hover:text-text-gray font-medium border border-transparent whitespace-nowrap shrink-0',
			activeClasses,
			{
				'cursor-not-allowed opacity-50': disabled,
				'cursor-pointer': ! disabled
			}
		);

		return (
			<div
				ref={ref}
				className={clsx(
					'inline-flex shrink-0 gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shadow-sm',
					className
				)}
			>
				<button
					type="button"
					role="switch"
					aria-checked={! value}
					disabled={disabled}
					onClick={() => onChange( false )}
					data-active={! value || undefined}
					className={getSegmentClasses()}
				>
					{leftLabel}
				</button>
				<button
					type="button"
					role="switch"
					aria-checked={value}
					disabled={disabled}
					onClick={() => onChange( true )}
					data-active={value || undefined}
					className={getSegmentClasses()}
				>
					{rightLabel}
				</button>
			</div>
		);
	}
);

LabelSwitchInput.displayName = 'LabelSwitchInput';

export default LabelSwitchInput;
