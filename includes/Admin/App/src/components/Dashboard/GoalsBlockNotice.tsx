import { useNavigate } from '@tanstack/react-router';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { getGoalsBlockNotice } from './getGoalsBlockNotice';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalsBlockNoticeProps {
	goals: Goal[];

	// Selected goal id, or 'all'.
	goalId: string | number;
}

/**
 * Explains on the dashboard why goals are not counting, with a way to fix it.
 *
 * @param {GoalsBlockNoticeProps} props Component props.
 * @return {JSX.Element | null} The notice, or null when nothing needs attention.
 */
const GoalsBlockNotice = ({ goals, goalId }: GoalsBlockNoticeProps ): JSX.Element | null => {
	const navigate = useNavigate();
	const notice = getGoalsBlockNotice( goals, goalId );

	if ( ! notice ) {
		return null;
	}

	const canManage = Boolean( window.burst_settings?.manage_burst_statistics );

	const handleAction = () => {
		const { openWizard } = useGoalWizardStore.getState();

		// Only a new goal or a specific goal needs the wizard; "Manage goals" just shows the list.
		if ( 0 === goals.length ) {
			openWizard();
		} else if ( undefined !== notice.goalId ) {
			openWizard( notice.goalId, notice.step );
		}
		navigate({ to: '/goals' });
	};

	return (
		<div className="flex flex-col items-start gap-3 bg-yellow-50 px-2.5 py-4 md:px-6">
			<p className="text-sm text-text-black">{notice.text}</p>
			{canManage && (
				<ButtonInput btnVariant="tertiary" size="sm" type="button" onClick={handleAction}>
					{notice.action}
				</ButtonInput>
			)}
		</div>
	);
};

export default GoalsBlockNotice;
