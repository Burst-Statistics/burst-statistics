import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import { canActivateGoal } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import { getFinishLabel } from '@/components/Goals/goalText';
import type { GoalWizardSave } from './useGoalWizardSave';

interface GoalWizardFinishButtonsProps {
	goal: Goal;
	save: GoalWizardSave;
}

/**
 * The last step's buttons: save the goal as a draft, or save it and start tracking.
 *
 * @param {GoalWizardFinishButtonsProps} props           Component props.
 * @param {Goal}                         props.goal      The goal being saved.
 * @param {GoalWizardSave}               props.save      The save state and actions.
 * @return {JSX.Element} The buttons.
 */
const GoalWizardFinishButtons = ({ goal, save }: GoalWizardFinishButtonsProps ): JSX.Element => {
	const isLimitReached = useIsGoalLimitReached();

	return (
		<>
			<ButtonInput btnVariant="tertiary" type="button" onClick={() => save.finishGoal( false )} disabled={save.isSaving}>
				{__( 'Save as draft', 'burst-statistics' )}
			</ButtonInput>
			<ButtonInput
				btnVariant="secondary"
				type="button"
				onClick={() => save.finishGoal( true )}
				disabled={save.isSaving || ! canActivateGoal( goal, isLimitReached )}
				data-tour="goal-wizard-primary-btn"
			>
				{getFinishLabel( goal )}
			</ButtonInput>
		</>
	);
};

export default GoalWizardFinishButtons;
