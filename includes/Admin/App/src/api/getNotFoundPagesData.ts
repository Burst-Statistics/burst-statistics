import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';
import type { NotFoundPageRow } from '@/components/NotFoundPages/useNotFoundPagesData';

type GetNotFoundPagesDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
	filters?: FilterSearchParams;
};

const getNotFoundPagesData = async({
	startDate,
	endDate,
	range,
	filters
}: GetNotFoundPagesDataArgs ): Promise<NotFoundPageRow[]> => {
	const { data } = await getData( 'not_found_pages', startDate, endDate, range, { filters });
	return ( data ?? []) as NotFoundPageRow[];
};

export default getNotFoundPagesData;
