import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import useEscapeToClose from '@/components/Common/Wizard/useEscapeToClose';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';
import { getBlockingHint } from '@/components/Goals/goalText';
import useWizardGoal from './useWizardGoal';
import useCloseGoalWizard from './useCloseGoalWizard';
import useGoalWizardSave from './useGoalWizardSave';
import GoalWizardPrimaryAction from './GoalWizardPrimaryAction';

/**
 * Footer of the goal wizard: cancel or back on the left, the step's main action on the right.
 *
 * @return {JSX.Element} The controls.
 */
const GoalWizardControls = (): JSX.Element => {
	const goal = useWizardGoal();
	const currentStep = useGoalWizardStore( ( state ) => state.currentStep );
	const prevStep = useGoalWizardStore( ( state ) => state.prevStep );
	const handleClose = useCloseGoalWizard();
	const save = useGoalWizardSave( goal );

	const isFirstStep = GOAL_STEP.START === currentStep;
	const blockingHint = getBlockingHint( goal, currentStep );

	useEscapeToClose( isFirstStep, handleClose );

	return (
		<div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 sm:px-10 py-3 sm:py-4">
			{goal && ! isFirstStep ? (
				<ButtonInput btnVariant="tertiary" type="button" onClick={() => prevStep( goal.type )} disabled={save.isSaving}>
					{__( 'Back', 'burst-statistics' )}
				</ButtonInput>
			) : (
				<ButtonInput btnVariant="tertiary" type="button" onClick={handleClose}>
					{__( 'Cancel', 'burst-statistics' )}
				</ButtonInput>
			)}

			<div className="flex flex-wrap gap-2 items-center justify-center sm:justify-end">
				{blockingHint && <span className="text-sm text-text-gray">{blockingHint}</span>}
				<GoalWizardPrimaryAction goal={goal} isBlocked={'' !== blockingHint} save={save} />
			</div>
		</div>
	);
};

export default GoalWizardControls;
