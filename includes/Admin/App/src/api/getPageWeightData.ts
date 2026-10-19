import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';
import type { PageWeightData } from '@/components/PageWeight/usePageWeightData';

type GetPageWeightDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
	filters?: FilterSearchParams;
};

/**
 * Fetch the Page weight block payload from the REST API.
 *
 * @param params - Date range for the query and the active filters.
 * @return The block payload from PHP `get_page_weight_data()`.
 */
const getPageWeightData = async({
	startDate,
	endDate,
	range,
	filters
}: GetPageWeightDataArgs ): Promise<PageWeightData | null> => {
	const { data } = await getData( 'page_weight', startDate, endDate, range, { filters });
	return ( data ?? null ) as PageWeightData | null;
};

export default getPageWeightData;
