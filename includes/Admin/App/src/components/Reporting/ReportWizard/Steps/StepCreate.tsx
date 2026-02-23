import React from 'react';
import { Formats } from '@/components/Reporting/ReportWizard/Formats';
import { Schedule } from '../Schedule';

/**
 * Step 1: Create - Report format selection.
 */
export const StepCreate: React.FC = () => {
	return (
		<>
			<Formats />
			<Schedule />
		</>
	);
};
