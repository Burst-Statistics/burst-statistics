import { __, _n, sprintf } from '@wordpress/i18n';
import { AnimatePresence } from 'framer-motion';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import GoalsHeaderControls from '@/components/Goals/GoalsHeaderControls';
import GoalsList from '@/components/Goals/GoalsList';
import GoalWizard from '@/components/Goals/GoalWizard/GoalWizard';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import { isGoalCounting } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';

/**
 * Conclusion-first page title: how many goals are actually counting.
 *
 * @param {number} counting Number of goals counting conversions.
 * @param {number} total    Number of goals.
 * @return {string} The title.
 */
const getTitle = ( counting: number, total: number ): string => {
	if ( 0 === total ) {
		return __( 'Goals', 'burst-statistics' );
	}

	return sprintf(

		/* translators: 1: number of goals counting conversions, 2: total number of goals. */
		_n( '%1$d of %2$d goal is counting conversions', '%1$d of %2$d goals are counting conversions', total, 'burst-statistics' ),
		counting,
		total
	);
};

/**
 * The goals page: all goals in a table, with the wizard to create or edit one.
 *
 * @return {JSX.Element} The goals page.
 */
const GoalsPage = (): JSX.Element => {
	const {
		goals,
		activeGoalsCount,
		goalLimit,
		toggleGoalStatus,
		deleteGoal,
		isLoading
	} = useGoalsData();
	const isWizardOpen = useGoalWizardStore( ( state ) => state.isOpen );
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const isLimitReached = useIsGoalLimitReached();

	return (
		<>
			<Block className="col-span-12">
				<BlockHeading
					title={getTitle( ( goals as Goal[]).filter( isGoalCounting ).length, goals.length )}
					className="border-b border-gray-200"
					isLoading={isLoading}
					controls={
						<GoalsHeaderControls
							activeGoalsCount={activeGoalsCount}
							goalLimit={goalLimit}
							hasGoals={0 < goals.length}
							isLimitReached={isLimitReached}
							onCreate={() => openWizard()}
						/>
					}
				/>
				<BlockContent className="flex flex-col gap-4">
					<ErrorBoundary fallback={__( 'Could not load goals', 'burst-statistics' )}>
						<GoalsList
							goals={goals}
							isLoading={isLoading}
							isLimitReached={isLimitReached}
							toggleGoalStatus={toggleGoalStatus}
							deleteGoal={deleteGoal}
							onCreate={() => openWizard()}
						/>
					</ErrorBoundary>
				</BlockContent>
			</Block>

			<AnimatePresence>
				{isWizardOpen && <GoalWizard />}
			</AnimatePresence>
		</>
	);
};

export default GoalsPage;
