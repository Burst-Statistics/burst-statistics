import React from 'react';
import { StepContentClassic } from '@/components/Reporting/ReportWizard/Steps/StepContentClassic';
import { StepContentStory } from '@/components/Reporting/ReportWizard/Steps/StepContentStory';
import { useWizardStore } from '@/store/reports/useWizardStore';

/**
 * Step 2: Content - Content block selection router.
 * Routes to the appropriate content selection component based on report format.
 */
export const StepContent: React.FC = () => {
	const format = useWizardStore( ( state ) => state.wizard.format );

	if ( 'story' === format ) {
		return <StepContentStory />;
	}

	return <StepContentClassic />;
};
