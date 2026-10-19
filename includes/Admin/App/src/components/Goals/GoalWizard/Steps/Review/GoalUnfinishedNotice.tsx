import { __ } from '@wordpress/i18n';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';

/**
 * Tells the user an unfinished goal cannot count yet, with a way back to finish it.
 *
 * @return {JSX.Element} The notice.
 */
const GoalUnfinishedNotice = (): JSX.Element => {
	const setCurrentStep = useGoalWizardStore( ( state ) => state.setCurrentStep );

	return (
		<div className="flex flex-col items-start gap-2 rounded-lg bg-yellow-50 p-4">
			<p className="text-base text-text-black">
				{__( 'This goal is not finished yet, so it cannot count conversions.', 'burst-statistics' )}
			</p>

			<button type="button" className="text-sm text-wp-blue hover:underline" onClick={() => setCurrentStep( GOAL_STEP.TARGET )}>
				{__( 'Finish setup', 'burst-statistics' )}
			</button>
		</div>
	);
};

export default GoalUnfinishedNotice;
