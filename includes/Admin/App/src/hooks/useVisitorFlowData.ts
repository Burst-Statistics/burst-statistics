import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getVisitorFlowData, VisitorFlowData } from '@/api/getVisitorFlowData';

export interface UseVisitorFlowBaseOptions {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
	enabled?: boolean;
}

export interface UseVisitorFlowOptions {
	id?: string;
	pageUrl?: string;
}

/**
 * Base React Query hook for fetching visitor flow diagram data with explicit options.
 *
 * @param {UseVisitorFlowBaseOptions} options - Page identification, date range and filter options.
 * @return React Query result containing VisitorFlowData.
 */
export function useVisitorFlowBaseData( options: UseVisitorFlowBaseOptions = {}) {
	const { id, pageUrl, startDate, endDate, range, filters = {}, enabled } = options;
	const filtersKey = JSON.stringify( filters );
	const isEnabled = undefined !== enabled ? enabled : Boolean( id || pageUrl );

	return useQuery<VisitorFlowData>({
		queryKey: [ 'visitor-flow', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getVisitorFlowData({
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
 * React Query hook for fetching visitor flow diagram data in dashboard context.
 *
 * @param {UseVisitorFlowOptions} options - Page identification options.
 * @return React Query result containing VisitorFlowData.
 */
export function useVisitorFlowData( options: UseVisitorFlowOptions = {}) {
	const { id, pageUrl } = options;

	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );
	const { getActiveFilters } = useFilters();
	const activeFilters = getActiveFilters();

	return useVisitorFlowBaseData({
		id,
		pageUrl,
		startDate,
		endDate,
		range,
		filters: activeFilters,
		enabled: Boolean( id || pageUrl )
	});
}
