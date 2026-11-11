import { __, _n, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { clsx } from 'clsx';
import useGoalsData from '@/hooks/useGoalsData';
import useSettingsData from '@/hooks/useSettingsData';
import { getGoalTrackingBlocker } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalStepHeading from '../GoalStepHeading';
import GoalInfoNote from '../GoalInfoNote';
import { use30DaysEvents } from './useGoalSuggestions';

/**
 * Step 2 for a custom event goal: pick or enter the event name.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being configured.
 * @return {JSX.Element} The target step.
 */
// fallow-ignore-next-line complexity
const EventTarget = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();
	const { saveSettings, isSavingSettings } = useSettingsData();
	const { data: suggestions = [] } = use30DaysEvents();

	const blocker = getGoalTrackingBlocker( goal );
	const eventName = goal.hook?.trim() ?? '';

	const handleTurnOn = async() => {
		await saveSettings({ enable_custom_events: true });
	};

	const handleSelectSuggestion = ( name: string ) => {
		setGoalValue( goal.id, 'hook', name );
	};

	return (
		<>
			<GoalStepHeading
				title={__( 'Which event should count as a conversion?', 'burst-statistics' )}
				description={__( 'Each time your site sends this event for a visitor, one conversion is counted.', 'burst-statistics' )}
			/>

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
					{__( 'Custom events are off, so this goal can’t count yet.', 'burst-statistics' )}
				</GoalInfoNote>
			)}

			<div className="flex flex-col gap-2">
				<label htmlFor="goal-event-name" className="text-base font-semibold text-text-black">
					{__( 'Event name', 'burst-statistics' )}
				</label>
				<input
					id="goal-event-name"
					type="text"
					value={goal.hook ?? ''}
					onChange={( e ) => setGoalValue( goal.id, 'hook', e.target.value )}
					placeholder="generate_lead"
					className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 font-mono text-sm text-text-black shadow-sm transition-colors focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
				/>

				{0 < suggestions.length && (
					<div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
						<div className="border-b border-gray-100 bg-gray-50 px-3.5 py-2 text-xs font-medium text-text-gray">
							{__( 'Received in the last 30 days', 'burst-statistics' )}
						</div>
						<div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
							{suggestions.slice( 0, 8 ).map( ( item ) => {
								const isSelected = item.name.toLowerCase() === eventName.toLowerCase();
								return (
									<button
										key={item.name}
										type="button"
										onClick={() => handleSelectSuggestion( item.name )}
										className={clsx(
											'flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors',
											isSelected ? 'bg-green-50 text-green-900 font-medium' : 'hover:bg-gray-50 text-text-black'
										)}
									>
										<span className="font-mono text-sm">{item.name}</span>
										<span className="text-xs text-text-gray">
											{sprintf(

												/* translators: %s: number of times the event occurred. */
												_n( '%s time', '%s times', item.count, 'burst-statistics' ),
												item.count.toLocaleString()
											)}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}

				<p className="mt-1 text-sm text-text-gray">
					{__(
						'The name your site sends with burst.event(), the burst_event action or gtag. An event that hasn’t been sent yet works too: type its name.',
						'burst-statistics'
					)}
				</p>
			</div>

			{eventName && (
				<GoalInfoNote>
					{createInterpolateElement(

						/* translators: <event />: event name e.g. generate_lead. */
						__( 'A conversion is counted when <event /> is sent.', 'burst-statistics' ),
						{ event: <code className="font-mono font-semibold">{eventName}</code> }
					)}
				</GoalInfoNote>
			)}
		</>
	);
};

export default EventTarget;
