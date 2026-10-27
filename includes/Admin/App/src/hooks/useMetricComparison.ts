import useIsCommunitySharingEnabled from '@/hooks/useIsCommunitySharingEnabled';
import { getMetricComparison } from '@/utils/communityComparison';
import type {
	CommunityComparison,
	CommunityMetricKey,
	ComparisonFilters
} from '@/utils/communityComparison';

/**
 * Compares a block's metrics with the community.
 *
 * @param filters The filters of the block; a filtered view cannot be compared.
 * @return A function that returns the comparison for a metric, or null when the metric has no community benchmark.
 */
const useMetricComparison = ( filters: ComparisonFilters ) => {
	const isSharingEnabled = useIsCommunitySharingEnabled();

	return ( metricKey: CommunityMetricKey | undefined, value: number | undefined ): CommunityComparison | null => {
		if ( ! metricKey ) {
			return null;
		}

		return getMetricComparison(
			isSharingEnabled,
			window.burst_settings?.community_data,
			metricKey,
			Number( value ),
			filters
		);
	};
};

export default useMetricComparison;
