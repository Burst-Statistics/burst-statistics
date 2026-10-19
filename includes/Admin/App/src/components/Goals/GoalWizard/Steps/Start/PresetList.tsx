import { useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import useGoalsData from '@/hooks/useGoalsData';
import useLicenseData from '@/hooks/useLicenseData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP } from '@/components/Goals/goalHelpers';
import { getGoalTypeLabel } from '@/components/Goals/goalOptions';
import { burst_get_website_url } from '@/utils/lib';

interface PresetGoal {
	id: string;
	title: string;
	type: string;
}

// Search only pays off once the list no longer fits at a glance.
const SEARCH_THRESHOLD = 6;

/**
 * Preset titles are "Plugin - Goal"; the prefix groups them by plugin.
 *
 * @param {PresetGoal[]} presets The presets.
 * @return {Record<string, PresetGoal[]>} Presets keyed by plugin name.
 */
const groupByPlugin = ( presets: PresetGoal[]): Record<string, PresetGoal[]> => {
	return presets.reduce<Record<string, PresetGoal[]>>( ( groups, preset ) => {
		const plugin = preset.title.split( ' - ' )[0];
		groups[plugin] = [ ...( groups[plugin] ?? []), preset ];
		return groups;
	}, {});
};

/**
 * Presets from detected plugins. Pro adds one in a click; free sees them locked.
 *
 * @return {JSX.Element} The preset list.
 */
const PresetList = (): JSX.Element => {
	const { predefinedGoals, addPredefinedGoal } = useGoalsData();
	const { isPro } = useLicenseData();
	const [ search, setSearch ] = useState( '' );
	const [ isAdding, setIsAdding ] = useState( false );

	// A preset can arrive without a title, e.g. on a MainWP request whose translations did not load; fall back to its id.
	const presets = useMemo(
		() => ( predefinedGoals as PresetGoal[]).map( ( preset ) => ({ ...preset, title: preset.title || String( preset.id ?? '' ) }) ),
		[ predefinedGoals ]
	);

	const groups = useMemo( () => {
		const query = search.trim().toLowerCase();
		const matches = query ?
			presets.filter( ( preset ) => preset.title.toLowerCase().includes( query ) ) :
			presets;
		return groupByPlugin( matches );
	}, [ presets, search ]);

	const handleAdd = async( preset: PresetGoal ) => {
		setIsAdding( true );
		try {
			const response = await addPredefinedGoal( preset.id );
			useGoalWizardStore.getState().setNewGoal( response.goal.id );
			useGoalWizardStore.getState().setCurrentStep( GOAL_STEP.REVIEW );
		} catch {

			// The mutation already shows an error toast.
		} finally {
			setIsAdding( false );
		}
	};

	return (
		<div className="flex flex-col gap-3" data-tour="goal-wizard-presets">
			{
				! isPro && (
					<p className="rounded-md bg-gray-100 p-3 text-sm text-text-gray">
						{__( 'Presets are part of Burst Pro. You can still build any of these yourself with a custom goal.', 'burst-statistics' ) + ' '}

						<a
							className="font-medium text-wp-blue hover:underline"
							target="_blank"
							rel="noopener noreferrer"
							href={burst_get_website_url( '/pricing/', { utm_source: 'goal-wizard', utm_content: 'presets' })}
						>
							{__( 'Upgrade to Pro', 'burst-statistics' )}
						</a>
					</p>

				)
			}

			{
				SEARCH_THRESHOLD < presets.length && (
					<div className="relative flex items-center">
						<div className="pointer-events-none absolute left-3 flex items-center text-text-gray">
							<Icon name="search" size={16} />
						</div>

						<input
							type="text"
							value={search}
							onChange={( e ) => setSearch( e.target.value )}
							placeholder={__( 'Search presets', 'burst-statistics' )}
							className="w-full rounded-lg border border-gray-400 bg-white py-2 pl-9 pr-3 text-sm text-text-black placeholder:text-text-gray focus:border-primary focus:outline-hidden"
						/>
					</div>
				)
			}

			{
				0 === Object.keys( groups ).length && (
					<p className="p-4 text-center text-sm text-text-gray">
						{__( 'No presets match your search.', 'burst-statistics' )}
					</p>
				)
			}

			{
				Object.entries( groups ).map( ([ plugin, items ]) => (
					<div key={plugin} className="flex flex-col gap-2">
						<p className="text-xs uppercase tracking-[0.05em] text-text-gray-light">{plugin}</p>
						{
							items.map( ( preset ) => (
								<button
									key={preset.id}
									type="button"
									disabled={! isPro || isAdding}
									onClick={() => handleAdd( preset )}
									className="burst-predefined-goals-list flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left text-sm transition-colors enabled:cursor-pointer enabled:hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
								>

									<Icon name="plus" size={16} className="shrink-0 text-text-gray" />

									<span className="flex-1 font-medium text-text-black">
										{preset.title.split( ' - ' ).slice( 1 ).join( ' - ' ) || preset.title}
									</span>

									<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-gray">
										{getGoalTypeLabel( preset.type )}
									</span>
								</button>
							) )
						}
					</div>
				) )
			}

			<p className="text-xs text-text-gray">
				{__( 'Plugin you are looking for not listed?', 'burst-statistics' ) + ' '}
				<a
					className="font-medium text-wp-blue hover:underline"
					target="_blank"
					rel="noopener noreferrer"
					href={burst_get_website_url( '/request-goal-integration/', { utm_source: 'goals-integration-request' })}
				>
					{__( 'Request it here', 'burst-statistics' )}
				</a>
			</p>
		</div>
	);
};

export default PresetList;
