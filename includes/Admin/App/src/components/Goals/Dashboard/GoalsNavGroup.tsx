import Icon from '@/utils/Icon';
import { getGoalTypeIcon, getGoalTypeLabel } from '@/components/Goals/goalOptions';
import GoalsNavItem from './GoalsNavItem';
import type { Goal } from '@/components/Goals/goalHelpers';
import type { GoalsOverviewGoal } from '@/types/api-endpoints';

interface GoalsNavGroupProps {
	type: string;
	goals: Goal[];
	statsById: Map<string, GoalsOverviewGoal>;
}

/**
 * Goals of one type in the goals list, under a heading with the type's icon.
 *
 * @param {GoalsNavGroupProps} props           Component props.
 * @param {string}             props.type      The goal type.
 * @param {Goal[]}             props.goals     The goals of this type.
 * @param {Map}                props.statsById Results per goal id.
 * @return {JSX.Element} The group.
 */
const GoalsNavGroup = ({ type, goals, statsById }: GoalsNavGroupProps ): JSX.Element => (
	<section className="pt-8">
		<h3 className="flex items-center gap-2 pb-2 text-sm font-semibold text-text-gray">
			<span aria-hidden="true" className="flex">
				<Icon name={getGoalTypeIcon( type )} color="currentColor" size={14} />
			</span>
			<span className="font-normal">{getGoalTypeLabel( type )}</span>
			<span className="font-normal text-text-gray-light">{goals.length}</span>
		</h3>
		<ul className="flex flex-col gap-0.5">
			{goals.map( ( goal ) => (
				<li key={goal.id}>
					<GoalsNavItem goal={goal} stats={statsById.get( String( goal.id ) )} />
				</li>
			) )}
		</ul>
	</section>
);

export default GoalsNavGroup;
