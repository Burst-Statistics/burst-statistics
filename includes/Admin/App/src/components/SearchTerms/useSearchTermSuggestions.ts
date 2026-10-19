import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getSearchTermSuggestions, { EMPTY_SEARCH_TERM_SUGGESTIONS } from '@/api/getSearchTermSuggestions';
import type { SearchTermSuggestionsResponse } from '@/api/getSearchTermSuggestions';

type UseSearchTermSuggestionsReturn = {
	data: SearchTermSuggestionsResponse;
	isLoading: boolean;
	error: Error | null;
};

/**
 * Whether all inputs for the request are present.
 *
 * @param {string[]} values Term, start date and end date.
 * @return {boolean} True when none is empty.
 */
const hasAllValues = ( values: string[]): boolean => values.every( Boolean );

/**
 * Loads the SmartMatch suggestion history of one term for the current date range
 * and filters. The result is cached by React Query, so reopening is instant.
 *
 * @param {string} term The search term.
 * @return {UseSearchTermSuggestionsReturn} The suggestion summary and request state.
 */
export function useSearchTermSuggestions( term: string ): UseSearchTermSuggestionsReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'search_term_suggestions', term, startDate, endDate, filters ],
		queryFn: () => getSearchTermSuggestions({ term, startDate, endDate, range, filters }),
		enabled: hasAllValues([ term, startDate, endDate ]),
		staleTime: 1000 * 60 * 5
	});

	return {
		data: query.data ?? EMPTY_SEARCH_TERM_SUGGESTIONS,
		isLoading: query.isLoading,
		error: query.error
	};
}
