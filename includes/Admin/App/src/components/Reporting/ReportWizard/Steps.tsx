import { __, sprintf } from '@wordpress/i18n';
import React from 'react';
import Icon from '@/utils/Icon';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';

export const Steps = () => {
	const steps = useReportConfigStore( ( state ) => state.steps );
	const currentStep = useWizardStore( ( state ) => state.wizard.currentStep );
	const setCurrentStep = useWizardStore( ( state ) => state.setCurrentStep );
	const { wizard } = useWizardStore();
	const reportId = wizard.id;

	const canNavigateToStep = () =>
		null !== reportId;

	return (
		<div className="flex items-center justify-between">
			{steps.map( ( step, idx ) => {
				const isClickable = canNavigateToStep();

				return (
					<React.Fragment key={step.number}>
						<div
							className={`flex items-center gap-2 rounded-md p-2 transition-all duration-300 ease-in-out group ${
								isClickable ? 'cursor-pointer hover:bg-gray-200' : 'cursor-not-allowed'
							}`}
							onClick={ () => {
								if ( isClickable ) {
									setCurrentStep( step.number );
								}
							} }
						>
							<div
								className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 ease-in-out ${
									step.number <= currentStep ?
										'bg-brand-lightest border-brand' :
										'border-gray-400 bg-gray-200'
								}`}
							>
								{step.number < currentStep && (
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{
											type: 'spring',
											stiffness: 120,
											damping: 14
										}}
									>
										<Icon
											strokeWidth={2}
											name="check"
											size={18}
											className="w-4 h-4"
											color="green"
										/>
									</motion.div>
								)}
							</div>

							<div className="flex flex-col">
								<p className="text-xs text-gray-600 uppercase tracking-[0.05em] whitespace-nowrap">
									{sprintf( __( 'Step %d', 'burst-statistics' ), step.number )}
								</p>

								<p className={clsx( 'text-md font-medium whitespace-nowrap transition-all duration-300 ease-in-out group-hover:text-gray-700', step.number === currentStep ? 'text-gray-700' : 'text-gray-500' )}>
									{step.label}
								</p>
							</div>
						</div>

						{idx < steps.length - 1 && (
							<div className="md:block h-0.5 w-full mx-5 bg-gray-300 rounded-xs" />
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
};

