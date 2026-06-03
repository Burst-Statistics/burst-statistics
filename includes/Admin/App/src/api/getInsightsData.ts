import { getData } from '@/utils/api';
import type { GetInsightsDataArgs, InsightsData } from '@/types/insights-api';

/**
 * Fetch insights chart data from the REST API.
 *
 * @param params - Date range and query args (metrics, filters, group_by, compare_mode).
 * @return Insights chart payload from PHP `get_insights_data()`.
 */
const getInsightsData = async({
	startDate,
	endDate,
	range,
	args = {}
}: GetInsightsDataArgs ): Promise<InsightsData> => {
	const { data } = await getData( 'insights', startDate, endDate, range, args );
	return data as InsightsData;
};

export default getInsightsData;
