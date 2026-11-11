import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { useParams } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import useGoalsData from '@/hooks/useGoalsData';
import useGoalsOverview from '@/hooks/useGoalsOverview';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import GoalsHeaderControls from '@/components/Goals/GoalsHeaderControls';
import GoalLimitNotice from '@/components/Goals/GoalLimitNotice';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import GoalsNavAllItem from './GoalsNavAllItem';
import GoalsNavGroup from './GoalsNavGroup';
import { groupGoalsByType } from './groupGoalsByType';
import type { Goal } from '@/components/Goals/goalHelpers';

/**
 * Active goals first, inactive goals after them; the order within each stays as created.
 *
 * @param {Goal[]} goals All goals.
 * @return {Goal[]} The sorted goals.
 */
const sortActiveFirst = ( goals: Goal[]): Goal[] =>
	[ ...goals ].sort( ( a, b ) => Number( 'active' !== a.status ) - Number( 'active' !== b.status ) );

/**
 * Left column of the goals dashboard: all goals together, then every goal grouped by type, inactive goals last in their group.
 *
 * @return {JSX.Element} The goals list.
 */
const GoalsNav = (): JSX.Element => {
	const { goals, activeGoalsCount, goalLimit, isLoading } = useGoalsData() as {
		goals: Goal[];
		activeGoalsCount: number;
		goalLimit: number;
		isLoading: boolean;
	};
	const { data: overview } = useGoalsOverview();
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const isLimitReached = useIsGoalLimitReached();
	const { goalId } = useParams({ strict: false }) as { goalId?: string };
	const statsById = useMemo(
		() => new Map( ( overview?.goals ?? []).map( ( stats ) => [ String( stats.id ), stats ]) ),
		[ overview ]
	);
	const groups = useMemo( () => groupGoalsByType( sortActiveFirst( goals ) ), [ goals ]);
	const hasGoals = 0 < goals.length;

	return (
		<Block>
			<BlockHeading
				title={__( 'Goals', 'burst-statistics' )}
				isLoading={isLoading}
				controls={
					<GoalsHeaderControls
						activeGoalsCount={activeGoalsCount}
						goalLimit={goalLimit}
						isLimitReached={isLimitReached}
						isGoalSelected={ !! goalId }
						onCreate={() => openWizard()}
					/>
				}
			/>
			{isLimitReached && (
				<div className="px-2.5 pb-4 md:px-6">
					<GoalLimitNotice />
				</div>
			)}
			{hasGoals && (
				<BlockContent className="py-0">
					<nav aria-label={__( 'Goals', 'burst-statistics' )} data-tour="goals-list-table" className="flex flex-col">
						<GoalsNavAllItem totals={overview?.totals} />
						{groups.map( ( group ) => (
							<GoalsNavGroup key={group.type} type={group.type} goals={group.goals} statsById={statsById} />
						) )}
						<div className="h-5" />
					</nav>
				</BlockContent>
			)}
		</Block>
	);
};

export default GoalsNav;
