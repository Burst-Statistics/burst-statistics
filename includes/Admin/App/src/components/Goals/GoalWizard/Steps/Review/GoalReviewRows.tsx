import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP, isElementType } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import { getTracksText, getWhereText } from '@/components/Goals/goalText';
import GoalReviewRow from './GoalReviewRow';

/**
 * What the goal counts: the element's selector for click and view goals, the page or hook otherwise.
 *
 * @param {Goal} goal The goal.
 * @return {JSX.Element | string} What it counts.
 */
const getCountsValue = ( goal: Goal ): JSX.Element | string => {
	if ( ! isElementType( goal.type ) ) {
		return getTracksText( goal );
	}

	const selector = { selector: <code className="font-mono break-all">{goal.selector}</code> };
	return 'views' === goal.type ?

		/* translators: <selector />: the element's CSS selector. */
		createInterpolateElement( __( 'Views of <selector />', 'burst-statistics' ), selector ) :

		/* translators: <selector />: the element's CSS selector. */
		createInterpolateElement( __( 'Clicks on <selector />', 'burst-statistics' ), selector );
};

/**
 * What the goal counts and where, each with a link back to the step that set it.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being saved.
 * @return {JSX.Element} The review rows.
 */
const GoalReviewRows = ({ goal }: { goal: Goal }): JSX.Element => {
	const setCurrentStep = useGoalWizardStore( ( state ) => state.setCurrentStep );

	return (
		<div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
			<GoalReviewRow label={__( 'Counts', 'burst-statistics' )} onEdit={() => setCurrentStep( GOAL_STEP.TARGET )}>
				{getCountsValue( goal )}
			</GoalReviewRow>

			{isElementType( goal.type ) && (
				<GoalReviewRow label={__( 'Where', 'burst-statistics' )} onEdit={() => setCurrentStep( GOAL_STEP.COUNT )}>
					{getWhereText( goal )}
				</GoalReviewRow>
			)}
		</div>
	);
};

export default GoalReviewRows;
