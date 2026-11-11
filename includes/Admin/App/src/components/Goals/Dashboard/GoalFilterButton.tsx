import { __ } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';
import IconButton from '@/components/Inputs/IconButton';
import useFilterByGoal from '@/hooks/useFilterByGoal';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalFilterButtonProps {
	goal: Goal;
}

/**
 * Round filter icon button in the goal header. Opens Insights filtered by the goal.
 *
 * @param {GoalFilterButtonProps} props      Component props.
 * @param {Goal}                  props.goal The goal.
 * @return {JSX.Element} The button.
 */
const GoalFilterButton = ({ goal }: GoalFilterButtonProps ): JSX.Element => {
	const filterByGoal = useFilterByGoal();
	const label = `${ __( 'Click to filter by:', 'burst-statistics' ) } ${ goal.title }`;

	// The tooltip trigger passes its own aria-label to the button; only this prop overrides it, ariaLabel does not.
	return (
		<HelpTooltip content={label} asChild>
			<IconButton
				icon="filter"
				variant="tertiary"
				size="md"
				aria-label={label}
				data-tour="goal-click-filter"
				onClick={() => filterByGoal( goal.id )}
			/>
		</HelpTooltip>
	);
};

export default GoalFilterButton;
