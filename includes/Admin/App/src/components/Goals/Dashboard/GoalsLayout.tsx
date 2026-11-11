import { useEffect } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/Common/PageHeader';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import GoalWizard from '@/components/Goals/GoalWizard/GoalWizard';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import GoalsNav from './GoalsNav';

/**
 * Opens a goal's page as soon as the wizard creates it, so the new goal is the one in view.
 */
const useOpenCreatedGoal = (): void => {
	const navigate = useNavigate();

	useEffect( () => useGoalWizardStore.subscribe( ( state, previous ) => {

		// Only a goal created in an open wizard: opening the wizard on an
		// existing goal sets the id while it opens, not while it is open.
		if ( ! previous.isOpen || null !== previous.goalId || null === state.goalId ) {
			return;
		}
		navigate({ to: '/goals/$goalId', params: { goalId: String( state.goalId ) }, search: true });
	}), [ navigate ]);
};

/**
 * Goals dashboard layout: the goals list on the left, the selected goal on the right.
 *
 * @return {JSX.Element} The layout.
 */
const GoalsLayout = (): JSX.Element => {
	const isWizardOpen = useGoalWizardStore( ( state ) => state.isOpen );
	useOpenCreatedGoal();

	return (
		<>
			<PageHeader showFilter={false} />

			<div className="col-span-12 flex flex-col @lg:col-span-4 @xl:col-span-3">
				<ErrorBoundary>
					<GoalsNav />
				</ErrorBoundary>
			</div>

			<div className="col-span-12 grid grid-cols-12 content-start gap-3 @lg:col-span-8 @lg:gap-5 @xl:col-span-9">
				<Outlet />
			</div>

			<AnimatePresence>
				{isWizardOpen && <GoalWizard />}
			</AnimatePresence>
		</>
	);
};

export default GoalsLayout;
