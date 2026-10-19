import { useState } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import TextInput from '@/components/Inputs/TextInput';

interface GoalHookInputProps {
	goalId: number;
	hook: string;
	label: string;
	help?: string;
	onChange: ( hook: string ) => void;
}

/**
 * The WordPress action a hook goal counts.
 *
 * @param {GoalHookInputProps} props          Component props.
 * @param {number}             props.goalId   Goal id, for the input id.
 * @param {string}             props.hook     The current hook name.
 * @param {string}             props.label    The question shown above the input.
 * @param {string}             props.help     Optional help text, shown under the input.
 * @param {Function}           props.onChange Called with the new hook name.
 * @return {JSX.Element} The hook input.
 */
const GoalHookInput = ({ goalId, hook, label, help, onChange }: GoalHookInputProps ): JSX.Element => {
	const inputId = `goal-${goalId}-hook`;

	// Local copy: the goals cache notifies asynchronously, which would drop fast keystrokes in a controlled input.
	const [ value, setValue ] = useState( hook );

	return (
		<div data-tour="goal-field-hook">
			<FieldWrapper label={label} inputId={inputId} className="!px-0">
				<TextInput
					id={inputId}
					value={value}
					onChange={( e ) => {
						setValue( e.target.value );
						onChange( e.target.value );
					}}
					className="w-full font-mono"
				/>
				{help && <p className="mt-2 text-sm text-text-gray">{help}</p>}
			</FieldWrapper>
		</div>
	);
};

export default GoalHookInput;
