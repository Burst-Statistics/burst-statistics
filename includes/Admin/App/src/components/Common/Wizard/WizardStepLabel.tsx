import { clsx } from 'clsx';
import type { StepState } from './WizardStepIndicator';

// The current step's label reads darker than the others.
const STATE_CLASSES: Record<StepState, string> = {
	done: 'font-medium text-text-gray-light',
	current: 'font-medium text-text-gray',
	upcoming: 'font-medium text-text-gray-light'
};

interface WizardStepLabelProps {
	label: string;

	// Show the label as code, e.g. a CSS selector chosen on this step.
	isCode?: boolean;
	state: StepState;
}

/**
 * A step's label in the step bar; a label shown as code is cut off with its full text in a tooltip.
 *
 * @param {WizardStepLabelProps} props            Component props.
 * @param {string}               props.label      The step's label.
 * @param {boolean}              props.isCode     Whether to show the label as code.
 * @param {StepState}            props.state      Where the step stands relative to the current step.
 * @return {JSX.Element} The label.
 */
const WizardStepLabel = ({ label, isCode = false, state }: WizardStepLabelProps ): JSX.Element => (
	<p
		className={clsx(
			'text-md whitespace-nowrap transition-all duration-300 ease-in-out group-hover:text-text-gray',
			isCode && 'font-mono text-sm max-w-[20ch] truncate',
			STATE_CLASSES[ state ]
		)}
		title={isCode ? label : undefined}
	>
		{label}
	</p>
);

export default WizardStepLabel;
