import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getPageRevisionsData, PageRevisionsData } from '@/api/getPageRevisionsData';

export interface UsePageRevisionsBaseOptions {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
	enabled?: boolean;
}

export interface UsePageRevisionsOptions {
	id?: string;
	pageUrl?: string;
}

/**
 * Base React Query hook for fetching page revision impact data with explicit options.
 *
 * @param {UsePageRevisionsBaseOptions} options - Page identification, date range and filter options.
 * @return React Query result containing PageRevisionsData.
 */
export function usePageRevisionsBaseData( options: UsePageRevisionsBaseOptions = {}) {
	const { id, pageUrl, startDate, endDate, range, filters = {}, enabled } = options;
	const filtersKey = JSON.stringify( filters );
	const isEnabled = undefined !== enabled ? enabled : Boolean( id || pageUrl );

	return useQuery<PageRevisionsData>({
		queryKey: [ 'page-revisions', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getPageRevisionsData({
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
 * React Query hook for fetching page revision impact data in dashboard context.
 *
 * @param {UsePageRevisionsOptions} options - Page identification options.
 * @return React Query result containing PageRevisionsData.
 */
export function usePageRevisionsData( options: UsePageRevisionsOptions = {}) {
	const { id, pageUrl } = options;

	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );
	const { getActiveFilters } = useFilters();
	const activeFilters = getActiveFilters();

	return usePageRevisionsBaseData({
		id,
		pageUrl,
		startDate,
		endDate,
		range,
		filters: activeFilters,
		enabled: Boolean( id || pageUrl )
	});
}
