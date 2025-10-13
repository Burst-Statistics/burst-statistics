import { useLiveVisitorsData } from '@/hooks/useLiveVisitorsData'

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
	[ id: string ]: TaskCondition;
};

/**
 * Get task condition by ID.
 *
 * @param { string } id The condition ID.
 *
 * @returns The condition object, or false if not found.
 */
export const useTaskConditionRegistry = (
	id: string
): TaskCondition | false => {
	const registry: TaskConditionRegistry = {
		live_visitors: {
			condition: () => {
				// Add 'any' type for now until all JS files are converted to TS.
				const liveVisitorsQuery: any = useLiveVisitorsData();
				const live = parseInt( liveVisitorsQuery.data );

				return live > 0;
			},
		},
	};

	return registry[ id ] ? registry[ id ] : false;
};
