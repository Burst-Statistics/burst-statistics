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
function useSourcesOverTime({ startDate, endDate, range, args, select }) {
	return useQuery({
		queryKey: [ 'sources-over-time', startDate, endDate, range, args ],
		queryFn: () => getSourcesOverTimeData({ startDate, endDate, range, args }),
		placeholderData: {
			timestamps: [
				1700000000, 1700086400, 1700172800, 1700259200, 1700345600, 1700432000,
				1700518400, 1700604800, 1700691200, 1700777600, 1700864000, 1700950400
			],
			search: [ 45, 60, 55, 70, 65, 80, 75, 90, 85, 100, 95, 110 ],
			social: [ 20, 25, 30, 28, 35, 40, 38, 45, 42, 50, 48, 55 ],
			referral: [ 15, 18, 22, 20, 25, 28, 26, 30, 29, 35, 32, 38 ],
			aiReferral: [ 5, 8, 10, 12, 11, 15, 14, 18, 16, 20, 19, 22 ],
			paid: [ 10, 12, 15, 14, 18, 20, 19, 22, 21, 25, 24, 28 ],
			email: [ 8, 10, 12, 11, 15, 16, 14, 18, 17, 20, 19, 22 ],
			direct: [ 30, 35, 40, 38, 45, 50, 48, 55, 52, 60, 58, 65 ]
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
