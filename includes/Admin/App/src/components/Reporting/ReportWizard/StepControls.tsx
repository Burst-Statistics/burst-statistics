import ButtonInput from '@/components/Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { useReportsStore } from '@/store/reports/useReportsStore';
import { useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { toast } from 'react-toastify';

export const StepControls = () => {
	const { nextStep, prevStep, resetWizard, closeWizard, wizard } = useWizardStore();
	const { currentStep, id: reportId, scheduled } = wizard;

	const saveReportFromWizard = useReportsStore( ( state ) => state.saveReportFromWizard );
	const { steps, stepCount } = useReportConfigStore();
	const { trigger } = useFormContext();

	const isFirstStep = 1 === currentStep;
	const isLastStep = currentStep === stepCount;
	const isReportCreated = null !== reportId;

	// Close wizard on Escape key when on first step.
	const handleClose = useCallback( () => {
		resetWizard();
		closeWizard();
	}, [ resetWizard, closeWizard ]);

	useEffect( () => {
		const onKeyDown = ( e: KeyboardEvent ) => {
			if ( 'Escape' === e.key && isFirstStep ) {
				handleClose();
			}
		};

		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ isFirstStep, handleClose ]);

	// Validates current step fields and saves the report.
	const validateAndSave = useCallback( async() => {
		const currentStepConfig = steps.find( ( step ) => step.number === currentStep );
		const fieldsToValidate = currentStepConfig?.fields ?? [];

		const isValid = await trigger( fieldsToValidate );
		if ( ! isValid ) {
			return null;
		}
		return saveReportFromWizard();
	}, [ trigger, steps, currentStep, saveReportFromWizard ]);

	const handleNext = async() => {
		const response = await validateAndSave();
		if ( null !== response ) {
			nextStep();
		}
	};

	const handleFinalSubmit = async() => {
		const response = await validateAndSave();
		if ( ! response ) {
			toast.error( __( 'Failed to save report', 'burst-statistics' ) );
			return;
		}
		toast.success( __( 'Report saved successfully', 'burst-statistics' ) );
		handleClose();
	};

	const handleSave = async() => {
		const response = await validateAndSave();
		if ( null !== response ) {
			toast.success( __( 'Report saved successfully', 'burst-statistics' ) );
		} else {
			toast.error( __( 'Failed to save report', 'burst-statistics' ) );
		}
	};

	// Render left-side navigation buttons.
	const renderNavButtons = () => {
		if ( isFirstStep && ! isReportCreated ) {
			return (
				<ButtonInput btnVariant="tertiary" onClick={handleClose}>
					{__( 'Cancel create report', 'burst-statistics' )}
				</ButtonInput>
			);
		}

		return (
			<>

				<ButtonInput btnVariant="tertiary" onClick={prevStep} disabled={isFirstStep}>
					{__( 'Previous', 'burst-statistics' )}
				</ButtonInput>

				<ButtonInput btnVariant="tertiary" onClick={nextStep} disabled={isLastStep}>
					{__( 'Next', 'burst-statistics' )}
				</ButtonInput>
			</>
		);
	};

	// Get the appropriate button text for the primary action.
	const getActionButtonText = () => {
		if ( isFirstStep && ! isReportCreated ) {
			return __( 'Create report', 'burst-statistics' );
		}

		if ( isLastStep ) {
			return scheduled ?
				__( 'Schedule and save', 'burst-statistics' ) :
				__( 'Save and close', 'burst-statistics' );
		}

		return __( 'Save and continue', 'burst-statistics' );
	};

	return (
		<div className="relative z-[100] flex justify-center bg-gray-50 px-10 pt-5 pb-4 gap-4 w-full shadow-layered-high-t">
			{/* vertical line grey surounding the buttons */}
			<span className="block h-6 w-px bg-gray-400 mt-1"></span>
			<div className="flex gap-2 max-w-4xl w-full">
				<div className="flex gap-2 flex-1">{renderNavButtons()}</div>
				<div className="flex gap-2 flex-1 justify-end">
					<ButtonInput btnVariant="tertiary" onClick={handleSave}>{__( 'Save', 'burst-statistics' )}</ButtonInput>
					<ButtonInput onClick={isLastStep ? handleFinalSubmit : handleNext}>
						{getActionButtonText()}
					</ButtonInput>
				</div>
			</div>
			<span className="block h-6 w-px bg-gray-400 mt-1"></span>
		</div>
	);
};
