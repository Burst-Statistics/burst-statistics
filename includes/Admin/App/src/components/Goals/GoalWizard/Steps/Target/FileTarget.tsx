import { useState, useMemo } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { clsx } from 'clsx';
import useGoalsData from '@/hooks/useGoalsData';
import useSettingsData from '@/hooks/useSettingsData';
import Icon from '@/utils/Icon';
import { getGoalTrackingBlocker, parseEventFilter } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalStepHeading from '../GoalStepHeading';
import GoalInfoNote from '../GoalInfoNote';
import GoalScopeOption from '../Count/GoalScopeOption';
import { use30DaysDownloadFiles } from './useGoalSuggestions';

const PRIMARY_EXTENSIONS = [ 'pdf', 'zip', 'docx', 'xlsx', 'mp3' ];

type DownloadMode = 'any' | 'specific' | 'extensions';

/**
 * Step 2 for a file download goal: pick any file, a specific file, or certain file types.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being configured.
 * @return {JSX.Element} The target step.
 */
// fallow-ignore-next-line complexity
const FileTarget = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();
	const { saveSettings, isSavingSettings } = useSettingsData();
	const { data: suggestions = [] } = use30DaysDownloadFiles();
	const [ showMoreExtensions, setShowMoreExtensions ] = useState( false );

	const filter = useMemo( () => parseEventFilter( goal.event_filter ), [ goal.event_filter ]);

	// Detect initial mode from current goal filter.
	const initialMode: DownloadMode = useMemo( () => {
		if ( filter && 'file_name' === filter.key ) {
			return 'specific';
		}
		if ( filter && 'file_extension' === filter.key ) {
			return 'extensions';
		}
		return 'any';
	}, [ filter ]);

	const [ mode, setMode ] = useState<DownloadMode>( initialMode );

	const fileName = useMemo( () => {
		if ( filter && 'file_name' === filter.key && 'string' === typeof filter.value ) {
			return filter.value;
		}
		return '';
	}, [ filter ]);

	const selectedExtensions = useMemo( () => {
		if ( filter && 'file_extension' === filter.key && Array.isArray( filter.value ) ) {
			return filter.value;
		}
		return [];
	}, [ filter ]);

	const blocker = getGoalTrackingBlocker( goal );

	const handleTurnOn = async() => {
		await saveSettings({ enable_custom_events: true, track_downloads: true });
	};

	// fallow-ignore-next-line complexity
	const handleSelectMode = ( newMode: DownloadMode ) => {
		setMode( newMode );
		if ( 'any' === newMode ) {
			setGoalValue( goal.id, 'event_filter', null );
		} else if ( 'specific' === newMode ) {
			const val = fileName.trimStart();
			setGoalValue(
				goal.id,
				'event_filter',
				JSON.stringify({ key: 'file_name', op: 'equals', value: val })
			);
		} else if ( 'extensions' === newMode ) {
			setGoalValue(
				goal.id,
				'event_filter',
				JSON.stringify({ key: 'file_extension', op: 'in', value: selectedExtensions })
			);
		}
	};

	const handleFileNameChange = ( name: string ) => {
		const val = name.trimStart();
		setGoalValue(
			goal.id,
			'event_filter',
			JSON.stringify({ key: 'file_name', op: 'equals', value: val })
		);
	};

	const handleToggleExtension = ( ext: string ) => {
		setMode( 'extensions' );
		const isSelected = selectedExtensions.includes( ext );
		const next = isSelected ?
			selectedExtensions.filter( ( item ) => item !== ext ) :
			[ ...selectedExtensions, ext ];

		setGoalValue(
			goal.id,
			'event_filter',
			JSON.stringify({ key: 'file_extension', op: 'in', value: next })
		);
	};

	const openMediaLibrary = () => {
		if ( 'undefined' === typeof window || ! window.wp?.media ) {
			return;
		}

		const frame = window.wp.media({
			title: __( 'Select a file', 'burst-statistics' ),
			button: { text: __( 'Select', 'burst-statistics' ) },
			multiple: false
		});

		frame.on( 'select', () => {
			const selection = frame.state().get( 'selection' ).first()?.toJSON();
			if ( selection ) {
				const filename = selection.filename || selection.url?.split( '/' ).pop()?.split( '?' )[0];
				if ( filename ) {
					handleFileNameChange( filename );
				}
			}
		});

		frame.open();
	};

	// Only offer extensions the tracker recognizes, a site can narrow the list with a filter.
	const allExtensions = window.burst_settings?.download_extensions ?? [];
	const visibleExtensions = showMoreExtensions ?
		allExtensions :
		PRIMARY_EXTENSIONS.filter( ( ext ) => allExtensions.includes( ext ) );
	const canManage = Boolean( window.burst_settings?.manage_burst_statistics );

	return (
		<>
			<GoalStepHeading
				title={__( 'Which downloads should count?', 'burst-statistics' )}
				description={__( 'Each download of a matching file counts as a conversion, wherever the link is on your site.', 'burst-statistics' )}
			/>

			{blocker && (
				<GoalInfoNote
					isWarning
					action={
						canManage ? (
							<button
								type="button"
								disabled={isSavingSettings}
								onClick={handleTurnOn}
								className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-text-black shadow-sm hover:bg-gray-50 disabled:opacity-50"
							>
								{__( 'Turn on', 'burst-statistics' )}
							</button>
						) : undefined
					}
				>
					{__( 'Download tracking is off, so this goal can’t count yet. Turning it on also adds downloads to your Events report.', 'burst-statistics' )}
				</GoalInfoNote>
			)}

			<div className="flex flex-col gap-4">
				<GoalScopeOption
					name={`download-scope-${goal.id}`}
					value="any"
					title={__( 'Any file download', 'burst-statistics' )}
					description={__( 'Every link to a file on your site counts.', 'burst-statistics' )}
					isSelected={'any' === mode}
					onSelect={() => handleSelectMode( 'any' )}
				/>

				<GoalScopeOption
					name={`download-scope-${goal.id}`}
					value="specific"
					title={__( 'A specific file', 'burst-statistics' )}
					description={__( 'Only downloads of this file count.', 'burst-statistics' )}
					isSelected={'specific' === mode}
					onSelect={() => handleSelectMode( 'specific' )}
				>
					<div className="flex flex-col gap-3">
						<label htmlFor="goal-download-filename" className="text-sm font-semibold text-text-black">
							{__( 'File name', 'burst-statistics' )}
						</label>
						<div className="flex items-center gap-2">
							<input
								id="goal-download-filename"
								type="text"
								value={fileName}
								onChange={( e ) => handleFileNameChange( e.target.value )}
								placeholder="brochure-2026.pdf"
								className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2 font-mono text-sm text-text-black shadow-sm transition-colors focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
							/>
							<button
								type="button"
								onClick={openMediaLibrary}
								className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-text-black shadow-sm hover:bg-gray-50 shrink-0"
							>
								<Icon name="image" size={16} />
								<span>{__( 'Media library', 'burst-statistics' )}</span>
							</button>
						</div>

						{0 < suggestions.length && (
							<div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
								<div className="border-b border-gray-100 bg-gray-50 px-3.5 py-2 text-xs font-medium text-text-gray">
									{__( 'Downloaded on your site in the last 30 days', 'burst-statistics' )}
								</div>
								<div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
									{suggestions.slice( 0, 6 ).map( ( item ) => {
										const isSelected = item.file_name.toLowerCase() === fileName.toLowerCase();
										return (
											<button
												key={item.file_name}
												type="button"
												onClick={() => handleFileNameChange( item.file_name )}
												className={clsx(
													'flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors',
													isSelected ? 'bg-green-50 text-green-900 font-medium' : 'hover:bg-gray-50 text-text-black'
												)}
											>
												<span className="font-mono text-sm">{item.file_name}</span>
												<span className="text-xs text-text-gray">
													{sprintf(

														/* translators: %s: number of downloads. */
														_n( '%s download', '%s downloads', item.count, 'burst-statistics' ),
														item.count.toLocaleString()
													)}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</GoalScopeOption>

				<GoalScopeOption
					name={`download-scope-${goal.id}`}
					value="extensions"
					title={__( 'Certain file types', 'burst-statistics' )}
					description={__( 'For example every PDF, or every ZIP.', 'burst-statistics' )}
					isSelected={'extensions' === mode}
					onSelect={() => handleSelectMode( 'extensions' )}
				>
					<div className="flex flex-wrap items-center gap-2">
						{visibleExtensions.map( ( ext ) => {
							const isSelected = selectedExtensions.includes( ext );
							return (
								<button
									key={ext}
									type="button"
									onClick={() => handleToggleExtension( ext )}
									className={clsx(
										'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
										isSelected ?
											'border-green bg-green-50 text-green-800' :
											'border-gray-300 bg-white text-text-black hover:border-gray-400'
									)}
								>
									{ext}
								</button>
							);
						})}
						{! showMoreExtensions && (
							<button
								type="button"
								onClick={() => setShowMoreExtensions( true )}
								className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-text-gray hover:border-gray-400"
							>
								{__( 'More...', 'burst-statistics' )}
							</button>
						)}
					</div>
				</GoalScopeOption>
			</div>

			<GoalInfoNote>
				{'specific' === mode && fileName ? (
					createInterpolateElement(

						/* translators: <file />: file name e.g. brochure-2026.pdf. */
						__( 'A conversion is counted when a visitor downloads <file /> from <strong>any page</strong> of your site.', 'burst-statistics' ),
						{
							file: <code className="font-mono font-semibold">{fileName}</code>,
							strong: <strong />
						}
					)
				) : 'extensions' === mode && 0 < selectedExtensions.length ? (
					createInterpolateElement(

						/* translators: <ext />: list of file extensions e.g. PDF, ZIP. */
						__( 'A conversion is counted when a visitor downloads <ext /> files from <strong>any page</strong> of your site.', 'burst-statistics' ),
						{
							ext: <code className="font-mono font-semibold">{selectedExtensions.map( ( e ) => e.toUpperCase() ).join( ', ' )}</code>,
							strong: <strong />
						}
					)
				) : (
					createInterpolateElement(
						__( 'A conversion is counted when a visitor downloads a file from <strong>any page</strong> of your site.', 'burst-statistics' ),
						{ strong: <strong /> }
					)
				)}
			</GoalInfoNote>
		</>
	);
};

export default FileTarget;
