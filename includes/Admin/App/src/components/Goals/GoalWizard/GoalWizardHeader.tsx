import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import WizardCloseButton from '@/components/Common/Wizard/WizardCloseButton';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { getGoalTypeIcon } from '@/components/Goals/goalOptions';
import { isGoalCounting } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import useWizardGoal from './useWizardGoal';
import GoalWizardSteps from './GoalWizardSteps';

/**
 * Whether the goal is tracking, in words. An active goal that is not finished does not track either.
 *
 * @param {Goal | null} goal The goal, null before it is created.
 * @return {string} The status.
 */
const getTrackingStatus = ( goal: Goal | null ): string => {
	if ( goal && isGoalCounting( goal ) ) {
		return __( 'Tracking', 'burst-statistics' );
	}
	if ( 'active' === goal?.status ) {
		return __( 'Not tracking, needs setup', 'burst-statistics' );
	}
	return __( 'Draft, not tracking yet', 'burst-statistics' );
};

/**
 * Top of the goal wizard: the goal's type and name, whether it is tracking, and the steps.
 *
 * @param {Object}   props         Component props.
 * @param {Function} props.onClose Closes the wizard without saving.
 * @return {JSX.Element} The header.
 */
const GoalWizardHeader = ({ onClose }: { onClose: () => void }): JSX.Element => {
	const goal = useWizardGoal();
	const pendingType = useGoalWizardStore( ( state ) => state.pendingType );
	const type = goal ? goal.type : pendingType;

	return (
		<div className="shrink-0 border-b border-gray-200">
			<div className="flex items-center justify-between gap-4 px-4 sm:px-10 py-3 sm:py-4 border-b border-gray-200">
				<div className="flex items-center gap-3 min-w-0">
					<Icon name={getGoalTypeIcon( type )} size={20} color="gray" />
					<h2 className="truncate text-lg font-semibold text-text-black">
						{goal?.title.trim() || __( 'New goal', 'burst-statistics' )}
					</h2>
				</div>

				<div className="flex items-center gap-4 shrink-0">
					<span className="text-sm text-text-gray max-sm:hidden">
						{getTrackingStatus( goal )}
					</span>
					<WizardCloseButton onClose={onClose} dataTour="goal-wizard-close" />
				</div>
			</div>

			<div className="px-2 sm:px-8 py-2">
				<GoalWizardSteps />
			</div>
		</div>
	);
};

export default GoalWizardHeader;
