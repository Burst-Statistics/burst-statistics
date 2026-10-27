import { useQuery } from '@tanstack/react-query';
import getInsightsData from '@/api/getInsightsData';
import type { InsightsData } from '@/types/insights-api';
import { DEFAULT_INSIGHTS_PLACEHOLDER_DATA } from '@/utils/insightsPlaceholders';

export interface UseInsightsDataOptions {
	startDate: string;
	endDate: string;
	range?: string;
	metrics: string[];
	groupBy?: string;
	compareMode?: string;
	filters?: Record<string, unknown>;
	enabled?: boolean;
}

/**
 * React Query hook for fetching insights chart dataset.
 *
 * @param {UseInsightsDataOptions} options - Query configuration.
 * @return React Query result containing InsightsData.
 */
export function useInsightsData({
	startDate,
	endDate,
	range,
	metrics,
	groupBy = 'auto',
	compareMode,
	filters = {},
	enabled = true
}: UseInsightsDataOptions ) {
	const isSingleMetric = 1 === metrics.length;
	const args = {
		filters,
		metrics,
		group_by: groupBy,
		...( isSingleMetric && compareMode ? { compare_mode: compareMode } : {})
	};

	return useQuery<InsightsData>({
		queryKey: [ 'insights', metrics, startDate, endDate, compareMode, groupBy, args ],
		queryFn: () => getInsightsData({ startDate, endDate, range: range ?? '', args }),
		placeholderData: DEFAULT_INSIGHTS_PLACEHOLDER_DATA,
		enabled
	});
}
