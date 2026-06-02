import { useMemo } from 'react';

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

// TODO: Replace this mock dataset with a real REST API call once the
// corresponding PHP endpoint is implemented.
const MOCK_DATA: SearchTermRow[] = [
	{ term: 'wordpress analytics plugin', volume: 342, results: 18 },
	{ term: 'burst statistics', volume: 287, results: 5 },
	{ term: 'cookie-free analytics', volume: 231, results: 12 },
	{ term: 'gdpr compliant analytics', volume: 198, results: 9 },
	{ term: 'page views vs sessions', volume: 167, results: 3 },
	{ term: 'bounce rate definition', volume: 154, results: 7 },
	{ term: 'how to track goals', volume: 143, results: 0 },
	{ term: 'utm parameters', volume: 128, results: 6 },
	{ term: 'exit rate meaning', volume: 115, results: 0 },
	{ term: 'woocommerce conversion rate', volume: 97, results: 4 },
	{ term: 'real-time visitors', volume: 89, results: 2 },
	{ term: 'heatmap alternative', volume: 76, results: 0 },
	{ term: 'referrer tracking', volume: 71, results: 8 },
	{ term: 'session duration average', volume: 65, results: 1 },
	{ term: 'google analytics alternative', volume: 59, results: 11 },
	{ term: 'block crawler traffic', volume: 54, results: 0 },
	{ term: 'dashboard widget not showing', volume: 48, results: 0 },
	{ term: 'campaign tracking url', volume: 43, results: 3 },
	{ term: 'ip address exclusion', volume: 38, results: 2 },
	{ term: 'multisite analytics', volume: 34, results: 0 },
	{ term: 'csv export statistics', volume: 29, results: 1 },
	{ term: 'pageview not recorded', volume: 24, results: 0 },
	{ term: 'countries report', volume: 18, results: 4 },
	{ term: 'tracking script size', volume: 12, results: 0 },
	{ term: 'burst pro upgrade', volume: 7, results: 6 }
];

type UseSearchTermsDataReturn = {

	/** All available rows, ordered by volume descending. */
	data: SearchTermRow[];

	/** Always false for mock data — will reflect API loading state when real. */
	isLoading: boolean;

	/** Always null for mock data — will reflect API errors when real. */
	error: Error | null;
};

/**
 * Returns search-term data for the current date range.
 *
 * Currently returns deterministic mock data. When a real REST endpoint is
 * available, replace the body of this hook with a `useQuery` call and remove
 * the mock constant above.
 *
 * @return {UseSearchTermsDataReturn} The search-term dataset and request state.
 */
export function useSearchTermsData(): UseSearchTermsDataReturn {
	const data = useMemo(
		() => [ ...MOCK_DATA ].sort( ( a, b ) => b.volume - a.volume ),
		[]
	);

	return { data, isLoading: false, error: null };
}
