import { __, sprintf } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import useLicenseData from '@/hooks/useLicenseData';

interface GoalsHeaderControlsProps {
	activeGoalsCount: number;

	// Maximum number of active goals; 0 or less means no limit.
	goalLimit: number;
	hasGoals: boolean;
	isLimitReached: boolean;
	onCreate: () => void;
}

/**
 * Goals page header controls: active goals against the free limit, and the button to add a goal.
 *
 * The add button only shows once there are goals; the empty state has its own.
 *
 * @param {GoalsHeaderControlsProps} props                  Component props.
 * @param {number}                   props.activeGoalsCount Number of active goals.
 * @param {number}                   props.goalLimit        Maximum number of active goals.
 * @param {boolean}                  props.hasGoals         Whether any goal exists.
 * @param {boolean}                  props.isLimitReached   Whether no more goals can be activated.
 * @param {Function}                 props.onCreate         Opens the wizard for a new goal.
 * @return {JSX.Element} The controls.
 */
const GoalsHeaderControls = ({ activeGoalsCount, goalLimit, hasGoals, isLimitReached, onCreate }: GoalsHeaderControlsProps ): JSX.Element => {
	const { isLicenseValid } = useLicenseData();

	return (
		<div className="flex items-center gap-3">
			{! isLicenseValid && 0 < goalLimit && (
				<span className="rounded-lg bg-gray-200 px-3 py-1 text-sm text-text-gray">
					{sprintf(

						/* translators: 1: number of active goals, 2: maximum number of active goals. */
						__( '%1$d / %2$d active', 'burst-statistics' ),
						activeGoalsCount,
						goalLimit
					)}
				</span>
			)}
			{hasGoals && (
				<ButtonInput btnVariant="primary" type="button" onClick={onCreate} disabled={isLimitReached} data-tour="new-goal-button">
					{__( 'New goal', 'burst-statistics' )}
				</ButtonInput>
			)}
		</div>
	);
};

export default GoalsHeaderControls;
