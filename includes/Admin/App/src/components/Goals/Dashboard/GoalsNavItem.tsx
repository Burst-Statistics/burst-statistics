import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import GoalNotCountingLine from './GoalNotCountingLine';
import GoalsNavItemCount from './GoalsNavItemCount';
import { getNotCountingSince } from './goalHealth';
import { goalsNavLinkClassName } from './goalsNavLinkClassName';
import type { Goal } from '@/components/Goals/goalHelpers';
import type { GoalsOverviewGoal } from '@/types/api-endpoints';

interface GoalsNavItemProps {
	goal: Goal;
	stats?: GoalsOverviewGoal;
}

/**
 * One goal in the goals list: its name and conversions, with a warning line when it stopped counting. An inactive goal is greyed out and says so instead of a count.
 *
 * @param {GoalsNavItemProps} props       Component props.
 * @param {Goal}              props.goal  The goal.
 * @param {Object}            props.stats Its results in the period, undefined while loading.
 * @return {JSX.Element} The list item.
 */
const GoalsNavItem = ({ goal, stats }: GoalsNavItemProps ): JSX.Element => {
	const isInactive = 'active' !== goal.status;
	const notCountingSince = isInactive ? null : getNotCountingSince( stats );

	return (
		<Link
			to="/goals/$goalId"
			params={{ goalId: String( goal.id ) }}
			search={true}
			activeOptions={{ includeSearch: false }}
			data-tour="goals-nav-goal"
			title={goal.title}
			className={clsx( goalsNavLinkClassName, 'flex flex-col gap-1' )}
		>
			<span className="flex items-baseline gap-3">
				<span className={clsx( 'min-w-0 flex-1 truncate', isInactive ? 'font-normal text-text-gray-light' : 'font-medium' )}>{goal.title}</span>
				<GoalsNavItemCount isInactive={isInactive} conversions={stats?.conversions} />
			</span>
			{null !== notCountingSince && <GoalNotCountingLine since={notCountingSince} />}
		</Link>
	);
};

export default GoalsNavItem;
