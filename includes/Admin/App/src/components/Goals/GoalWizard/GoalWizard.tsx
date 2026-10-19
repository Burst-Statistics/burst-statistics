import React from 'react';
import WizardSheet from '@/components/Common/Wizard/WizardSheet';
import WizardStepTransition from '@/components/Common/Wizard/WizardStepTransition';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import useCloseGoalWizard from './useCloseGoalWizard';
import GoalWizardHeader from './GoalWizardHeader';
import GoalWizardControls from './GoalWizardControls';
import StepStart from './Steps/StepStart';
import StepTarget from './Steps/StepTarget';
import StepCount from './Steps/StepCount';
import StepReview from './Steps/StepReview';

const STEP_COMPONENTS: Record<number, React.FC> = {
	1: StepStart,
	2: StepTarget,
	3: StepCount,
	4: StepReview
};

/**
 * Full-screen sheet to create or edit a goal step by step.
 *
 * @return {JSX.Element} The goal wizard.
 */
const GoalWizard = (): JSX.Element => {
	const currentStep = useGoalWizardStore( ( state ) => state.currentStep );
	const handleClose = useCloseGoalWizard();

	const StepComponent = STEP_COMPONENTS[ currentStep ];

	return (
		<WizardSheet id="goal-wizard-modal">
			<GoalWizardHeader onClose={handleClose} />

			<div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden burst-scroll">
				<div className="mx-auto w-full max-w-5xl">
					<WizardStepTransition step={currentStep}>
						{StepComponent && <StepComponent />}
					</WizardStepTransition>
				</div>
			</div>

			<GoalWizardControls />
		</WizardSheet>
	);
};

export default GoalWizard;
