import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import Icon from '@/utils/Icon';

interface WizardStepIndicatorProps {
	stepNumber: number;
	currentStep: number;
}

export type StepState = 'done' | 'current' | 'upcoming';

// The circle fills once the step is reached.
const STATE_CLASSES: Record<StepState, string> = {
	done: 'bg-green-50 border-green',
	current: 'bg-green-50 border-green',
	upcoming: 'border-gray-400 bg-gray-200'
};

/**
 * Where a step stands relative to the step the user is on.
 *
 * @param {number} stepNumber  This step's number.
 * @param {number} currentStep The step the user is on.
 * @return {StepState} The step's state.
 */
export const getStepState = ( stepNumber: number, currentStep: number ): StepState => {
	if ( stepNumber < currentStep ) {
		return 'done';
	}
	return stepNumber === currentStep ? 'current' : 'upcoming';
};

/**
 * The circle in front of a step: filled once reached, with a check once done.
 *
 * @param {WizardStepIndicatorProps} props             Component props.
 * @param {number}                   props.stepNumber  This step's number.
 * @param {number}                   props.currentStep The step the user is on.
 * @return {JSX.Element} The indicator.
 */
const WizardStepIndicator = ({ stepNumber, currentStep }: WizardStepIndicatorProps ): JSX.Element => {
	const state = getStepState( stepNumber, currentStep );

	return (
		<div
			className={clsx(
				'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 ease-in-out',
				STATE_CLASSES[ state ]
			)}
		>
			{'done' === state && (
				<motion.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: 'spring', stiffness: 120, damping: 14 }}
				>
					<Icon strokeWidth={2} name="check" size={18} className="w-4 h-4" color="green" />
				</motion.div>
			)}
		</div>
	);
};

export default WizardStepIndicator;
