import type { GoalsOverviewGoal } from '@/types/api-endpoints';

/**
 * When a goal stopped counting, if the health check flagged it.
 *
 * @param {GoalsOverviewGoal | undefined} stats The goal's results.
 * @return {number | null} Unix timestamp of its last conversion, or null when it is fine.
 */
export const getNotCountingSince = ( stats?: GoalsOverviewGoal ): number | null =>
	'not_counting' === stats?.health.status ? stats.health.last_conversion : null;
