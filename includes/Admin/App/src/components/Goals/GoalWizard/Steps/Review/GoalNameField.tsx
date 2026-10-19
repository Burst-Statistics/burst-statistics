import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import TextInput from '@/components/Inputs/TextInput';
import type { Goal } from '@/components/Goals/goalHelpers';

/**
 * The goal's name, as the dashboard shows it. Saved with the goal.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being saved.
 * @return {JSX.Element} The name input.
 */
const GoalNameField = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();
	const inputId = `goal-${goal.id}-title`;

	// Local copy: the goals cache notifies asynchronously, which would drop fast keystrokes in a controlled input.
	const [ title, setTitle ] = useState( goal.title );

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={inputId} className="text-base font-semibold text-text-black">
				{__( 'Goal name', 'burst-statistics' )}
			</label>
			<TextInput
				id={inputId}
				value={title}
				placeholder={__( 'New goal', 'burst-statistics' )}
				onChange={( e ) => {
					setTitle( e.target.value );
					setGoalValue( goal.id, 'title', e.target.value );
				}}
			/>
			<p className="text-sm text-text-gray">
				{__( 'Shown in your dashboard.', 'burst-statistics' )}
			</p>
		</div>
	);
};

export default GoalNameField;
