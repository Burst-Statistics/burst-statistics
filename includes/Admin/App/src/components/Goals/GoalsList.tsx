import { __ } from '@wordpress/i18n';
import GoalsTable from '@/components/Goals/GoalsTable';
import GoalsEmptyState from '@/components/Goals/GoalsEmptyState';
import GoalLimitNotice from '@/components/Goals/GoalLimitNotice';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalsListProps {
	goals: Goal[];
	isLoading: boolean;
	isLimitReached: boolean;
	toggleGoalStatus: ( id: number, status: string ) => Promise<unknown>;
	deleteGoal: ( id: number ) => Promise<unknown>;
	onCreate: () => void;
}

/**
 * The goals on the goals page: the table, or the empty state when there are none yet.
 *
 * @param {GoalsListProps} props                  Component props.
 * @param {Goal[]}         props.goals            All goals.
 * @param {boolean}        props.isLoading        Whether the goals are still loading.
 * @param {boolean}        props.isLimitReached   Whether no more goals can be activated.
 * @param {Function}       props.toggleGoalStatus Switches a goal on or off.
 * @param {Function}       props.deleteGoal       Deletes a goal.
 * @param {Function}       props.onCreate         Opens the wizard for a new goal.
 * @return {JSX.Element} The goals list.
 */
const GoalsList = ({ goals, isLoading, isLimitReached, toggleGoalStatus, deleteGoal, onCreate }: GoalsListProps ): JSX.Element => {
	const hasGoals = 0 < goals.length;

	return (
		<>
			{hasGoals && (
				<p className="text-base text-text-gray">
					{__( 'A goal only counts conversions while it is active. Open a goal to change what it tracks.', 'burst-statistics' )}
				</p>
			)}
			{isLimitReached && <GoalLimitNotice />}
			{hasGoals ? (
				<GoalsTable
					goals={goals}
					isLimitReached={isLimitReached}
					toggleGoalStatus={toggleGoalStatus}
					deleteGoal={deleteGoal}
				/>
			) : (
				! isLoading && <GoalsEmptyState onCreate={onCreate} canCreate={! isLimitReached} />
			)}
		</>
	);
};

export default GoalsList;
