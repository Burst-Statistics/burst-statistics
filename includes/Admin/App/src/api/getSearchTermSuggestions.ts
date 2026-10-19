import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';

/**
 * One post SmartMatch suggested for a search term.
 */
export type SearchTermSuggestion = {
	post_id: number;
	title: string;
	url: string;
	path: string;

	/** Searches that showed this post. */
	shown: number;

	/** Searches whose next pageview in the session was this post. */
	clicked: number;
};

/**
 * Suggestion history of one search term, from PHP `query_search_term_suggestions()`.
 */
export type SearchTermSuggestionsResponse = {
	searches: number;
	shown: number;
	not_shown: number;

	/** Searches where the AI ran and found nothing relevant. */
	ai_found_nothing: number;

	/** Searches where no suggestion was computed (budget, rate limit, AI unavailable). */
	no_suggestion: number;
	rows: SearchTermSuggestion[];
};

type GetSearchTermSuggestionsArgs = {
	term: string;
	startDate: string;
	endDate: string;
	range: string;
	filters?: FilterSearchParams;
};

export const EMPTY_SEARCH_TERM_SUGGESTIONS: SearchTermSuggestionsResponse = {
	searches: 0,
	shown: 0,
	not_shown: 0,
	ai_found_nothing: 0,
	no_suggestion: 0,
	rows: []
};

/**
 * Fetch the SmartMatch suggestion history for one search term.
 *
 * @param params - Term, date range and active filters.
 * @return The suggestion summary; reads only recorded data, never calls an AI service.
 */
const getSearchTermSuggestions = async({
	term,
	startDate,
	endDate,
	range,
	filters
}: GetSearchTermSuggestionsArgs ): Promise<SearchTermSuggestionsResponse> => {
	const { data } = await getData( 'search_term_suggestions', startDate, endDate, range, { term, filters });
	return ( data ?? EMPTY_SEARCH_TERM_SUGGESTIONS ) as SearchTermSuggestionsResponse;
};

export default getSearchTermSuggestions;
