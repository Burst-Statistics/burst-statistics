import { __ } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';
import { getWeightChange } from './pageWeightFormat';
import type { PageWeightData } from './usePageWeightData';

type WeightTrendBadgeProps = {

	/** The like-for-like comparison with the preceding period, or null when unknown. */
	trend: PageWeightData['weight_trend'];
};

/**
 * The change in average weight against the previous period.
 *
 * @param {WeightTrendBadgeProps} props - Component props.
 * @return {JSX.Element|null} The badge, or null when there is nothing to compare.
 */
const WeightTrendBadge = ({ trend }: WeightTrendBadgeProps ) => {
	const change = trend ? getWeightChange( trend.current_avg_bytes, trend.previous_avg_bytes ) : null;

	if ( ! change ) {
		return null;
	}

	return (
		<HelpTooltip
			content={__( 'Change against the previous period, compared over the pages that were already measured in both periods. Pages first measured this period are left out, so growing coverage does not read as a change in weight — which is why this percentage can point the other way than the average shown here.', 'burst-statistics' )}
			side="top"
		>
			<span className={`cursor-help text-sm font-medium ${ change.isImprovement ? 'text-green' : 'text-red' }`}>
				{ change.label }
			</span>
		</HelpTooltip>
	);
};

export default WeightTrendBadge;
