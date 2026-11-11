import { getGoalKind } from '@/components/Goals/goalHelpers';
import { getGoalTypeKeys } from '@/components/Goals/goalOptions';
import type { Goal } from '@/components/Goals/goalHelpers';

export interface GoalGroup {
	type: string;
	goals: Goal[];
}

/**
 * Goals grouped by kind, in the order the goal types are offered, so file downloads get their own group
 * next to custom events. Unknown types come last, empty groups are left out.
 *
 * @param {Goal[]} goals The goals, in the order they should appear within a group.
 * @return {GoalGroup[]} The groups.
 */
export const groupGoalsByType = ( goals: Goal[]): GoalGroup[] => {
	const types = new Set<string>([ ...getGoalTypeKeys(), ...goals.map( getGoalKind ) ]);

	return Array.from( types )
		.map( ( type ) => ({ type, goals: goals.filter( ( goal ) => getGoalKind( goal ) === type ) }) )
		.filter( ( group ) => 0 < group.goals.length );
};
