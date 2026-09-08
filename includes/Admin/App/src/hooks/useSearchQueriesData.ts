import { useQuery } from '@tanstack/react-query';
import { getSearchQueriesData, SearchQueriesData } from '@/api/getSearchQueriesData';
import { useDate } from '@/store/useDateStore';

interface UseSearchQueriesOptions {
	id?: string;
	pageUrl?: string;
	enabled?: boolean;
}

/**
 * Load page-scoped Search Console rows for the active date range.
 */
export function useSearchQueriesData( options: UseSearchQueriesOptions = {}) {
	const { id, pageUrl, enabled = true } = options;
	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );

	return useQuery<SearchQueriesData>({
		queryKey: [ 'search-queries', id, pageUrl, startDate, endDate, range ],
		queryFn: () => getSearchQueriesData({
			id,
			pageUrl,
			startDate,
			endDate,
			range
		}),
		enabled: enabled && Boolean( id || pageUrl ),
		refetchOnWindowFocus: ( query ) => {
			const current = query.state.data as SearchQueriesData | undefined;
			return 'pending' === current?.status ? 'always' : false;
		},
		refetchInterval: ( query ) => {
			const current = query.state.data as SearchQueriesData | undefined;
			if ( 'pending' === current?.status ) {
				return 5000;
			}
			return 'failed' === current?.status ? 60000 : false;
		}
	});
}
