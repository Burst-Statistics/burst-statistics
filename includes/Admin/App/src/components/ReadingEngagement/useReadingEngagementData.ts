import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getReadingEngagementData from '@/api/getReadingEngagementData';

/**
 * A single reading engagement data row.
 */
export type ReadingEngagementRow = {

	/** The page URL path. */
	page_url: string;

	/** Average time spent on this page in milliseconds. */
	avg_time_on_page: number;
};

type UseReadingEngagementDataReturn = {

	/** All available rows. */
	data: ReadingEngagementRow[];

	/** Whether the request is in flight. */
	isLoading: boolean;

	/** Request error, if any. */
	error: Error | null;
};

type UseReadingEngagementDataArgs = {

	/** Whether to query for lowest reading engagement. */
	leastEngagement: boolean;
};

/**
 * Returns reading engagement data for the current date range.
 *
 * @param {UseReadingEngagementDataArgs} args - Toggle for least vs best engagement.
 * @return {UseReadingEngagementDataReturn} The reading engagement dataset and request state.
 */
export function useReadingEngagementData({
	leastEngagement
}: UseReadingEngagementDataArgs ): UseReadingEngagementDataReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'reading_engagement', startDate, endDate, leastEngagement, filters ],
		queryFn: () => getReadingEngagementData({ startDate, endDate, range, leastEngagement, filters }),
		enabled: !! startDate && !! endDate
	});

	return {
		data: query.data ?? [],
		isLoading: query.isLoading || query.isFetching,
		error: ( query.error as Error | null ) ?? null
	};
}
