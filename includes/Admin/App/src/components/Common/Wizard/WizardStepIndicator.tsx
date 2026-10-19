import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import Icon from '@/utils/Icon';

interface WizardStepIndicatorProps {
	stepNumber: number;
	currentStep: number;

	// Number shown inside the circle until the step is done; without it the circle stays empty.
	position?: number;
}

export type StepState = 'done' | 'current' | 'upcoming';

// The plain circle fills once the step is reached.
const PLAIN_CLASSES: Record<StepState, string> = {
	done: 'bg-green-50 border-green',
	current: 'bg-green-50 border-green',
	upcoming: 'border-gray-400 bg-gray-200'
};

// The numbered circle is solid green once done and inverted while current.
const NUMBERED_CLASSES: Record<StepState, string> = {
	done: 'shrink-0 text-xs font-semibold bg-green border-green',
	current: 'shrink-0 text-xs font-semibold bg-text-black border-text-black text-gray-100',
	upcoming: 'shrink-0 text-xs font-semibold border-gray-400 text-text-gray-light'
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
 * What the circle holds: a check once done, otherwise the step's number when it has one.
 *
 * @param {StepState} state    The step's state.
 * @param {number}    position Optional number to show in the circle.
 * @return {JSX.Element | number | null} The circle's content.
 */
const getIndicatorContent = ( state: StepState, position?: number ): JSX.Element | number | null => {
	if ( 'done' === state ) {
		return (
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: 'spring', stiffness: 120, damping: 14 }}
			>
				<Icon strokeWidth={2} name="check" size={18} className="w-4 h-4" color={undefined === position ? 'green' : 'text-white'} />
			</motion.div>
		);
	}
	return position ?? null;
};

/**
 * The circle in front of a step: filled once reached, with a check once done.
 *
 * @param {WizardStepIndicatorProps} props             Component props.
 * @param {number}                   props.stepNumber  This step's number.
 * @param {number}                   props.currentStep The step the user is on.
 * @param {number}                   props.position    Optional number to show in the circle.
 * @return {JSX.Element} The indicator.
 */
const WizardStepIndicator = ({ stepNumber, currentStep, position }: WizardStepIndicatorProps ): JSX.Element => {
	const state = getStepState( stepNumber, currentStep );

	return (
		<div
			className={clsx(
				'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 ease-in-out',
				( undefined === position ? PLAIN_CLASSES : NUMBERED_CLASSES )[ state ]
			)}
		>
			{getIndicatorContent( state, position )}
		</div>
	);
};

export default WizardStepIndicator;
