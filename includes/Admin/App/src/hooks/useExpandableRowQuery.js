import { useQuery } from '@tanstack/react-query';

/**
 * Shared query hook for expandable sub-row components.
 *
 * Encapsulates the common pattern of fetching sub-row data with a 5-minute
 * stale time and deriving the `isLoading`, `error`, and `rows` state values.
 * Used by ParameterVariationsRow and SourceReferrersRow to avoid repeating
 * identical query setup code in both components.
 *
 * @param {Object}   params         Hook parameters.
 * @param {Array}    params.queryKey Unique key for this query.
 * @param {Function} params.queryFn  Function that fetches the data.
 * @param {boolean}  params.enabled  Whether the query should run.
 *
 * @return {{ isLoading: boolean, error: Error|null, rows: Array }} Query state.
 */
const useExpandableRowQuery = ({ queryKey, queryFn, enabled }) => {
	const query = useQuery({
		queryKey,
		queryFn,
		enabled,

		// Sub-row data rarely changes for an already-loaded date range.
		staleTime: 1000 * 60 * 5
	});

	return {
		isLoading: query.isLoading || query.isFetching,
		error: query.error,
		rows: query.data?.data || []
	};
};

export default useExpandableRowQuery;
