import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import type { GoalWizardSave } from './useGoalWizardSave';
import GoalWizardFinishButtons from './GoalWizardFinishButtons';

interface GoalWizardPrimaryActionProps {

	// The goal being edited, null before it is created.
	goal: Goal | null;

	// Whether something is missing before the user can continue.
	isBlocked: boolean;
	save: GoalWizardSave;
}

/**
 * The main action of the current step: continue, or save the goal on the last step.
 *
 * Presets add their goal from the preset list, so the first step has no button for them.
 *
 * @param {GoalWizardPrimaryActionProps} props           Component props.
 * @param {Goal | null}                  props.goal      The goal being edited.
 * @param {boolean}                      props.isBlocked Whether something is missing before continuing.
 * @param {GoalWizardSave}               props.save      The save state and actions.
 * @return {JSX.Element | null} The buttons, or null when the step has none.
 */
const GoalWizardPrimaryAction = ({ goal, isBlocked, save }: GoalWizardPrimaryActionProps ): JSX.Element | null => {
	const currentStep = useGoalWizardStore( ( state ) => state.currentStep );
	const startMode = useGoalWizardStore( ( state ) => state.startMode );

	if ( ! goal ) {
		return 'custom' === startMode ? (
			<ButtonInput btnVariant="secondary" type="button" onClick={save.createGoal} disabled={save.isSaving} data-tour="goal-wizard-primary-btn">
				{__( 'Continue', 'burst-statistics' )}
			</ButtonInput>
		) : null;
	}

	if ( GOAL_STEP.REVIEW === currentStep ) {
		return <GoalWizardFinishButtons goal={goal} save={save} />;
	}

	return (
		<ButtonInput btnVariant="secondary" type="button" onClick={save.saveGoal} disabled={save.isSaving || isBlocked} data-tour="goal-wizard-primary-btn">
			{__( 'Continue', 'burst-statistics' )}
		</ButtonInput>
	);
};

export default GoalWizardPrimaryAction;
