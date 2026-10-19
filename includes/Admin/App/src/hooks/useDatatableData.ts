import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { getDatatableData } from '@/utils/api';
import useFilters from '@/hooks/useFilters';

type UseDatatableDataOptions = {
	id: string;
	enabled?: boolean;
};

type UseDatatableDataReturn<Row> = {
	data: Row[];
	isLoading: boolean;
	error: Error | null;
};

/**
 * Fetch a datatable's rows for the current date range and dashboard filters.
 *
 * @param {UseDatatableDataOptions} options Datatable id and query state.
 * @return {UseDatatableDataReturn<Row>} Datatable rows and request state.
 */
export function useDatatableData<Row>({
	id,
	enabled = true
}: UseDatatableDataOptions ): UseDatatableDataReturn<Row> {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const { data, isLoading, error } = useQuery<Row[], Error>({
		queryKey: [ id, startDate, endDate, range, filters ],
		enabled,
		queryFn: async() => {
			const response = await getDatatableData(
				id,
				false,
				startDate,
				endDate,
				range,
				{ filters }
			);

			return ( response?.data?.data ?? []) as Row[];
		},
		placeholderData: []
	});

	return {
		data: data ?? [],
		isLoading,
		error
	};
}
