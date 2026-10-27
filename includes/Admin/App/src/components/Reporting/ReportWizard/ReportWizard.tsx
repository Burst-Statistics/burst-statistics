import React, { useState } from 'react';
import { Steps } from '@/components/Reporting/ReportWizard/Steps';
import { StepControls } from '@/components/Reporting/ReportWizard/StepControls';
import { LivePreview } from '@/components/Reporting/ReportWizard/LivePreview';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { FormProvider, useForm } from 'react-hook-form';
import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';
import WizardSheet from '@/components/Common/Wizard/WizardSheet';
import WizardHeader from '@/components/Common/Wizard/WizardHeader';
import WizardMobileTabs from '@/components/Common/Wizard/WizardMobileTabs';
import WizardStepTransition from '@/components/Common/Wizard/WizardStepTransition';
import { NameInput } from './NameInput';
import { ReportWizardActions } from './ReportWizardActions';
import { ReportWizardStep } from './ReportWizardStep';

type MobileTab = 'form' | 'preview';

/**
 * Width and visibility of the form and preview columns: the editor gives the preview most of the width,
 * and below lg only the column of the active tab shows.
 *
 * @param {boolean}   isEditingMode Whether the report editor is open.
 * @param {MobileTab} mobileTab     The active tab below lg.
 * @return {{form: string, preview: string}} Classes for each column.
 */
const getColumnClasses = ( isEditingMode: boolean, mobileTab: MobileTab ): { form: string; preview: string } => ({
	form: clsx( isEditingMode ? 'lg:basis-1/5' : 'lg:basis-2/5', 'form' === mobileTab ? 'w-full flex-1' : 'max-lg:hidden' ),
	preview: clsx( isEditingMode ? 'lg:basis-4/5' : 'lg:basis-3/5', 'preview' === mobileTab ? 'w-full flex-1' : 'max-lg:hidden' )
});

/**
 * Full-screen sheet to create or edit a report step by step, with a live preview.
 *
 * @return {JSX.Element} The report wizard.
 */
const ReportWizard: React.FC = () => {
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const [ mobileTab, setMobileTab ] = useState<MobileTab>( 'form' );
	const columnClasses = getColumnClasses( isEditingMode, mobileTab );

	const methods = useForm({
		mode: 'onSubmit',
		reValidateMode: 'onChange',
		shouldUnregister: true,
		shouldFocusError: true
	});

	return (
		<FormProvider {...methods}>
			<WizardSheet id="report-wizard-modal">
				<WizardHeader
					name={<NameInput />}
					steps={<Steps />}
					actions={<ReportWizardActions />}
				/>

				<WizardMobileTabs<MobileTab>
					tabs={[
						{ id: 'form', label: __( 'Form', 'burst-statistics' ) },
						{ id: 'preview', label: isEditingMode ? __( 'Editor Preview', 'burst-statistics' ) : __( 'Live Preview', 'burst-statistics' ) }
					]}
					activeTab={mobileTab}
					onChange={setMobileTab}
				/>

				{/* Main content div */}
				<div className="flex flex-1 min-h-0 overflow-x-hidden">
					{/* Steps and stepcontrols div */}
					<div className={clsx( 'flex flex-col gap-8 min-h-0 transition-all duration-300 ease-in-out', columnClasses.form )}>
						{/* scrollable div */}
						<div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden burst-scroll">
							<WizardStepTransition step={currentStep}>
								<ReportWizardStep step={currentStep} />
							</WizardStepTransition>
						</div>
					</div>
					{/* Live preview div */}
					<div className={clsx( 'flex flex-col min-h-0 pt-4 overflow-hidden transition-all duration-300 ease-in-out', columnClasses.preview )}>
						<LivePreview />
					</div>
				</div>
				<div className="shrink-0">
					<StepControls />
				</div>
			</WizardSheet>
		</FormProvider>
	);
};

export default ReportWizard;
