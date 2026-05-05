import React from 'react';
import ClassicContentSelection from '@/components/Reporting/ReportWizard/ClassicContentSelection';

/**
 * Step 2: Content - Classic report content block selection.
 * Shows a simple grid where users can enable/disable blocks using checkboxes.
 */
export const StepContentClassic: React.FC = () => {
	return (
		<div className="px-6 py-2">
			<ClassicContentSelection />
		</div>
	);
};
