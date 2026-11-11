import { __, sprintf } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import useLicenseData from '@/hooks/useLicenseData';

interface GoalsHeaderControlsProps {
	activeGoalsCount: number;

	// Maximum number of active goals; 0 or less means no limit.
	goalLimit: number;
	isLimitReached: boolean;

	// Secondary on the all goals overview, tertiary when a single goal is open.
	isGoalSelected: boolean;
	onCreate: () => void;
}

/**
 * Goals list header controls: active goals against the free limit, and the button to add a goal.
 *
 * @param {GoalsHeaderControlsProps} props                  Component props.
 * @param {number}                   props.activeGoalsCount Number of active goals.
 * @param {number}                   props.goalLimit        Maximum number of active goals.
 * @param {boolean}                  props.isLimitReached   Whether no more goals can be activated.
 * @param {boolean}                  props.isGoalSelected   Whether a single goal is open.
 * @param {Function}                 props.onCreate         Opens the wizard for a new goal.
 * @return {JSX.Element} The controls.
 */
const GoalsHeaderControls = ({ activeGoalsCount, goalLimit, isLimitReached, isGoalSelected, onCreate }: GoalsHeaderControlsProps ): JSX.Element => {
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
			<ButtonInput btnVariant={isGoalSelected ? 'tertiary' : 'secondary'} type="button" onClick={onCreate} disabled={isLimitReached} data-tour="new-goal-button">
				{__( 'New goal', 'burst-statistics' )}
			</ButtonInput>
		</div>
	);
};

export default GoalsHeaderControls;
