import React, { useRef, useState } from 'react';
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
import {
	SHEET_OVERLAY_PROPS,
	SHEET_PANEL_PROPS
} from '@/components/Common/sheetMotionProps';
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

// fallow-ignore-next-line complexity
const ReportWizard: React.FC = () => {
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const reportId = useWizardStore( ( state ) => state.wizard.id );
	const closeWizard = useWizardStore( ( state ) => state.closeWizard );
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const steps = useReportConfigStore( ( state ) => state.steps );

	const reports = useReportsStore( ( state ) => state.reports );
	const currentReport = reports.find( ( r ) => r.id === reportId );

	const [ mobileTab, setMobileTab ] = useState<'form' | 'preview'>( 'form' );

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
				{...SHEET_OVERLAY_PROPS}
				id="report-wizard-modal"
			>
				<motion.div
					{...SHEET_PANEL_PROPS}
				>
					{/* inside container div */}
					<div className="h-full bg-gray-100 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
						{/* Header bar */}
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
							{/* Top row on < lg: Name input on left, action controls on right */}
							<div className="flex items-center justify-between w-full lg:w-auto gap-4">
								<div className="shrink min-w-0 max-w-[200px] sm:max-w-xs">
									<NameInput />
								</div>
								<div className="flex items-center justify-end gap-2 shrink-0 lg:hidden">
									{! currentReport || null !== currentReport.id && <ReportActionMenu row={currentReport} />}
									<button
										type="button"
										className="bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2 sm:p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2 cursor-pointer"
										onClick={() => closeWizard()}
										aria-label={__( 'Close', 'burst-statistics' )}
									>
										<Icon name="times" />
									</button>
								</div>
							</div>

							{/* Steps component: shifted to next line on viewports below 1024px (< lg) */}
							<div className="flex-1 flex justify-center min-w-0 w-full lg:w-auto pt-2 lg:pt-0 border-t border-gray-200 lg:border-t-0">
								<Steps />
							</div>

							{/* Desktop action controls (>= lg) */}
							<div className="hidden lg:flex items-center justify-end gap-2 shrink-0 z-10">
								{! currentReport || null !== currentReport.id && <ReportActionMenu row={currentReport} />}
								<button
									type="button"
									className="bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2 cursor-pointer"
									onClick={() => closeWizard()}
									aria-label={__( 'Close', 'burst-statistics' )}
								>
									<Icon name="times" />
								</button>
							</div>
						</div>

						{/* Mobile tab switcher bar (< lg) */}
						<div className="lg:hidden flex justify-center py-2 px-4 bg-gray-200 border-b border-gray-300 gap-2 shrink-0">
							<button
								type="button"
								onClick={() => setMobileTab( 'form' )}
								className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
									'form' === mobileTab ? 'bg-blue text-white shadow-xs' : 'bg-gray-100 text-text-gray-light hover:text-text-gray'
								}`}
							>
								{__( 'Form', 'burst-statistics' )}
							</button>
							<button
								type="button"
								onClick={() => setMobileTab( 'preview' )}
								className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
									'preview' === mobileTab ? 'bg-blue text-white shadow-xs' : 'bg-gray-100 text-text-gray-light hover:text-text-gray'
								}`}
							>
								{isEditingMode ? __( 'Editor Preview', 'burst-statistics' ) : __( 'Live Preview', 'burst-statistics' )}
							</button>
						</div>

						{/* Main content div */}
						<div className="flex flex-1 min-h-0 overflow-x-hidden">
							{/* Steps and stepcontrols div */}
							<div className={`flex flex-col gap-8 min-h-0 transition-all duration-300 ease-in-out ${isEditingMode ? 'lg:basis-1/5' : 'lg:basis-2/5'} ${'form' === mobileTab ? 'w-full flex-1' : 'max-lg:hidden'}`}>
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
							<div className={`flex flex-col min-h-0 pt-4 overflow-hidden transition-all duration-300 ease-in-out ${isEditingMode ? 'lg:basis-4/5' : 'lg:basis-3/5'} ${'preview' === mobileTab ? 'w-full flex-1' : 'max-lg:hidden'}`}>
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
