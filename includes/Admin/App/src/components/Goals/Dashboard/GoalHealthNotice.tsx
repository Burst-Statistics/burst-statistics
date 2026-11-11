import { __, sprintf } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';
import { formatUnixToDate } from '@/utils/formatting';

interface GoalHealthNoticeProps {
	goalId: number;

	// Unix timestamp of the goal's last conversion.
	since: number;
}

/**
 * Explains why a goal stopped counting, with the way to check it.
 *
 * @param {GoalHealthNoticeProps} props        Component props.
 * @param {number}                props.goalId The goal.
 * @param {number}                props.since  Time of the last conversion.
 * @return {JSX.Element} The notice.
 */
const GoalHealthNotice = ({ goalId, since }: GoalHealthNoticeProps ): JSX.Element => {
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );

	return (
		<div className="flex flex-col items-start gap-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 sm:flex-row sm:items-center">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
				<Icon name="warning" color="currentColor" size={20} />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-base font-semibold text-text-black">
					{sprintf(

						/* translators: %s: date of the goal's last conversion. */
						__( 'Not counting since %s', 'burst-statistics' ),
						formatUnixToDate( since )
					)}
				</p>
				<p className="text-sm text-text-gray">
					{__( 'Its page still gets visitors, so this is a tracking problem, not a traffic one. The element or page may have changed.', 'burst-statistics' )}
				</p>
			</div>
			<ButtonInput btnVariant="tertiary" type="button" className="shrink-0" onClick={() => openWizard( goalId, GOAL_STEP.TARGET )}>
				{__( 'Check the goal', 'burst-statistics' )}
			</ButtonInput>
		</div>
	);
};

export default GoalHealthNotice;
