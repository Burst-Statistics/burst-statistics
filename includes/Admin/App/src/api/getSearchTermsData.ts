import { getData } from '@/utils/api';
import type { SearchTermRow } from '@/components/SearchTerms/useSearchTermsData';

type GetSearchTermsDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
};

/**
 * Fetch aggregated search-term data from the REST API.
 *
 * @param params - Date range for the query.
 * @return Search-term rows from PHP `get_search_terms_data()`.
 */
const getSearchTermsData = async({
	startDate,
	endDate,
	range
}: GetSearchTermsDataArgs ): Promise<SearchTermRow[]> => {
	const { data } = await getData( 'search_terms', startDate, endDate, range );
	return ( data ?? []) as SearchTermRow[];
};

export default getSearchTermsData;
