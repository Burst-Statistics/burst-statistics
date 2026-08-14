import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getNotFoundPagesData from '@/api/getNotFoundPagesData';

export type NotFoundPageRow = {
	page_url: string;
	hits: number;
};

type UseNotFoundPagesDataReturn = {
	data: NotFoundPageRow[];
	isLoading: boolean;
	error: Error | null;
};

export function useNotFoundPagesData(): UseNotFoundPagesDataReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'not_found_pages', startDate, endDate, filters ],

		// fallow-ignore-next-line code-duplication -- Idiomatic React Query pattern; each hook owns its distinct query key and fetcher; shared abstraction would reduce type safety.
		queryFn: () => getNotFoundPagesData({ startDate, endDate, range, filters }),
		enabled: !! startDate && !! endDate
	});

	const notFoundData = query.data ?? [];
	const isFetchingData = query.isLoading || query.isFetching;
	const notFoundError = ( query.error as Error | null ) ?? null;

	return {
		data: notFoundData,
		isLoading: isFetchingData,
		error: notFoundError
	};
}
