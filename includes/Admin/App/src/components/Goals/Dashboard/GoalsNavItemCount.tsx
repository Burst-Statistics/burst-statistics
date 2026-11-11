import { __ } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';

interface GoalsNavItemCountProps {
	isInactive: boolean;

	// Undefined while loading.
	conversions?: number;
}

/**
 * Right side of a goal in the goals list: its conversions, or that it is inactive.
 *
 * @param {GoalsNavItemCountProps} props             Component props.
 * @param {boolean}                props.isInactive  Whether the goal is inactive.
 * @param {number}                 props.conversions Its conversions in the period.
 * @return {JSX.Element} The count.
 */
const GoalsNavItemCount = ({ isInactive, conversions = 0 }: GoalsNavItemCountProps ): JSX.Element => (
	isInactive ? (
		<span className="shrink-0 text-sm font-normal text-text-gray-light">{__( 'Inactive', 'burst-statistics' )}</span>
	) : (
		<span className="shrink-0 font-semibold tabular-nums text-text-black">{formatNumber( conversions )}</span>
	)
);

export default GoalsNavItemCount;
