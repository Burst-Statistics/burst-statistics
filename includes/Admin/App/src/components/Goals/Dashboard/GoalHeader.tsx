import { useMemo } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import useGoalsData from '@/hooks/useGoalsData';
import useGoalsOverview from '@/hooks/useGoalsOverview';
import GoalHeaderControls from './GoalHeaderControls';
import GoalHeaderTitle from './GoalHeaderTitle';
import GoalHeadline from './GoalHeadline';
import GoalHealthNotice from './GoalHealthNotice';
import GoalKpis from './GoalKpis';
import GoalTrendChart from './GoalTrendChart';
import { getLeadingGoal } from './getGoalDetailTitle';
import { getNotCountingSince } from './goalHealth';
import type { Goal } from '@/components/Goals/goalHelpers';
import type { GoalsOverview } from '@/types/api-endpoints';

interface GoalHeaderProps {

	// The selected goal; undefined for all goals.
	goal?: Goal;
}

interface GoalNumbers {
	conversions: number;
	conversionsPrevious: number;
	convertingVisitors: number;
	conversionRate: number;
	notCountingSince: number | null;
	leadingGoal: string;
}

const EMPTY_NUMBERS: GoalNumbers = {
	conversions: 0,
	conversionsPrevious: 0,
	convertingVisitors: 0,
	conversionRate: 0,
	notCountingSince: null,
	leadingGoal: ''
};

/**
 * The numbers the header shows: of one goal, or of all active goals together.
 *
 * @param {GoalsOverview | undefined} overview Results of every goal.
 * @param {Goal[]}                    goals    All goals.
 * @param {Goal | undefined}          goal     The selected goal, undefined for all goals.
 * @return {GoalNumbers} The numbers.
 */
const getGoalNumbers = ( overview: GoalsOverview | undefined, goals: Goal[], goal?: Goal ): GoalNumbers => {
	if ( ! overview ) {
		return EMPTY_NUMBERS;
	}

	if ( goal ) {
		const stats = overview.goals.find( ( row ) => String( row.id ) === String( goal.id ) );
		return stats ? {
			...EMPTY_NUMBERS,
			conversions: stats.conversions,
			conversionsPrevious: stats.conversions_previous,
			convertingVisitors: stats.converting_visitors,
			conversionRate: stats.conversion_rate,
			notCountingSince: getNotCountingSince( stats )
		} : EMPTY_NUMBERS;
	}

	const titles = new Map( goals.filter( ( g ) => 'active' === g.status ).map( ( g ) => [ String( g.id ), g.title ]) );
	const leadingGoal = getLeadingGoal(
		overview.goals
			.filter( ( row ) => titles.has( String( row.id ) ) )
			.map( ( row ) => ({ title: titles.get( String( row.id ) ) ?? '', conversions: row.conversions, conversionsPrevious: row.conversions_previous }) )
	);

	return {
		conversions: overview.totals.conversions,
		conversionsPrevious: overview.totals.conversions_previous,
		convertingVisitors: overview.totals.converting_visitors,
		conversionRate: overview.totals.conversion_rate,
		notCountingSince: null,
		leadingGoal
	};
};

/**
 * Header card of the goals dashboard: what happened to conversions, the numbers
 * behind it and the trend, for one goal or for all goals.
 *
 * @param {GoalHeaderProps} props      Component props.
 * @param {Goal}            props.goal The selected goal, undefined for all goals.
 * @return {JSX.Element} The header card.
 */
const GoalHeader = ({ goal }: GoalHeaderProps ): JSX.Element => {
	const { goals } = useGoalsData() as { goals: Goal[] };
	const { data: overview, isFetching } = useGoalsOverview();
	const numbers = useMemo( () => getGoalNumbers( overview, goals, goal ), [ overview, goals, goal ]);

	return (
		<Block data-tour="goal-header">
			<BlockHeading
				title={<GoalHeaderTitle goal={goal} />}
				isLoading={isFetching}
				controls={goal && <GoalHeaderControls goal={goal} />}
			/>
			<BlockContent className="flex flex-col gap-6 pt-2">
				<GoalHeadline isLoaded={Boolean( overview )} numbers={numbers} />
				{goal && null !== numbers.notCountingSince && (
					<GoalHealthNotice goalId={goal.id} since={numbers.notCountingSince} />
				)}
				<GoalKpis
					conversions={numbers.conversions}
					conversionsPrevious={numbers.conversionsPrevious}
					convertingVisitors={numbers.convertingVisitors}
					conversionRate={numbers.conversionRate}
				/>
				<GoalTrendChart goalId={goal ? String( goal.id ) : 'all'} />
			</BlockContent>
		</Block>
	);
};

export default GoalHeader;
