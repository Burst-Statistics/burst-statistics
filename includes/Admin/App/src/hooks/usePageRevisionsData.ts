import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getPageRevisionsData, PageRevisionsData } from '@/api/getPageRevisionsData';

interface UsePageRevisionsOptions {
	id?: string;
	pageUrl?: string;
}

/**
 * React Query hook for fetching page revision impact data.
 * Mirrors the useVisitorFlowData pattern.
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
	const filtersKey = JSON.stringify( activeFilters );

	return useQuery<PageRevisionsData>({
		queryKey: [ 'page-revisions', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getPageRevisionsData({
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
