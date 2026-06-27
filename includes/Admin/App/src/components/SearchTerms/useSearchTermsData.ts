import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getSearchTermsData from '@/api/getSearchTermsData';

/**
 * A single search-term data row.
 */
export type SearchTermRow = {

	/** The search query entered by the visitor. */
	term: string;

	/** Number of times this term was searched. */
	volume: number;

	/** Number of results returned for this term by the site search. */
	results: number;
};

type UseSearchTermsDataReturn = {

	/** All available rows, ordered by volume descending. */
	data: SearchTermRow[];

	/** Whether the request is in flight. */
	isLoading: boolean;

	/** Request error, if any. */
	error: Error | null;
};

/**
 * Returns search-term data for the current date range.
 *
 * @return {UseSearchTermsDataReturn} The search-term dataset and request state.
 */
export function useSearchTermsData(): UseSearchTermsDataReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'search_terms', startDate, endDate, filters ],
		queryFn: () => getSearchTermsData({ startDate, endDate, range, filters }),
		enabled: !! startDate && !! endDate
	});

	return {
		data: query.data ?? [],
		isLoading: query.isLoading || query.isFetching,
		error: ( query.error as Error | null ) ?? null
	};
}
