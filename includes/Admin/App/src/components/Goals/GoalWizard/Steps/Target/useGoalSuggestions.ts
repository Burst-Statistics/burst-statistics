import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { availableRanges } from '@/utils/formatting';
import { getDatatableData } from '@/utils/api';
import { getEventProperties } from '@/api/getEventProperties';

interface EventSuggestion {
	name: string;
	count: number;
}

interface FileDownloadSuggestion {
	file_name: string;
	count: number;
}

/**
 * Fetch top custom events received in the last 30 days for goal autocomplete.
 *
 * @return {import('@tanstack/react-query').UseQueryResult<EventSuggestion[], Error>} Suggestions query.
 */
export const use30DaysEvents = () => {
	return useQuery<EventSuggestion[], Error>({
		queryKey: [ 'events-suggestions-30-days' ],
		queryFn: async() => {
			const rangeDef = availableRanges['last-30-days'];
			const { startDate, endDate } = rangeDef.range();
			const startStr = format( startDate, 'yyyy-MM-dd' );
			const endStr = format( endDate, 'yyyy-MM-dd' );
			const response = await getDatatableData( 'events', false, startStr, endStr, 'last-30-days', {});
			const rows = ( response?.data?.data ?? []) as EventSuggestion[];
			return [ ...rows ].sort( ( a, b ) => Number( b.count ) - Number( a.count ) );
		},
		staleTime: 60 * 1000
	});
};

/**
 * Fetch top file downloads received in the last 30 days for goal autocomplete.
 *
 * @return {import('@tanstack/react-query').UseQueryResult<FileDownloadSuggestion[], Error>} Suggestions query.
 */
export const use30DaysDownloadFiles = () => {
	return useQuery<FileDownloadSuggestion[], Error>({
		queryKey: [ 'file-download-suggestions-30-days' ],
		queryFn: async() => {
			const rangeDef = availableRanges['last-30-days'];
			const { startDate, endDate } = rangeDef.range();
			const startStr = format( startDate, 'yyyy-MM-dd' );
			const endStr = format( endDate, 'yyyy-MM-dd' );
			const res = await getEventProperties({
				eventName: 'file_download',
				startDate: startStr,
				endDate: endStr,
				range: 'last-30-days'
			});
			const rows = ( res?.data ?? [])
				.filter( ( row: { prop_key?: string; value?: string; count?: number }) => 'file_name' === row.prop_key && row.value )
				.map( ( row: { value?: string; count?: number }) => ({
					file_name: String( row.value ),
					count: Number( row.count ) || 0
				}) )
				.sort( ( a: FileDownloadSuggestion, b: FileDownloadSuggestion ) => b.count - a.count );
			return rows;
		},
		staleTime: 60 * 1000
	});
};
