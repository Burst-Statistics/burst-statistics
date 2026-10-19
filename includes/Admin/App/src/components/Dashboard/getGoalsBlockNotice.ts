import { __ } from '@wordpress/i18n';
import { GOAL_STEP, isGoalComplete } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';

export interface GoalsBlockNoticeContent {
	text: string;
	action: string;

	// The goal the action opens in the wizard, and on which step.
	goalId?: number;
	step?: number;
}

/**
 * Why no goal is counting when all goals are shown, if that is the case.
 *
 * @param {Goal[]} goals All goals, at least one.
 * @return {GoalsBlockNoticeContent | null} The notice, or null when a goal is active.
 */
const getAllGoalsNotice = ( goals: Goal[]): GoalsBlockNoticeContent | null => {
	if ( goals.some( ( goal ) => 'active' === goal.status ) ) {
		return null;
	}

	return {
		text: __( 'None of your goals are active, so no conversions are being counted.', 'burst-statistics' ),
		action: __( 'Manage goals', 'burst-statistics' )
	};
};

/**
 * Why the selected goal is not counting, if it is not.
 *
 * @param {Goal} goal The selected goal.
 * @return {GoalsBlockNoticeContent | null} The notice, or null when the goal is counting.
 */
const getGoalNotice = ( goal: Goal ): GoalsBlockNoticeContent | null => {
	if ( ! isGoalComplete( goal ) ) {
		return {
			text: __( 'This goal is not finished, so it cannot count conversions yet.', 'burst-statistics' ),
			action: __( 'Finish setup', 'burst-statistics' ),
			goalId: goal.id,
			step: GOAL_STEP.TARGET
		};
	}

	if ( 'active' !== goal.status ) {
		return {
			text: __( 'This goal is paused, so it is not counting conversions.', 'burst-statistics' ),
			action: __( 'Manage goal', 'burst-statistics' ),
			goalId: goal.id,
			step: GOAL_STEP.REVIEW
		};
	}

	return null;
};

/**
 * Pick the one notice that explains why the dashboard goals block shows no conversions, if any.
 *
 * @param {Goal[]}          goals  All goals.
 * @param {string | number} goalId Selected goal id, or 'all'.
 * @return {GoalsBlockNoticeContent | null} The notice, or null when the goals are counting.
 */
export const getGoalsBlockNotice = ( goals: Goal[], goalId: string | number ): GoalsBlockNoticeContent | null => {
	if ( 0 === goals.length ) {
		return {
			text: __( 'Set a goal to see how many visitors take the action you care about.', 'burst-statistics' ),
			action: __( 'Create goal', 'burst-statistics' )
		};
	}

	if ( 'all' === goalId ) {
		return getAllGoalsNotice( goals );
	}

	const goal = goals.find( ( g ) => String( g.id ) === String( goalId ) );
	return goal ? getGoalNotice( goal ) : null;
};
