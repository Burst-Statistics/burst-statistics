import { __ } from '@wordpress/i18n';
import { getGoalTrackingBlocker, isGoalComplete } from '@/components/Goals/goalHelpers';
import GoalLimitNotice from '@/components/Goals/GoalLimitNotice';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import useSettingsData from '@/hooks/useSettingsData';
import GoalInfoNote from './GoalInfoNote';
import useWizardGoal from '../useWizardGoal';
import GoalNameField from './Review/GoalNameField';
import GoalReviewRows from './Review/GoalReviewRows';
import GoalAdvancedSettings from './Review/GoalAdvancedSettings';
import GoalUnfinishedNotice from './Review/GoalUnfinishedNotice';

/**
 * Last step: name the goal, check what it counts, then save it as a draft or start tracking.
 *
 * @return {JSX.Element | null} The review step.
 */
// fallow-ignore-next-line complexity
const StepReview = (): JSX.Element | null => {
	const goal = useWizardGoal();
	const isLimitReached = useIsGoalLimitReached();
	const { saveSettings, isSavingSettings } = useSettingsData();

	if ( ! goal ) {
		return null;
	}

	const blocker = getGoalTrackingBlocker( goal );

	const handleTurnOn = async() => {
		if ( 'downloads_off' === blocker?.type ) {
			await saveSettings({ enable_custom_events: true, track_downloads: true });
		} else if ( 'custom_events_off' === blocker?.type ) {
			await saveSettings({ enable_custom_events: true });
		}
	};

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			{blocker && (
				<GoalInfoNote
					isWarning
					action={
						<button
							type="button"
							disabled={isSavingSettings}
							onClick={handleTurnOn}
							className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-text-black shadow-sm hover:bg-gray-50 disabled:opacity-50"
						>
							{__( 'Turn on', 'burst-statistics' )}
						</button>
					}
				>
					{'downloads_off' === blocker.type ?
						__( 'Download tracking is off, so this goal can’t count yet. Turning it on also adds downloads to your Events report.', 'burst-statistics' ) :
						__( 'Custom events are off, so this goal can’t count yet.', 'burst-statistics' )
					}
				</GoalInfoNote>
			)}

			<GoalNameField goal={goal} />

			{isGoalComplete( goal ) ? <GoalReviewRows goal={goal} /> : <GoalUnfinishedNotice />}

			<GoalAdvancedSettings goal={goal} />

			{/* Starting a paused goal needs room under the free active goal limit. */}
			{isLimitReached && 'active' !== goal.status && <GoalLimitNotice />}
		</div>
	);
};

export default StepReview;
