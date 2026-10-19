import { useCallback } from 'react';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';

/**
 * Close the wizard without saving.
 *
 * Unsaved edits live in the goals query cache (e.g. the review switch), so
 * the goals are refetched to drop them.
 *
 * @return {() => void} The close handler.
 */
const useCloseGoalWizard = (): ( () => void ) => {
	const closeWizard = useGoalWizardStore( ( state ) => state.closeWizard );
	const { invalidateGoals } = useGoalsData();

	return useCallback( () => {
		closeWizard();
		invalidateGoals();
	}, [ closeWizard, invalidateGoals ]);
};

export default useCloseGoalWizard;
