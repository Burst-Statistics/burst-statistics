import { getData } from '@/utils/api';
import type { GoalsOverview } from '@/types/api-endpoints';

/**
 * Fetch every goal's results for the goals dashboard.
 *
 * @param {string} startDate Start of the period, Y-m-d.
 * @param {string} endDate   End of the period, Y-m-d.
 * @param {string} range     Date range slug.
 * @return {Promise<GoalsOverview>} Totals and per-goal results, with the previous period.
 */
const getGoalsOverview = async( startDate: string, endDate: string, range: string ): Promise<GoalsOverview> => {
	const { data } = await getData( 'goals_overview', startDate, endDate, range );
	return data as GoalsOverview;
};

export default getGoalsOverview;
