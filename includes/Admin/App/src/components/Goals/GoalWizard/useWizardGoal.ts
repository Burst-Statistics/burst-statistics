import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import type { Goal } from '@/components/Goals/goalHelpers';

/**
 * The goal the wizard is editing, read from the goals query cache.
 *
 * @return {Goal | null} The goal, or null before it is created on the first step.
 */
const useWizardGoal = (): Goal | null => {
	const goalId = useGoalWizardStore( ( state ) => state.goalId );
	const { goals } = useGoalsData();

	if ( null === goalId ) {
		return null;
	}

	return ( goals as Goal[]).find( ( goal ) => goal.id === goalId ) ?? null;
};

export default useWizardGoal;
