import { __ } from '@wordpress/i18n';
import CommunityComparisonIndicator from '@/components/Common/CommunityComparisonIndicator';
import useFilters from '@/hooks/useFilters';
import useIsCommunitySharingEnabled from '@/hooks/useIsCommunitySharingEnabled';
import { getPageWeightComparison } from '@/utils/communityComparison';
import { formatFileSize } from '@/utils/formatting';
import Co2PerPageviewLabel from './Co2PerPageviewLabel';
import WeightTrendBadge from './WeightTrendBadge';
import type { PageWeightData } from './usePageWeightData';

type PageWeightSummaryProps = {

	/** Average measured weight carried by one pageview, in bytes. */
	avgBytes: number;

	/** Estimated emissions of one measured pageview, in grams CO2e. */
	co2PerPageview: number;

	/** The like-for-like comparison with the preceding period, or null when unknown. */
	trend: PageWeightData['weight_trend'];
};

/**
 * The headline figure: average page weight, its CO2 per pageview, how it
 * moved, and how it compares with similar websites.
 *
 * @param {PageWeightSummaryProps} props - Component props.
 * @return {JSX.Element} The headline row.
 */
const PageWeightSummary = ({ avgBytes, co2PerPageview, trend }: PageWeightSummaryProps ) => {
	const { getActiveFilters } = useFilters();
	const communityComparison = getPageWeightComparison(
		useIsCommunitySharingEnabled(),
		window.burst_settings?.community_data,
		avgBytes,
		co2PerPageview,
		getActiveFilters()
	);

	return (
		<div className="flex flex-wrap items-baseline gap-2 px-5 pb-3">
			<span className="text-3xl font-bold text-text-black">
				{ formatFileSize( avgBytes ) }
			</span>
			<Co2PerPageviewLabel grams={ co2PerPageview } />
			<span className="text-sm text-text-gray">
				{ __( 'avg. per pageview', 'burst-statistics' ) }
			</span>
			<WeightTrendBadge trend={ trend } />
			<span className="self-center">
				<CommunityComparisonIndicator comparison={ communityComparison } />
			</span>
		</div>
	);
};

export default PageWeightSummary;
