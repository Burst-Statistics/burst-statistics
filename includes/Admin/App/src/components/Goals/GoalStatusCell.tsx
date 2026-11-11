import GoalNeedsSetupButton from '@/components/Goals/GoalNeedsSetupButton';
import GoalStatusSwitch from '@/components/Goals/GoalStatusSwitch';
import { getGoalTrackingBlocker, isGoalComplete } from '@/components/Goals/goalHelpers';
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
	if ( ! isGoalComplete( goal ) ) {
		return <GoalNeedsSetupButton goalId={goal.id} />;
	}

	const blocker = getGoalTrackingBlocker( goal );
	if ( blocker ) {
		return <GoalNeedsSetupButton goalId={goal.id} label={blocker.label} />;
	}

	return <GoalStatusSwitch goal={goal} isLimitReached={isLimitReached} toggleGoalStatus={toggleGoalStatus} />;
};

export default GoalStatusCell;
