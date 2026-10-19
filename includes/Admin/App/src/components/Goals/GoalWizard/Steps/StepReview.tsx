import { isGoalComplete } from '@/components/Goals/goalHelpers';
import GoalLimitNotice from '@/components/Goals/GoalLimitNotice';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import useWizardGoal from '../useWizardGoal';
import GoalNameField from './Review/GoalNameField';
import GoalReviewRows from './Review/GoalReviewRows';
import GoalAdvancedSettings from './Review/GoalAdvancedSettings';
import GoalUnfinishedNotice from './Review/GoalUnfinishedNotice';

/**
 * Last step: name the goal, check what it counts, then save it as a draft or start tracking.
 *
 * @return {JSX.Element | null} The review step.
 */
const StepReview = (): JSX.Element | null => {
	const goal = useWizardGoal();
	const isLimitReached = useIsGoalLimitReached();

	if ( ! goal ) {
		return null;
	}

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			<GoalNameField goal={goal} />

			{isGoalComplete( goal ) ? <GoalReviewRows goal={goal} /> : <GoalUnfinishedNotice />}

			<GoalAdvancedSettings goal={goal} />

			{/* Starting a paused goal needs room under the free active goal limit. */}
			{isLimitReached && 'active' !== goal.status && <GoalLimitNotice />}
		</div>
	);
};

export default StepReview;
