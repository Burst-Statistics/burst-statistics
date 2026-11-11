import { __, _n, sprintf } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import { getTracksText } from '@/components/Goals/goalText';
import { getGoalTypeLabel } from '@/components/Goals/goalOptions';
import { getGoalKind } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalHeaderTitleProps {

	// The selected goal; undefined for all goals.
	goal?: Goal;
}

/**
 * Title of the goal header: name, type and what a single goal tracks, or how many
 * active goals are combined.
 *
 * @param {GoalHeaderTitleProps} props      Component props.
 * @param {Goal}                 props.goal The selected goal, undefined for all goals.
 * @return {JSX.Element} The title.
 */
const GoalHeaderTitle = ({ goal }: GoalHeaderTitleProps ): JSX.Element => {
	const { activeGoalsCount } = useGoalsData() as { activeGoalsCount: number };

	if ( goal ) {
		return (
			<span className="flex flex-col min-w-0 flex-wrap">
				<span className="truncate text-sm font-normal tracking-normal text-text-gray">
					{getGoalTypeLabel( getGoalKind( goal ) )} · {getTracksText( goal )}
				</span>
				<div className="flex items-center gap-x-2">
					<span className="truncate">{goal.title}</span>
				</div>
			</span>
		);
	}

	return (
		<span className="flex flex-col flex-wrap items-baseline gap-x-2">
			<span className="text-sm font-normal text-text-gray">
				{sprintf(

					/* translators: %d: number of active goals. */
					_n( '%d active goal combined', '%d active goals combined', activeGoalsCount, 'burst-statistics' ),
					activeGoalsCount
				)}
			</span>
			<span>{__( 'All goals', 'burst-statistics' )}</span>
		</span>
	);
};

export default GoalHeaderTitle;
