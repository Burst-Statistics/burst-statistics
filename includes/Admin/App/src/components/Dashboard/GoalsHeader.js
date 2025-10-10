import React from 'react';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';
import SelectInput from '@/components/Inputs/SelectInput'

/**
 * GoalsHeader component to display and select goals.
 *
 * @param {Object} props - The component props.
 * @param {Array} props.goals - Array of goal objects.
 * @param {string|number} props.goalId - Currently selected goal ID.
 * @param {Function} props.setGoalId - Function to update the selected goal ID.
 *
 * @returns {JSX.Element|null} The rendered GoalsHeader component or null if no goals.
 */
const GoalsHeader = ( { goals, goalId, setGoalId } ) => {

	// if goalValues is an empty array, return null.
	if ( 0 === goals.length ) {
		return <Icon name='loading' />;
	}

	/**
	 * Handle change event for goal selection.
	 *
	 * @param {string} value - The change event object.
	 *
	 * @returns {void}
	 */
	const handleChange = ( value ) => {
		setGoalId( value );
	};

	const options = goals.map( ( goal ) => {
		return { value: goal.id, label: goal && 'string' === typeof goal.title ? goal.title : __( 'Untitled goal', 'burst-statistics' ) };
	} );

	return (
		<div className="flex items-center gap-2.5">
			{
				1 === goals.length && goals[0] &&
				<p>{ goals[0].title }</p>
			}

			{
				1 < goals.length &&
				<SelectInput
					value={ goalId }
					onChange={ ( value ) => handleChange( value ) }
					options={ options }
				/>
			}
    </div>
	);
};

export default GoalsHeader;
