import React, { useRef } from 'react';
import { Steps } from '@/components/Reporting/ReportWizard/Steps';
import { StepControls } from '@/components/Reporting/ReportWizard/StepControls';
import { LivePreview } from '@/components/Reporting/ReportWizard/LivePreview';
import { StepCreate } from '@/components/Reporting/ReportWizard/Steps/StepCreate';
import { StepContent } from '@/components/Reporting/ReportWizard/Steps/StepContent';
import { StepRecipients } from '@/components/Reporting/ReportWizard/Steps/StepRecipients';
import { StepReview } from '@/components/Reporting/ReportWizard/Steps/StepReview';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { useReportsStore } from '@/store/reports/useReportsStore';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { FormProvider, useForm } from 'react-hook-form';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { NameInput } from './NameInput';
import { ReportActionMenu } from '../ReportActionMenu';

type Direction = 1 | -1;

interface StepVariants extends Variants {
	enter: ( direction: Direction ) => {
		opacity: number;
		x: number;
	};
	center: {
		opacity: number;
		x: number;
	};
	exit: ( direction: Direction ) => {
		opacity: number;
		x: number;
	};
}

/**
 * Mapping of step numbers to their respective components.
 */
const STEP_COMPONENTS: Record<number, React.FC> = {
	1: StepCreate,
	2: StepContent,
	3: StepRecipients,
	4: StepReview
};

const ReportWizard: React.FC = () => {
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const reportId = useWizardStore( ( state ) => state.wizard.id );
	const closeWizard = useWizardStore( ( state ) => state.closeWizard );
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const steps = useReportConfigStore( ( state ) => state.steps );

	const reports = useReportsStore( ( state ) => state.reports );
	const currentReport = reports.find( ( r ) => r.id === reportId );

	const previousStep = useRef<number>( currentStep );
	const direction: Direction = currentStep > previousStep.current ? 1 : -1;
	previousStep.current = currentStep;

	const variants: StepVariants = {
		enter: ( direction: Direction ) => ({
			opacity: 0,
			x: 0 < direction ? 40 : -40
		}),
		center: {
			opacity: 1,
			x: 0
		},
		exit: ( direction: Direction ) => ({
			opacity: 0,
			x: 0 < direction ? -40 : 40
		})
	};

	const methods = useForm({
		mode: 'onSubmit',
		reValidateMode: 'onChange',
		shouldUnregister: true,
		shouldFocusError: true
	});

	return (
		<FormProvider {...methods}>
			<motion.div
				id="report-wizard-modal"
				className="fixed inset-0 left-[160px] max-[960px]:left-9 max-[782px]:left-0 z-50 bg-gray-800 bg-opacity-90 flex items-end justify-center px-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15, ease: 'easeOut' }}
			>
				<motion.div
					initial={{ opacity: 0, y: 500, scale: 0.7 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 500, scale: 0.7 }}
					transition={{
						delay: 0.1,
						y: {
							type: 'spring',
							stiffness: 135,
							damping: 18,
							mass: 0.45
						},
						opacity: {
							duration: 0.18,
							ease: 'easeOut'
						}
					}}
					className="w-full h-[96vh] max-h-[96vh] max-w-screen-2xl"
				>
					{/* inside container div */}
					<div className="h-full bg-gray-100 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
						{/* Title, steps progress and close button div. Steps should be perfectly in the middle using css grid. But should become resposive when too small.*/}
						<div className="grid grid-cols-12 items-center justify-between gap-4 px-6 py-4">
							<div className="col-span-3">
								<NameInput />
							</div>
							<div className="col-span-6">
								<Steps />
							</div>
							<div className="col-span-3 flex items-center justify-end gap-3">
								{! currentReport || null !== currentReport.id && <ReportActionMenu row={currentReport} />}
								<button type="button" className="bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2" onClick={() => {
									closeWizard();
								}}
								aria-label={__( 'Close', 'burst-statistics' )}
								>
								<Icon name="times" />
							</button>
							</div>
						</div>

						{/* Main content div */}
						<div className="flex flex-1 min-h-0 overflow-x-hidden">
							{/* Steps and stepcontrols div */}
							<div className={`${isEditingMode ? 'basis-1/5' : 'basis-2/5'} flex flex-col gap-8 max-xl:basis-full min-h-0 transition-all duration-300 ease-in-out`}>
								{/* scrollable div */}
								<div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden burst-scroll">
									<AnimatePresence mode="wait" custom={direction}>
										{steps.map( ( step ) => {
											const StepComponent = STEP_COMPONENTS[step.number];

											if ( ! StepComponent || currentStep !== step.number ) {
												return null;
											}

											return (
												<motion.div
													key={`step${step.number}-content`}
													custom={direction}
													variants={variants}
													initial="enter"
													animate="center"
													exit="exit"
													transition={{ duration: 0.35, ease: [ 0.16, 1, 0.3, 1 ] }}
												>
													<StepComponent />
												</motion.div>
											);
										})}
									</AnimatePresence>
								</div>
							</div>
							{/* Live preview div */}
							<div className={`${isEditingMode ? 'basis-4/5' : 'basis-3/5'} flex flex-col min-h-0 pt-4 overflow-hidden transition-all duration-300 ease-in-out`}>
								<LivePreview />
							</div>
						</div>
						<div className="shrink-0">
							<StepControls />
						</div>
					</div>
				</motion.div>
			</motion.div>
		</FormProvider>
	);
};

export default ReportWizard;
