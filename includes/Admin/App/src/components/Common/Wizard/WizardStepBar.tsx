import { Fragment } from 'react';
import { clsx } from 'clsx';
import WizardStepItem from './WizardStepItem';
import type { WizardStep } from './WizardStepItem';

interface WizardStepBarProps {
	steps: WizardStep[];
	currentStep: number;

	// Steps can only be jumped to once what the wizard creates exists.
	isClickable: boolean;
	onSelect: ( stepNumber: number ) => void;

	// Number the circles and colour the line behind finished steps.
	isNumbered?: boolean;
}

/**
 * The wizard's steps in a row, joined by lines.
 *
 * @param {WizardStepBarProps} props             Component props.
 * @param {WizardStep[]}       props.steps       The steps, in order.
 * @param {number}             props.currentStep The step the user is on.
 * @param {boolean}            props.isClickable Whether the user may jump between steps.
 * @param {Function}           props.onSelect    Called with the step number the user clicked.
 * @param {boolean}            props.isNumbered  Whether to number the circles.
 * @return {JSX.Element} The step bar.
 */
const WizardStepBar = ({ steps, currentStep, isClickable, onSelect, isNumbered = false }: WizardStepBarProps ): JSX.Element => (
	<div className="flex items-center justify-between">
		{steps.map( ( step, idx ) => (
			<Fragment key={step.number}>
				<WizardStepItem
					step={step}
					currentStep={currentStep}
					isClickable={isClickable}
					onSelect={onSelect}
					position={isNumbered ? idx + 1 : undefined}
				/>
				{idx < steps.length - 1 && (
					<div className={clsx( 'h-0.5 w-full mx-1 sm:mx-3 md:mx-5 rounded-xs min-w-[8px]', isNumbered && step.number < currentStep ? 'bg-green' : 'bg-gray-300' )} />
				)}
			</Fragment>
		) )}
	</div>
);

export default WizardStepBar;
