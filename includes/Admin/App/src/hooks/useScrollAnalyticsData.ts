import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getScrollAnalyticsData, ScrollAnalyticsData } from '@/api/getScrollAnalyticsData';

export interface UseScrollAnalyticsBaseOptions {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
	enabled?: boolean;
}

export interface UseScrollAnalyticsOptions {
	id?: string;
	pageUrl?: string;

	/** False skips the request, e.g. when essentials mode turned scroll depth off. */
	enabled?: boolean;
}

/**
 * Base React Query hook for fetching scroll analytics data with explicit options.
 *
 * @param {UseScrollAnalyticsBaseOptions} options - Page identification, date range and filter options.
 * @return React Query result containing ScrollAnalyticsData.
 */
export function useScrollAnalyticsBaseData( options: UseScrollAnalyticsBaseOptions = {}) {
	const { id, pageUrl, startDate, endDate, range, filters = {}, enabled } = options;
	const filtersKey = JSON.stringify( filters );
	const isEnabled = undefined !== enabled ? enabled : Boolean( id || pageUrl );

	return useQuery<ScrollAnalyticsData>({
		queryKey: [ 'scroll-analytics', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getScrollAnalyticsData({
				id,
				pageUrl,
				startDate,
				endDate,
				range,
				filters
			}),
		enabled: isEnabled
	});
}

/**
 * React Query hook for fetching scroll analytics data in dashboard context.
 *
 * @param {UseScrollAnalyticsOptions} options - Page identification options.
 * @return React Query result containing ScrollAnalyticsData.
 */
export function useScrollAnalyticsData( options: UseScrollAnalyticsOptions = {}) {
	const { id, pageUrl, enabled = true } = options;

	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );
	const { getActiveFilters } = useFilters();
	const activeFilters = getActiveFilters();

	return useScrollAnalyticsBaseData({
		id,
		pageUrl,
		startDate,
		endDate,
		range,
		filters: activeFilters,
		enabled: enabled && Boolean( id || pageUrl )
	});
}
