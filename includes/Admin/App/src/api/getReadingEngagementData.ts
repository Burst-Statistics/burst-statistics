import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';
import type { ReadingEngagementRow } from '@/components/ReadingEngagement/useReadingEngagementData';

type GetReadingEngagementDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
	leastEngagement: boolean;
	filters?: FilterSearchParams;
};

/**
 * Fetch aggregated reading engagement data from the REST API.
 *
 * @param params - Date range for the query, least engagement toggle and active filters.
 * @return Reading engagement rows from PHP `get_reading_engagement_data()`.
 */
const getReadingEngagementData = async({
	startDate,
	endDate,
	range,
	leastEngagement,
	filters
}: GetReadingEngagementDataArgs ): Promise<ReadingEngagementRow[]> => {
	const { data } = await getData( 'reading_engagement', startDate, endDate, range, { least_engagement: leastEngagement, filters });
	return ( data ?? []) as ReadingEngagementRow[];
};

export default getReadingEngagementData;
