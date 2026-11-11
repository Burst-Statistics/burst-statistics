import { formatPercentage, getChangePercentage } from '@/utils/formatting';

interface GoalChangeDisplay {
	label: string;
	colorClassName: string;
}

/**
 * Label and colour of the change in conversions against the previous period.
 *
 * @param {number} current  Conversions in this period.
 * @param {number} previous Conversions in the previous period.
 * @return {GoalChangeDisplay | null} The change, null without a previous period to compare with.
 */
const getGoalChange = ( current: number, previous: number ): GoalChangeDisplay | null => {
	if ( 0 === previous ) {
		return null;
	}

	if ( current === previous ) {
		return { label: formatPercentage( 0, 0 ), colorClassName: 'text-text-gray' };
	}

	const change = getChangePercentage( current, previous );
	return { label: change.val, colorClassName: 'positive' === change.status ? 'text-green' : 'text-red' };
};

export default getGoalChange;
