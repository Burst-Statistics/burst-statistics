import { useQuery } from '@tanstack/react-query';
import getCompareData from '@/api/getCompareData';
import { COMPARE_MODES } from '@/store/useCompareStore';
import {
	type ComparisonDates,
	type CompareData,
	getComparisonDates,
	getEmptyCompareData
} from '@/utils/comparisonDates';


export interface UseCompareDataOptions {
	startDate: string;
	endDate: string;
	range?: string;
	compareMode?: string;
	filters?: Record<string, unknown>;
	includePageMetrics?: boolean;
	enabled?: boolean;
	customCompareDates?: ComparisonDates;
}

/**
 * React Query hook for fetching comparison metrics data.
 *
 * @param {UseCompareDataOptions} options - Query configuration options.
 * @return Query result and derived comparison date range.
 */
export function useCompareData( options: UseCompareDataOptions ) {
	const {
		startDate,
		endDate,
		range,
		compareMode = COMPARE_MODES.PREVIOUS_PERIOD,
		filters = {},
		includePageMetrics = false,
		enabled = true,
		customCompareDates
	} = options;

	const { compareStart, compareEnd } = customCompareDates ?? getComparisonDates( startDate, endDate, compareMode );

	const args = {
		filters,
		compare_date_start: compareStart,
		compare_date_end: compareEnd,
		include_page_metrics: includePageMetrics
	};

	const placeholderData = getEmptyCompareData( includePageMetrics );

	const query = useQuery<CompareData>({
		queryKey: [ 'compare', startDate, endDate, compareMode, args, includePageMetrics ],
		queryFn: () => getCompareData({
			startDate,
			endDate,
			range: range ?? '',
			args,
			includePageMetrics
		} as unknown as Parameters<typeof getCompareData>[0]),
		placeholderData,
		enabled
	});

	return {
		...query,
		compareStart,
		compareEnd
	};
}
