import { clsx } from 'clsx';
import type { StepState } from './WizardStepIndicator';

// Without numbers, the current step's label reads darker than the others.
const PLAIN_CLASSES: Record<StepState, string> = {
	done: 'font-medium text-text-gray-light',
	current: 'font-medium text-text-gray',
	upcoming: 'font-medium text-text-gray-light'
};

// With numbers, the current step is bold, finished steps stay readable and upcoming ones recede.
const NUMBERED_CLASSES: Record<StepState, string> = {
	done: 'text-text-gray',
	current: 'font-semibold text-text-black',
	upcoming: 'text-text-gray-light'
};

interface WizardStepLabelProps {
	label: string;

	// Show the label as code, e.g. a CSS selector chosen on this step.
	isCode?: boolean;
	state: StepState;
	isNumbered: boolean;
}

/**
 * A step's label in the step bar; a label shown as code is cut off with its full text in a tooltip.
 *
 * @param {WizardStepLabelProps} props            Component props.
 * @param {string}               props.label      The step's label.
 * @param {boolean}              props.isCode     Whether to show the label as code.
 * @param {StepState}            props.state      Where the step stands relative to the current step.
 * @param {boolean}              props.isNumbered Whether the step bar numbers its steps.
 * @return {JSX.Element} The label.
 */
const WizardStepLabel = ({ label, isCode = false, state, isNumbered }: WizardStepLabelProps ): JSX.Element => (
	<p
		className={clsx(
			'text-md whitespace-nowrap transition-all duration-300 ease-in-out group-hover:text-text-gray',
			isCode && 'font-mono text-sm max-w-[20ch] truncate',
			( isNumbered ? NUMBERED_CLASSES : PLAIN_CLASSES )[ state ]
		)}
		title={isCode ? label : undefined}
	>
		{label}
	</p>
);

export default WizardStepLabel;
