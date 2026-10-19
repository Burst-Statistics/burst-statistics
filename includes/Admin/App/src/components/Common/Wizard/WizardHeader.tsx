import type { ReactNode } from 'react';

interface WizardHeaderProps {

	// Editable name of what the wizard creates.
	name: ReactNode;

	// The step bar.
	steps: ReactNode;

	// Buttons on the right, at least the close button.
	actions: ReactNode;
}

/**
 * Wizard header: name and actions on top with the steps below on small screens, all in one row from lg up.
 *
 * @param {WizardHeaderProps} props         Component props.
 * @param {ReactNode}         props.name    The name input.
 * @param {ReactNode}         props.steps   The step bar.
 * @param {ReactNode}         props.actions The action buttons.
 * @return {JSX.Element} The header.
 */
const WizardHeader = ({ name, steps, actions }: WizardHeaderProps ): JSX.Element => (
	<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
		<div className="flex items-center justify-between w-full lg:w-auto gap-4">
			<div className="shrink min-w-0 max-w-[200px] sm:max-w-xs">{name}</div>
			<div className="flex items-center justify-end gap-2 shrink-0 lg:hidden">{actions}</div>
		</div>

		<div className="flex-1 flex justify-center min-w-0 w-full lg:w-auto pt-2 lg:pt-0 border-t border-gray-200 lg:border-t-0">
			{steps}
		</div>

		<div className="hidden lg:flex items-center justify-end gap-2 shrink-0 z-10">{actions}</div>
	</div>
);

export default WizardHeader;
