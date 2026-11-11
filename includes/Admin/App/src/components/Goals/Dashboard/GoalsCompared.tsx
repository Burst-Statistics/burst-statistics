import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import useGoalsData from '@/hooks/useGoalsData';
import useGoalsOverview from '@/hooks/useGoalsOverview';
import { formatNumber, formatPercentage } from '@/utils/formatting';
import GoalChange from './GoalChange';
import { getNotCountingSince } from './goalHealth';
import type { Goal } from '@/components/Goals/goalHelpers';
import type { GoalsOverviewGoal } from '@/types/api-endpoints';

interface ComparedRow {
	goal: Goal;
	stats: GoalsOverviewGoal;
}

/**
 * Active goals with their results, most conversions first.
 *
 * @param {Goal[]}              goals All goals.
 * @param {GoalsOverviewGoal[]} stats Results per goal.
 * @return {ComparedRow[]} The rows.
 */
const getRows = ( goals: Goal[], stats: GoalsOverviewGoal[]): ComparedRow[] => {
	const statsById = new Map( stats.map( ( row ) => [ String( row.id ), row ]) );
	return goals
		.filter( ( goal ) => 'active' === goal.status && statsById.has( String( goal.id ) ) )
		.map( ( goal ) => ({ goal, stats: statsById.get( String( goal.id ) ) as GoalsOverviewGoal }) )
		.sort( ( a, b ) => b.stats.conversions - a.stats.conversions );
};

/**
 * All goals side by side: which goal brings the conversions. Each row opens the goal.
 *
 * @return {JSX.Element} The comparison block.
 */
const GoalsCompared = (): JSX.Element => {
	const { goals } = useGoalsData() as { goals: Goal[] };
	const { data: overview, isFetching } = useGoalsOverview();
	const rows = useMemo( () => getRows( goals, overview?.goals ?? []), [ goals, overview ]);
	const largest = Math.max( 1, ...rows.map( ( row ) => row.stats.conversions ) );

	return (
		<Block data-tour="goals-compared">
			<BlockHeading
				title={__( 'Goals compared', 'burst-statistics' )}
				className="border-b border-gray-200"
				isLoading={isFetching}
			/>
			<BlockContent className="px-0 py-2">
				<div role="table" aria-label={__( 'Goals compared', 'burst-statistics' )} className="flex flex-col">
					<div role="row" className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] @lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_5rem_5rem_5rem] items-center gap-3 px-2.5 md:px-6 py-2 text-sm text-text-gray">
						<span role="columnheader">{__( 'Goal', 'burst-statistics' )}</span>
						<span role="columnheader" aria-hidden="true" className="hidden @lg:block" />
						<span role="columnheader" className="text-right">{__( 'Conversions', 'burst-statistics' )}</span>
						<span role="columnheader" className="text-right">{__( 'Conv. rate', 'burst-statistics' )}</span>
						<span role="columnheader" className="text-right">{__( 'Change', 'burst-statistics' )}</span>
					</div>
					{rows.map( ({ goal, stats }) => (
						<Link
							key={goal.id}
							role="row"
							to="/goals/$goalId"
							params={{ goalId: String( goal.id ) }}
							search={true}
							className="grid min-h-11 grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] @lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_5rem_5rem_5rem] items-center gap-3 px-2.5 md:px-6 py-2 text-base hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden"
						>
							<span role="cell" className="truncate font-medium text-text-black">{goal.title}</span>
							<span role="cell" aria-hidden="true" className="hidden h-2 rounded-full bg-gray-100 @lg:block">
								<span
									className={clsx( 'block h-2 rounded-full', null !== getNotCountingSince( stats ) ? 'bg-yellow-500' : 'bg-primary' )}
									style={{ width: `${( stats.conversions / largest ) * 100}%` }}
								/>
							</span>
							<span role="cell" className="text-right font-semibold text-text-black">{formatNumber( stats.conversions )}</span>
							<span role="cell" className="text-right text-text-gray">{formatPercentage( stats.conversion_rate )}</span>
							<span role="cell" className="text-right">
								<GoalChange current={stats.conversions} previous={stats.conversions_previous} />
							</span>
						</Link>
					) )}
				</div>
			</BlockContent>
		</Block>
	);
};

export default GoalsCompared;
