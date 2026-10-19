import WizardStepBar from '@/components/Common/Wizard/WizardStepBar';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';

/**
 * Step bar of the report wizard. Steps become clickable once the report exists.
 *
 * @return {JSX.Element} The step bar.
 */
export const Steps = (): JSX.Element => {
	const steps = useReportConfigStore( ( state ) => state.steps );
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const setCurrentStep = useWizardStore( ( state ) => state.setCurrentStep );
	const reportId = useWizardStore( ( state ) => state.wizard.id );

	return <WizardStepBar steps={steps} currentStep={currentStep} isClickable={null !== reportId} onSelect={setCurrentStep} />;
};
