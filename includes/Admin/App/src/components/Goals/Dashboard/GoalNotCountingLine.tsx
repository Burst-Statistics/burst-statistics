import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatUnixToDate } from '@/utils/formatting';

interface GoalNotCountingLineProps {

	// Unix timestamp of the goal's last conversion.
	since: number;
}

/**
 * Red line under a goal in the list: it stopped counting.
 *
 * @param {GoalNotCountingLineProps} props       Component props.
 * @param {number}                   props.since Time of the last conversion.
 * @return {JSX.Element} The warning line.
 */
const GoalNotCountingLine = ({ since }: GoalNotCountingLineProps ): JSX.Element => (
	<span className="flex items-center gap-1 text-sm font-normal text-red">
		<Icon name="warning" color="currentColor" size={14} />
		{sprintf(

			/* translators: %s: date of the goal's last conversion. */
			__( 'Not counting since %s', 'burst-statistics' ),
			formatUnixToDate( since )
		)}
	</span>
);

export default GoalNotCountingLine;
