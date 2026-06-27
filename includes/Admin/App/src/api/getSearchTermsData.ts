import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';
import type { SearchTermRow } from '@/components/SearchTerms/useSearchTermsData';

type GetSearchTermsDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
	filters?: FilterSearchParams;
};

/**
 * Fetch aggregated search-term data from the REST API.
 *
 * @param params - Date range for the query and active filters.
 * @return Search-term rows from PHP `get_search_terms_data()`.
 */
const getSearchTermsData = async({
	startDate,
	endDate,
	range,
	filters
}: GetSearchTermsDataArgs ): Promise<SearchTermRow[]> => {
	const { data } = await getData( 'search_terms', startDate, endDate, range, { filters });
	return ( data ?? []) as SearchTermRow[];
};

export default getSearchTermsData;
