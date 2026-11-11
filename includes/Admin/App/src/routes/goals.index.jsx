import { createFileRoute } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import GoalHeader from '@/components/Goals/Dashboard/GoalHeader';
import GoalsCompared from '@/components/Goals/Dashboard/GoalsCompared';
import GoalsEmptyState from '@/components/Goals/GoalsEmptyState';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';

export const Route = createFileRoute( '/goals/' )({
	component: AllGoals
});

/**
 * All goals together: their combined results, then the goals side by side.
 *
 * @return {JSX.Element} The all goals detail.
 */
function AllGoals() {
	const { goals, isLoading } = useGoalsData();
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const isLimitReached = useIsGoalLimitReached();

	if ( isLoading ) {
		return null;
	}

	if ( 0 === goals.length ) {
		return (
			<Block>
				<GoalsEmptyState onCreate={() => openWizard()} canCreate={! isLimitReached} />
			</Block>
		);
	}

	return (
		<>
			<ErrorBoundary>
				<GoalHeader />
			</ErrorBoundary>
			<ErrorBoundary>
				<GoalsCompared />
			</ErrorBoundary>
		</>
	);
}
