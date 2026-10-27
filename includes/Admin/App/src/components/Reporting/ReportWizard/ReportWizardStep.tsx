import React from 'react';
import { StepCreate } from '@/components/Reporting/ReportWizard/Steps/StepCreate';
import { StepContent } from '@/components/Reporting/ReportWizard/Steps/StepContent';
import { StepRecipients } from '@/components/Reporting/ReportWizard/Steps/StepRecipients';
import { StepReview } from '@/components/Reporting/ReportWizard/Steps/StepReview';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';

/**
 * Mapping of step numbers to their respective components.
 */
const STEP_COMPONENTS: Record<number, React.FC> = {
	1: StepCreate,
	2: StepContent,
	3: StepRecipients,
	4: StepReview
};

interface ReportWizardStepProps {

	// The step to render. Passed in rather than read from the wizard store: the step transition keeps the
	// outgoing step on screen during its exit animation, and that copy must keep showing its own step.
	step: number;
}

/**
 * The content of a wizard step; only steps the report config defines are shown.
 *
 * @param {ReportWizardStepProps} props      Component props.
 * @param {number}                props.step The step to render.
 * @return {JSX.Element | null} The step content, or null for a step the config does not define.
 */
export const ReportWizardStep = ({ step }: ReportWizardStepProps ): JSX.Element | null => {
	const steps = useReportConfigStore( ( state ) => state.steps );
	const StepComponent = STEP_COMPONENTS[ step ];

	if ( ! StepComponent || ! steps.some( ( configStep ) => configStep.number === step ) ) {
		return null;
	}

	return <StepComponent />;
};
