import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import WizardCloseButton from '@/components/Common/Wizard/WizardCloseButton';
import WizardHeader from '@/components/Common/Wizard/WizardHeader';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { getGoalTypeIcon } from '@/components/Goals/goalOptions';
import { getGoalKind, getGoalTrackingBlocker, isGoalCounting } from '@/components/Goals/goalHelpers';
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
	if ( ! goal ) {
		return __( 'Draft, not tracking yet', 'burst-statistics' );
	}
	const blocker = getGoalTrackingBlocker( goal );
	if ( blocker ) {
		return blocker.wizardHeaderStatus;
	}
	if ( isGoalCounting( goal ) ) {
		return __( 'Tracking', 'burst-statistics' );
	}
	if ( 'active' === goal.status ) {
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
	const pendingKind = useGoalWizardStore( ( state ) => state.pendingKind );
	const kind = goal ? getGoalKind( goal ) : pendingKind;

	return (
		<WizardHeader
			name={
				<div className="flex items-center gap-3 min-w-0 p-2">
					<Icon name={getGoalTypeIcon( kind )} size={20} color="gray" />
					<h2 className="truncate text-lg font-semibold text-text-black">
						{goal?.title.trim() || __( 'New goal', 'burst-statistics' )}
					</h2>
				</div>
			}
			steps={<GoalWizardSteps />}
			actions={
				<>
					<span className="text-sm text-text-gray whitespace-nowrap max-xl:hidden">
						{getTrackingStatus( goal )}
					</span>
					<WizardCloseButton onClose={onClose} dataTour="goal-wizard-close" />
				</>
			}
		/>
	);
};

export default GoalWizardHeader;
