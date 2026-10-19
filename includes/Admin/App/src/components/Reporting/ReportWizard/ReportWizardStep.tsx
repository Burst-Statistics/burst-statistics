import React from 'react';
import { StepCreate } from '@/components/Reporting/ReportWizard/Steps/StepCreate';
import { StepContent } from '@/components/Reporting/ReportWizard/Steps/StepContent';
import { StepRecipients } from '@/components/Reporting/ReportWizard/Steps/StepRecipients';
import { StepReview } from '@/components/Reporting/ReportWizard/Steps/StepReview';
import { useWizardStore } from '@/store/reports/useWizardStore';
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

/**
 * The content of the current step; only steps the report config defines are shown.
 *
 * @return {JSX.Element | null} The step content, or null for a step the config does not define.
 */
export const ReportWizardStep = (): JSX.Element | null => {
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const steps = useReportConfigStore( ( state ) => state.steps );
	const StepComponent = STEP_COMPONENTS[ currentStep ];

	if ( ! StepComponent || ! steps.some( ( step ) => step.number === currentStep ) ) {
		return null;
	}

	return <StepComponent />;
};
