import { __ } from '@wordpress/i18n';
import { getMetricComparison } from '@/utils/communityComparison';
import { formatPercentage } from '@/utils/formatting';
import CommunityComparisonIndicator from '@/components/Common/CommunityComparisonIndicator';
import type { BurstCommunityData } from '@/types/burst-settings';

// Made-up community data for the example. It runs through the same comparison as the dashboard.
const EXAMPLE_COMMUNITY_DATA: BurstCommunityData = {
	range: { min: 1001, max: 5000 },
	sample_size: 1500,
	bounce_rate: {
		percentiles: { p5: 22, p10: 28, p25: 36, p50: 45, p75: 55, p90: 64, p95: 70 },
		average: 46
	}
};
const EXAMPLE_BOUNCE_RATE = 34;

/**
 * A static example of the comparison the dashboard shows once data sharing is on.
 *
 * @return The example card with the indicator and its explanation.
 */
const CommunityComparisonExample = () => {
	const comparison = getMetricComparison( true, EXAMPLE_COMMUNITY_DATA, 'bounce_rate', EXAMPLE_BOUNCE_RATE );

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4" data-testid="community-comparison-example">
			<span className="text-xs font-medium uppercase tracking-wide text-text-gray-light">
				{ __( 'Example', 'burst-statistics' ) }
			</span>
			<div className="flex items-center justify-between gap-3">
				<span className="text-base font-semibold text-text-black">
					{ __( 'Bounce rate', 'burst-statistics' ) }
				</span>
				<span className="flex items-center gap-1.5 text-xl font-bold text-text-black">
					<CommunityComparisonIndicator comparison={ comparison } />
					{ formatPercentage( EXAMPLE_BOUNCE_RATE, 0 ) }
				</span>
			</div>
			<p className="text-sm text-text-gray">{ comparison.text }</p>
		</div>
	);
};

export default CommunityComparisonExample;
