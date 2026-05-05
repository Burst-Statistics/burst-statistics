import { useLiveVisitorsData } from '@/hooks/useLiveVisitorsData';

/**
 * Shape of a single task condition.
 */
export type TaskCondition = {
	condition: () => boolean;
};

/**
 * Registry type where keys are condition IDs.
 */
type TaskConditionRegistry = {
	[id: string]: TaskCondition;
};

/**
 * Get task condition by ID.
 *
 * @param { string } id The condition ID.
 *
 * @return The condition object, or false if not found.
 */
export const useTaskConditionRegistry = ( id: string ): TaskCondition | false => {
	const liveVisitorsQuery: any = useLiveVisitorsData(); // eslint-disable-line @typescript-eslint/no-explicit-any
	const live = parseInt( liveVisitorsQuery?.data ?? 0 );

	const registry: TaskConditionRegistry = {
		live_visitors: {
			condition: () => {
				return 0 < live;
			}
		}
	};

	return registry[id] || false;
};
