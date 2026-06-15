import { getData } from '@/utils/api';
import type { ReadingEngagementRow } from '@/components/ReadingEngagement/useReadingEngagementData';

type GetReadingEngagementDataArgs = {
	startDate: string;
	endDate: string;
	range: string;
	leastEngagement: boolean;
};

/**
 * Fetch aggregated reading engagement data from the REST API.
 *
 * @param params - Date range for the query and least engagement toggle.
 * @return Reading engagement rows from PHP `get_reading_engagement_data()`.
 */
const getReadingEngagementData = async({
	startDate,
	endDate,
	range,
	leastEngagement
}: GetReadingEngagementDataArgs ): Promise<ReadingEngagementRow[]> => {
	const { data } = await getData( 'reading_engagement', startDate, endDate, range, { least_engagement: leastEngagement });
	return ( data ?? []) as ReadingEngagementRow[];
};

export default getReadingEngagementData;
