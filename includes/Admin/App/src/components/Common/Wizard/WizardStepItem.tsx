import { __, sprintf } from '@wordpress/i18n';
import { clsx } from 'clsx';
import WizardStepIndicator, { getStepState } from './WizardStepIndicator';
import WizardStepLabel from './WizardStepLabel';

export interface WizardStep {
	number: number;
	label: string;

	// Show the label as code, e.g. a CSS selector chosen on this step.
	isCode?: boolean;
}

interface WizardStepItemProps {
	step: WizardStep;
	currentStep: number;
	isClickable: boolean;
	onSelect: ( stepNumber: number ) => void;

	// 1-based place in the bar, shown in the circle; without it the step shows a "Step N" caption instead.
	position?: number;
}

/**
 * One step in the wizard's step bar: its indicator, number and label.
 *
 * @param {WizardStepItemProps} props             Component props.
 * @param {WizardStep}          props.step        The step.
 * @param {number}              props.currentStep The step the user is on.
 * @param {boolean}             props.isClickable Whether the user may jump to this step.
 * @param {Function}            props.onSelect    Called with the step number when clicked.
 * @param {number}              props.position    Optional place in the bar, shown in the circle.
 * @return {JSX.Element} The step.
 */
const WizardStepItem = ({ step, currentStep, isClickable, onSelect, position }: WizardStepItemProps ): JSX.Element => {
	const isNumbered = undefined !== position;

	return (
		<div
			className={clsx(
				'flex items-center gap-2 rounded-md p-2 transition-all duration-300 ease-in-out group',
				isClickable ? 'cursor-pointer hover:bg-gray-200' : 'cursor-not-allowed'
			)}
			onClick={() => isClickable && onSelect( step.number )}
		>
			<WizardStepIndicator stepNumber={step.number} currentStep={currentStep} position={position} />

			<div className="flex flex-col max-sm:hidden">
				{! isNumbered && (
					<p className="text-xs text-text-gray-light uppercase tracking-[0.05em] whitespace-nowrap">
						{/* translators: %d: step number. */}
						{sprintf( __( 'Step %d', 'burst-statistics' ), step.number )}
					</p>
				)}

				<WizardStepLabel label={step.label} isCode={step.isCode} state={getStepState( step.number, currentStep )} isNumbered={isNumbered} />
			</div>
		</div>
	);
};

export default WizardStepItem;
