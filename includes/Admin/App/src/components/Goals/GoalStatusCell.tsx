import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import SwitchInput from '@/components/Inputs/SwitchInput';
import Tooltip from '@/components/Common/Tooltip';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP, isGoalComplete } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalStatusCellProps {
	goal: Goal;
	isLimitReached: boolean;
	toggleGoalStatus: ( id: number, status: string ) => Promise<unknown>;
}

/**
 * Status cell: activate switch for finished goals, a setup prompt otherwise.
 *
 * @param {Object}   props                  Component props.
 * @param {Goal}     props.goal             The goal.
 * @param {boolean}  props.isLimitReached   Whether the free active goal limit is reached.
 * @param {Function} props.toggleGoalStatus Persists the new status.
 * @return {JSX.Element} The status cell.
 */
const GoalStatusCell = ({ goal, isLimitReached, toggleGoalStatus }: GoalStatusCellProps ): JSX.Element => {
	const [ isToggling, setIsToggling ] = useState( false );
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const isActive = 'active' === goal.status;

	if ( ! isGoalComplete( goal ) ) {
		return (
			<button
				type="button"
				className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-yellow-50 text-text-black cursor-pointer hover:underline"
				onClick={() => openWizard( goal.id, GOAL_STEP.TARGET )}
			>
				{__( 'Needs setup', 'burst-statistics' )}
			</button>
		);
	}

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
			<div>
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

export default GoalStatusCell;
