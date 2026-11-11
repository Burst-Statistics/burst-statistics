import { __ } from '@wordpress/i18n';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { formatNumber } from '@/utils/formatting';
import { goalsNavLinkClassName } from './goalsNavLinkClassName';
import type { GoalsOverview } from '@/types/api-endpoints';

interface GoalsNavAllItemProps {
	totals?: GoalsOverview['totals'];
}

/**
 * First item of the goals list: all goals together.
 *
 * @param {GoalsNavAllItemProps} props        Component props.
 * @param {Object}               props.totals Totals in the period, undefined while loading.
 * @return {JSX.Element} The list item.
 */
const GoalsNavAllItem = ({ totals }: GoalsNavAllItemProps ): JSX.Element => (
	<Link
		to="/goals"
		search={true}
		activeOptions={{ exact: true, includeSearch: false }}
		className={clsx( goalsNavLinkClassName, 'flex items-baseline justify-between gap-3 hover:bg-gray-100' )}
	>
		<span className="font-semibold">{__( 'All goals', 'burst-statistics' )}</span>
		<span className="font-semibold tabular-nums text-text-black">{formatNumber( totals?.conversions ?? 0 )}</span>
	</Link>
);

export default GoalsNavAllItem;
