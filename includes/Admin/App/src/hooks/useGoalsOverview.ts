import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '@/hooks/useDateRange';
import getGoalsOverview from '@/api/getGoalsOverview';
import type { GoalsOverview } from '@/types/api-endpoints';

/**
 * Every goal's results in the selected date range. Shared by the goals list,
 * the goal header and the goals comparison, so it is fetched once.
 *
 * @return React Query result with the goals overview.
 */
const useGoalsOverview = () => {
	const { startDate, endDate, range } = useDateRange();

	return useQuery<GoalsOverview>({
		queryKey: [ 'goals_overview', startDate, endDate ],
		queryFn: () => getGoalsOverview( startDate, endDate, range )
	});
};

export default useGoalsOverview;
