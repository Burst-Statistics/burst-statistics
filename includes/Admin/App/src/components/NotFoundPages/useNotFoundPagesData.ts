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
		queryFn: () => getNotFoundPagesData({ startDate, endDate, range, filters }),
		enabled: !! startDate && !! endDate
	});

	return {
		data: query.data ?? [],
		isLoading: query.isLoading || query.isFetching,
		error: ( query.error as Error | null ) ?? null
	};
}
