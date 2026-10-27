import { useQuery } from '@tanstack/react-query';
import { getSearchQueriesData, SearchQueriesData } from '@/api/getSearchQueriesData';
import { useDate } from '@/store/useDateStore';

export interface UseSearchQueriesBaseOptions {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	enabled?: boolean;
}

export interface UseSearchQueriesOptions {
	id?: string;
	pageUrl?: string;
	enabled?: boolean;
}

/**
 * Load page-scoped Search Console rows with explicit options.
 *
 * @param {UseSearchQueriesBaseOptions} options - Query options.
 * @return React Query result containing SearchQueriesData.
 */
export function useSearchQueriesBaseData( options: UseSearchQueriesBaseOptions = {}) {
	const { id, pageUrl, startDate, endDate, range, enabled = true } = options;

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

/**
 * Load page-scoped Search Console rows for the active date range.
 *
 * @param {UseSearchQueriesOptions} options - Query options.
 * @return React Query result containing SearchQueriesData.
 */
export function useSearchQueriesData( options: UseSearchQueriesOptions = {}) {
	const { id, pageUrl, enabled = true } = options;
	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );

	return useSearchQueriesBaseData({
		id,
		pageUrl,
		startDate,
		endDate,
		range,
		enabled
	});
}
