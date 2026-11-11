import { __ } from '@wordpress/i18n';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';

interface GoalNeedsSetupButtonProps {
	goalId: number;

	// What is missing, when that is more specific than "Needs setup".
	label?: string;
}

/**
 * Prompt on a goal that is not finished yet. Opens the wizard on what is missing.
 *
 * @param {GoalNeedsSetupButtonProps} props         Component props.
 * @param {number}                    props.goalId  The goal.
 * @param {string}                    [props.label] What is missing, defaults to "Needs setup".
 * @return {JSX.Element} The button.
 */
const GoalNeedsSetupButton = ({ goalId, label }: GoalNeedsSetupButtonProps ): JSX.Element => {
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );

	return (
		<button
			type="button"
			className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-yellow-50 text-text-black cursor-pointer hover:underline"
			onClick={() => openWizard( goalId, GOAL_STEP.TARGET )}
		>
			{label ?? __( 'Needs setup', 'burst-statistics' )}
		</button>
	);
};

export default GoalNeedsSetupButton;
