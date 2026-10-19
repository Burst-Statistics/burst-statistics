import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import TextInput from '@/components/Inputs/TextInput';
import Icon from '@/utils/Icon';
import GoalPageInput from '@/components/Goals/GoalWizard/Fields/GoalPageInput';

interface ManualSelectorInputProps {
	goalId: number;
	goalType: string;
	selector: string;
	onChange: ( selector: string ) => void;

	// Page the typed selector is checked on, '' for the home page.
	page: string;
	onPageChange: ( page: string ) => void;

	// Whether the input is unfolded; it is opened from "Edit selector" too.
	isOpen: boolean;
	onToggle: ( isOpen: boolean ) => void;

	// Why the selector is invalid, if it is.
	error: string;
	isTesting: boolean;
}

/**
 * Folded away by default: type a CSS selector instead of picking the element.
 * Remount it (key) when the selector changes elsewhere, e.g. after a pick.
 *
 * @param {ManualSelectorInputProps} props           Component props.
 * @param {number}                   props.goalId       Goal id, for the input id.
 * @param {string}                   props.goalType     The goal type.
 * @param {string}                   props.selector     The current selector.
 * @param {Function}                 props.onChange     Called with the typed selector.
 * @param {string}                   props.page         The page the selector is checked on.
 * @param {Function}                 props.onPageChange Called with the chosen page.
 * @param {boolean}                  props.isOpen    Whether the input is unfolded.
 * @param {Function}                 props.onToggle  Called when it is unfolded or folded.
 * @param {string}                   props.error     The selector error, if any.
 * @param {boolean}                  props.isTesting Whether the selector is being counted.
 * @return {JSX.Element} The folded input.
 */
const ManualSelectorInput = ({ goalId, goalType, selector, onChange, page, onPageChange, isOpen, onToggle, error, isTesting }: ManualSelectorInputProps ): JSX.Element => {
	const inputRef = useRef<HTMLInputElement>( null );
	const inputId = `goal-${goalId}-selector`;

	// Local copy: the goals cache notifies asynchronously, which would drop fast keystrokes in a controlled input.
	const [ value, setValue ] = useState( selector );

	// Opened from "Edit selector": put the cursor in the field.
	useEffect( () => {
		if ( isOpen ) {
			inputRef.current?.focus();
		}
	}, [ isOpen ]);

	return (
		<details
			open={isOpen}
			onToggle={( e ) => onToggle( ( e.currentTarget as HTMLDetailsElement ).open )}
			className="group rounded-xl border border-dashed border-gray-300 px-5 py-4"
			data-tour="goal-field-selector-manual"
		>
			<summary className="flex cursor-pointer list-none items-center gap-2 text-base text-text-gray">
				<Icon name="chevron-right" size={16} color="gray" className="transition-transform group-open:rotate-90" />
				{__( 'I know the CSS selector, let me type it', 'burst-statistics' )}
			</summary>

			<div className="mt-4 flex flex-col gap-2">
				<label htmlFor={inputId} className="text-sm font-medium text-text-black">
					{__( 'CSS selector', 'burst-statistics' )}
				</label>
				<div className="relative">
					<TextInput
						ref={inputRef}
						id={inputId}
						value={value}
						placeholder=".buy-button"
						aria-invalid={!! error}
						onChange={( e ) => {
							setValue( e.target.value );
							onChange( e.target.value );
						}}
						className="w-full font-mono"
					/>
					{isTesting && (
						<div className="absolute right-3 top-1/2 -translate-y-1/2">
							<Icon name="loading" color="gray" />
						</div>
					)}
				</div>
				<p className="text-sm text-text-gray">
					{__( 'For example .buy-button, #signup-form or a[href*="checkout"].', 'burst-statistics' )}
				</p>
				{error && <p className="text-sm text-red">{error}</p>}

				{/* A typed selector is checked on this page; without it only the home page is searched. */}
				<GoalPageInput
					goalId={goalId}
					goalType={goalType}
					isDraft={false}
					page={page}
					label={__( 'Page it appears on', 'burst-statistics' )}
					onChange={onPageChange}
				/>
			</div>
		</details>
	);
};

export default ManualSelectorInput;
