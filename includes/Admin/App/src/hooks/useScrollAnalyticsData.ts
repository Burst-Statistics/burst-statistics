import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getScrollAnalyticsData, ScrollAnalyticsData } from '@/api/getScrollAnalyticsData';

interface UseScrollAnalyticsOptions {
	id?: string;
	pageUrl?: string;
}

export function useScrollAnalyticsData( options: UseScrollAnalyticsOptions = {}) {
	const { id, pageUrl } = options;

	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );
	const { getActiveFilters } = useFilters();

	const activeFilters = getActiveFilters();
	const filtersKey = JSON.stringify( activeFilters );

	return useQuery<ScrollAnalyticsData>({
		queryKey: [ 'scroll-analytics', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getScrollAnalyticsData({
				id,
				pageUrl,
				startDate,
				endDate,
				range,
				filters: activeFilters
			}),
		enabled: Boolean( id || pageUrl )
	});
}
