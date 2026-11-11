import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import SwitchInput from '@/components/Inputs/SwitchInput';
import Tooltip from '@/components/Common/Tooltip';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalStatusSwitchProps {
	goal: Goal;
	isLimitReached: boolean;
	toggleGoalStatus: ( id: number, status: string ) => Promise<unknown>;
}

/**
 * Switch that activates or pauses a finished goal, with its current status.
 *
 * @param {Object}   props                  Component props.
 * @param {Goal}     props.goal             The goal.
 * @param {boolean}  props.isLimitReached   Whether the free active goal limit is reached.
 * @param {Function} props.toggleGoalStatus Persists the new status.
 * @return {JSX.Element} The switch.
 */
const GoalStatusSwitch = ({ goal, isLimitReached, toggleGoalStatus }: GoalStatusSwitchProps ): JSX.Element => {
	const [ isToggling, setIsToggling ] = useState( false );
	const isActive = 'active' === goal.status;

	const handleToggle = async( value: boolean ) => {
		setIsToggling( true );
		try {
			await toggleGoalStatus( goal.id, value ? 'active' : 'inactive' );
		} finally {
			setIsToggling( false );
		}
	};

	return (
		<Tooltip content={isActive ?
			__( 'This goal is counting conversions. Toggle to pause.', 'burst-statistics' ) :
			__( 'This goal is paused. Toggle to start counting conversions.', 'burst-statistics' )
		}>
			<div className="flex items-center gap-2">
				<p className="text-sm font-medium text-text-gray">{isActive ? __( 'Active', 'burst-statistics' ) : __( 'Inactive', 'burst-statistics' )}</p>
				<SwitchInput
					size="small"
					value={isActive}
					disabled={isToggling || ( isLimitReached && ! isActive )}
					onChange={handleToggle}
				/>
			</div>
		</Tooltip>
	);
};

export default GoalStatusSwitch;
