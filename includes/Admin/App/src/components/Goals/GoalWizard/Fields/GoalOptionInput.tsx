import FieldWrapper from '@/components/Fields/FieldWrapper';
import RadioButtonsInput from '@/components/Inputs/RadioButtonsInput';
import type { RadioOption } from '@/components/Inputs/RadioButtonsInput';

interface GoalOptionInputProps {

	// Which goal setting this picks, e.g. 'type'; names the radio group and its tour anchor.
	name: string;
	goalId: number;
	label: string;
	options: Record<string, RadioOption>;
	value: string;
	onChange: ( value: string ) => void;
}

/**
 * A goal setting picked from a few options: its type, scope or conversion metric.
 *
 * @param {GoalOptionInputProps} props          Component props.
 * @param {string}               props.name     The goal setting, e.g. 'type'.
 * @param {number}               props.goalId   Goal id, keeps the input id and radio names unique per goal.
 * @param {string}               props.label    The question shown above the options.
 * @param {Object}               props.options  The options, keyed by value.
 * @param {string}               props.value    The selected option.
 * @param {Function}             props.onChange Called with the newly selected option.
 * @return {JSX.Element} The option input.
 */
const GoalOptionInput = ({ name, goalId, label, options, value, onChange }: GoalOptionInputProps ): JSX.Element => {
	const inputId = `goal-${goalId}-${name}`;

	return (
		<div data-tour={`goal-field-${name}`}>
			<FieldWrapper label={label} inputId={inputId} className="!px-0">
				<RadioButtonsInput
					inputId={inputId}
					options={options}
					value={value}
					onChange={onChange}
				/>
			</FieldWrapper>
		</div>
	);
};

export default GoalOptionInput;
