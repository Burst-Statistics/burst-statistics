import { useRef } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

type Direction = 1 | -1;

// Content slides in from the side the user is heading to.
const STEP_VARIANTS: Variants = {
	enter: ( direction: Direction ) => ({ opacity: 0, x: 0 < direction ? 40 : -40 }),
	center: { opacity: 1, x: 0 },
	exit: ( direction: Direction ) => ({ opacity: 0, x: 0 < direction ? -40 : 40 })
};

/**
 * Which way the wizard moved since the last render: forward or back.
 *
 * @param {number} step The current step.
 * @return {Direction} 1 when moving forward, -1 when moving back.
 */
const useStepDirection = ( step: number ): Direction => {
	const previousStep = useRef<number>( step );
	const direction: Direction = step > previousStep.current ? 1 : -1;
	previousStep.current = step;
	return direction;
};

interface WizardStepTransitionProps {
	step: number;

	// The step's content, or null when the step has none.
	children: ReactNode;
}

/**
 * Slides the content of a wizard step out and the next one in, in the direction the user moves.
 *
 * @param {WizardStepTransitionProps} props          Component props.
 * @param {number}                    props.step     The current step.
 * @param {ReactNode}                 props.children The step's content.
 * @return {JSX.Element} The animated step content.
 */
const WizardStepTransition = ({ step, children }: WizardStepTransitionProps ): JSX.Element => {
	const direction = useStepDirection( step );

	return (
		<AnimatePresence mode="wait" custom={direction}>
			{children && (
				<motion.div
					key={`step${step}-content`}
					custom={direction}
					variants={STEP_VARIANTS}
					initial="enter"
					animate="center"
					exit="exit"
					transition={{ duration: 0.35, ease: [ 0.16, 1, 0.3, 1 ] }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default WizardStepTransition;
