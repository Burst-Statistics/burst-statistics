import { clsx } from 'clsx';
import getGoalChange from './getGoalChange';

interface GoalChangeProps {
	current: number;
	previous: number;
	className?: string;
}

/**
 * Change in conversions compared to the previous period, e.g. "↑ 24%".
 *
 * Nothing shows when there is no previous period to compare with.
 *
 * @param {GoalChangeProps} props           Component props.
 * @param {number}          props.current   Conversions in this period.
 * @param {number}          props.previous  Conversions in the previous period.
 * @param {string}          props.className Extra classes.
 * @return {JSX.Element | null} The change.
 */
const GoalChange = ({ current, previous, className = '' }: GoalChangeProps ): JSX.Element | null => {
	const change = getGoalChange( current, previous );
	if ( ! change ) {
		return null;
	}

	return (
		<span className={clsx( 'whitespace-nowrap text-sm', change.colorClassName, className )}>
			{change.label}
		</span>
	);
};

export default GoalChange;
