import WizardCloseButton from '@/components/Common/Wizard/WizardCloseButton';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportsStore } from '@/store/reports/useReportsStore';
import { ReportActionMenu } from '../ReportActionMenu';

/**
 * Report wizard header actions: the report's action menu once it is saved, and the close button.
 *
 * @return {JSX.Element} The actions.
 */
export const ReportWizardActions = (): JSX.Element => {
	const reportId = useWizardStore( ( state ) => state.wizard.id );
	const closeWizard = useWizardStore( ( state ) => state.closeWizard );
	const reports = useReportsStore( ( state ) => state.reports );
	const currentReport = reports.find( ( r ) => r.id === reportId );

	return (
		<>
			{currentReport && null !== currentReport.id && <ReportActionMenu row={currentReport} />}
			<WizardCloseButton onClose={() => closeWizard()} dataTour="wizard-close" />
		</>
	);
};
