import { useQuery } from '@tanstack/react-query';
import { getSourcesOverTimeData, getSourcesListData } from '@/api/getSourcesData';

/**
 * Shared custom hook to query traffic sources data over time.
 * Deduplicates in-flight requests and caches response data under the same key.
 *
 * @param {Object}   params            Hook parameters.
 * @param {string}   params.startDate  Start date.
 * @param {string}   params.endDate    End date.
 * @param {string}   params.range      Date range key.
 * @param {Object}   params.args       Additional filter parameters.
 * @param {Function} [params.select]   Optional selection transformer callback.
 * @return {Object} Query result object.
 */
export function useSourcesOverTime({ startDate, endDate, range, args, select }) {
	return useQuery({
		queryKey: [ 'sources-over-time', startDate, endDate, range, args ],
		queryFn: () => getSourcesOverTimeData({ startDate, endDate, range, args }),
		placeholderData: {
			timestamps: [],
			search: [],
			social: [],
			referral: [],
			aiReferral: [],
			paid: [],
			email: [],
			direct: []
		},
		select
	});
}

/**
 * Shared custom hook to query the flat traffic sources list.
 */
export function useSourcesList({ startDate, endDate, range, args, select }) {
	return useQuery({
		queryKey: [ 'sources-list', startDate, endDate, range, args ],
		queryFn: () => getSourcesListData({ startDate, endDate, range, args }),
		placeholderData: [],
		select
	});
}

export default useSourcesOverTime;
