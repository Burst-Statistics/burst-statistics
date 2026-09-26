import { useState, useEffect, useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doAction, getAction } from '@/utils/api';
import ButtonInput from '@/components/Inputs/ButtonInput';
import SwitchInput from '@/components/Inputs/SwitchInput';
import SelectInput from '@/components/Inputs/SelectInput';
import Icon from '@/utils/Icon';
import { toast } from '@/utils/toast';
import { formatDateAndTime, getRelativeTime } from '@/utils/formatting';

/**
 * Performant Chunked Burst Data Export Field Component.
 *
 * Implements client-driven chunked database dumping with keyset pagination
 * and stream compression modeled after UpdraftPlus.
 */
// fallow-ignore-next-line complexity
const ExportDataField = () => {
	const queryClient = useQueryClient();

	const [ includeOptions, setIncludeOptions ] = useState( true );
	const [ isExporting, setIsExporting ] = useState( false );
	const [ isPaused, setIsPaused ] = useState( false );
	const [ activeExportId, setActiveExportId ] = useState( null );
	const [ progressData, setProgressData ] = useState({
		progress: 0,
		status: 'idle',
		current_table: '',
		processed_rows: 0,
		total_rows: 0,
		download_url: '',
		file_size: '',
		filename: ''
	});

	const [ scheduleConfig, setScheduleConfig ] = useState({
		enabled: false,
		frequency: 'weekly',
		retention_count: 5,
		include_options: true
	});
	const [ nextScheduled, setNextScheduled ] = useState( null );

	const cancelRef = useRef( false );
	const isPausedRef = useRef( false );
	const hasAutoResumedRef = useRef( false );
	const archivesRef = useRef( null );

	// 1. Fetch export status, history, schedule, and database overview.
	const { data: statusData, isLoading } = useQuery({
		queryKey: [ 'burst_export_status' ],
		queryFn: async() => {
			const res = await getAction( 'export_status' );
			return res;
		}
	});

	// Sync schedule settings from status response.
	// fallow-ignore-next-line complexity
	useEffect( () => {
		if ( statusData?.schedule ) {
			setScheduleConfig({
				enabled: Boolean( statusData.schedule.enabled ),
				frequency: statusData.schedule.frequency || 'weekly',
				retention_count: statusData.schedule.retention_count || 5,
				include_options: false !== statusData.schedule.include_options
			});
		}
		if ( statusData?.next_scheduled ) {
			setNextScheduled( statusData.next_scheduled );
		}
	}, [ statusData?.schedule, statusData?.next_scheduled ]);

	// Detect and restore active export session across page reloads.
	// fallow-ignore-next-line complexity
	useEffect( () => {
		if ( isPausedRef.current ) {
			return;
		}

		if ( statusData?.active_export && ! isExporting ) {
			const act = statusData.active_export;
			setActiveExportId( act.export_id );
			const total = act.total_rows || 0;
			const processed = act.processed_rows || 0;
			const calcPct = 0 < total ? Math.min( 99, Math.round( ( processed / total ) * 100 ) ) : 0;
			const pct = act.progress ?? calcPct;
			const currentTable = act.tables?.[ act.current_table_idx ]?.name || '';

			if ( 'completed' === act.status ) {
				setIsPaused( false );
				isPausedRef.current = false;
				setProgressData( ( prev ) => ({
					...prev,
					progress: 0,
					status: 'idle',
					current_table: '',
					processed_rows: 0,
					total_rows: 0,
					download_url: '',
					file_size: '',
					filename: ''
				}) );
			} else if ( 'paused' === act.status ) {

				// User explicitly paused the export before leaving/reloading.
				setIsPaused( true );
				isPausedRef.current = true;
				setProgressData( ( prev ) => ({
					...prev,
					progress: pct,
					status: 'paused',
					current_table: currentTable,
					processed_rows: processed,
					total_rows: total,
					download_url: '',
					file_size: '',
					filename: act.filename || ''
				}) );
			} else if ( 'running' === act.status ) {

				// Export was active when page reloaded: seamlessly auto-resume chunking!
				setIsPaused( false );
				isPausedRef.current = false;
				setProgressData( ( prev ) => ({
					...prev,
					progress: pct,
					status: 'running',
					current_table: currentTable,
					processed_rows: processed,
					total_rows: total,
					download_url: '',
					file_size: '',
					filename: act.filename || ''
				}) );

				if ( ! hasAutoResumedRef.current ) {
					hasAutoResumedRef.current = true;
					runChunkLoop( act.export_id );
				}
			}
		}
	}, [ statusData?.active_export ]); // eslint-disable-line react-hooks/exhaustive-deps

	// 2. Client-driven chunk processing loop (UpdraftPlus resumption style).
	// fallow-ignore-next-line complexity
	const runChunkLoop = async( exportId ) => {
		cancelRef.current = false;
		isPausedRef.current = false;
		setIsPaused( false );
		setIsExporting( true );
		setProgressData( ( prev ) => ({ ...prev, status: 'running' }) );

		let done = false;

		while ( ! done && ! cancelRef.current && ! isPausedRef.current ) {
			try {
				const chunkRes = await doAction( 'export_chunk', { export_id: exportId });

				// If pause or cancel was triggered while the chunk request was in flight, preserve paused state!
				if ( cancelRef.current || isPausedRef.current ) {
					if ( isPausedRef.current ) {

						// fallow-ignore-next-line complexity
						setProgressData( ( prev ) => ({
							...prev,
							progress: chunkRes?.progress ?? prev.progress,
							current_table: chunkRes?.current_table || prev.current_table,
							processed_rows: chunkRes?.processed_rows ?? prev.processed_rows,
							total_rows: chunkRes?.total_rows ?? prev.total_rows,
							status: 'paused'
						}) );
					}
					break;
				}

				if ( chunkRes?.retry ) {
					await new Promise( ( resolve ) => setTimeout( resolve, 500 ) );
					continue;
				}

				if ( ! chunkRes || ! chunkRes.success ) {
					toast.error( chunkRes?.error || __( 'Export chunk failed.', 'burst-statistics' ) );
					setIsExporting( false );
					setIsPaused( true );
					isPausedRef.current = true;
					setProgressData( ( prev ) => ({ ...prev, status: 'paused' }) );
					break;
				}

				if ( 'completed' === chunkRes.status ) {
					done = true;
					setIsExporting( false );
					setIsPaused( false );
					isPausedRef.current = false;
					setActiveExportId( null );
					hasAutoResumedRef.current = false;
					setProgressData({
						progress: 0,
						status: 'idle',
						current_table: '',
						processed_rows: 0,
						total_rows: 0,
						download_url: '',
						file_size: '',
						filename: ''
					});
					toast.success( __( 'Burst data export completed successfully!', 'burst-statistics' ) );
					await queryClient.invalidateQueries([ 'burst_export_status' ]);
					setTimeout( () => {
						archivesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}, 200 );
					break;
				}

				setProgressData({
					progress: chunkRes.progress ?? 0,
					status: chunkRes.status,
					current_table: chunkRes.current_table || '',
					processed_rows: chunkRes.processed_rows || 0,
					total_rows: chunkRes.total_rows || 0,
					download_url: chunkRes.download_url || '',
					file_size: chunkRes.file_size || '',
					filename: chunkRes.filename || ''
				});

				// Yield to UI thread.
				await new Promise( ( resolve ) => setTimeout( resolve, 120 ) );
			} catch ( err ) {
				if ( cancelRef.current || isPausedRef.current ) {
					break;
				}
				toast.error( err?.message || __( 'An error occurred during export.', 'burst-statistics' ) );
				setIsExporting( false );
				setIsPaused( true );
				isPausedRef.current = true;
				setProgressData( ( prev ) => ({ ...prev, status: 'paused' }) );
				break;
			}
		}
	};

	// 3. Start Export Mutation.
	const startExportMutation = useMutation({
		mutationFn: async() => {
			const res = await doAction( 'export_start', {
				format: 'sql.gz',
				include_options: includeOptions
			});
			if ( ! res || ! res.success ) {
				throw new Error( res?.error || __( 'Failed to initialize export session.', 'burst-statistics' ) );
			}
			return res;
		},
		onSuccess: ( data ) => {
			cancelRef.current = false;
			isPausedRef.current = false;
			setIsPaused( false );
			hasAutoResumedRef.current = true;
			setActiveExportId( data.export_id );
			setProgressData({
				progress: 0,
				status: 'running',
				current_table: data.current_table || '',
				processed_rows: 0,
				total_rows: data.total_rows || 0,
				download_url: '',
				file_size: '',
				filename: data.filename || ''
			});
			runChunkLoop( data.export_id );
		},
		onError: ( error ) => {
			toast.error( error.message );
		}
	});

	// 4. Pause Handler.
	const handlePause = async() => {
		cancelRef.current = true;
		isPausedRef.current = true;
		setIsPaused( true );
		setIsExporting( false );
		setProgressData( ( prev ) => ({ ...prev, status: 'paused' }) );
		toast.info( __( 'Export paused.', 'burst-statistics' ) );
		if ( activeExportId ) {
			try {
				await doAction( 'export_pause', { export_id: activeExportId });
				queryClient.invalidateQueries([ 'burst_export_status' ]);
			} catch ( error ) { // eslint-disable-line @typescript-eslint/no-unused-vars

				// Non-fatal.
			}
		}
	};

	// 5. Resume Handler.
	const handleResume = () => {
		if ( ! activeExportId ) {
			return;
		}
		cancelRef.current = false;
		isPausedRef.current = false;
		setIsPaused( false );
		hasAutoResumedRef.current = true;
		setIsExporting( true );
		setProgressData( ( prev ) => ({ ...prev, status: 'running' }) );
		runChunkLoop( activeExportId );
	};

	// 6. Cancel Export Handler.
	const handleCancelExport = async() => {
		cancelRef.current = true;
		isPausedRef.current = false;
		setIsPaused( false );
		setIsExporting( false );
		hasAutoResumedRef.current = false;
		const idToCancel = activeExportId;
		setActiveExportId( null );
		setProgressData({
			progress: 0,
			status: 'idle',
			current_table: '',
			processed_rows: 0,
			total_rows: 0,
			download_url: '',
			file_size: '',
			filename: ''
		});
		if ( idToCancel ) {
			try {
				await doAction( 'export_cancel', { export_id: idToCancel });
			} catch ( error ) { // eslint-disable-line @typescript-eslint/no-unused-vars

				// Non-fatal.
			}
		}
		toast.info( __( 'Export cancelled.', 'burst-statistics' ) );
		queryClient.invalidateQueries([ 'burst_export_status' ]);
	};

	// 7. Save Schedule Mutation.
	const saveScheduleMutation = useMutation({
		mutationFn: async( newConfig ) => {
			const res = await doAction( 'export_save_schedule', newConfig );
			if ( ! res || ! res.success ) {
				throw new Error( res?.error || __( 'Failed to save export schedule.', 'burst-statistics' ) );
			}
			return res;
		},
		onSuccess: ( data ) => {
			toast.success( __( 'Export schedule saved.', 'burst-statistics' ) );
			if ( data?.next_scheduled ) {
				setNextScheduled( data.next_scheduled );
			}
			queryClient.invalidateQueries([ 'burst_export_status' ]);
		},
		onError: ( error ) => {
			toast.error( error.message );
		}
	});

	const handleUpdateSchedule = ( updates ) => {
		const updated = { ...scheduleConfig, ...updates };
		setScheduleConfig( updated );

		if ( updated.enabled ) {
			const intervals = {
				daily: 86400,
				weekly: 604800,
				monthly: 2592000
			};
			const offset = intervals[ updated.frequency ] || 604800;
			setNextScheduled( Math.floor( Date.now() / 1000 ) + offset );
		} else {
			setNextScheduled( null );
		}

		saveScheduleMutation.mutate( updated );
	};

	// 8. Delete Export Archive Mutation.
	const deleteExportMutation = useMutation({
		mutationFn: async( itemIdentifier ) => {
			const res = await doAction( 'export_delete', {
				export_id: itemIdentifier,
				id: itemIdentifier
			});
			if ( ! res || ! res.success ) {
				throw new Error( res?.error || __( 'Failed to delete export archive.', 'burst-statistics' ) );
			}
			return res;
		},
		onSuccess: () => {
			toast.success( __( 'Export archive deleted.', 'burst-statistics' ) );
			queryClient.invalidateQueries([ 'burst_export_status' ]);
		},
		onError: ( error ) => {
			toast.error( error.message );
		}
	});

	const handleDownload = ( url, filename ) => {
		const a = document.createElement( 'a' );
		a.href = url;
		a.download = filename || 'burst-export.sql.gz';
		document.body.appendChild( a );
		a.click();
		document.body.removeChild( a );
	};

	const rawHistory = statusData?.history || [];
	const historyList = [ ...rawHistory ].sort(
		( a, b ) => ( Number( b.created_at ) || 0 ) - ( Number( a.created_at ) || 0 )
	);

	const frequencyOptions = [
		{ value: 'daily', label: __( 'Daily', 'burst-statistics' ) },
		{ value: 'weekly', label: __( 'Weekly (recommended)', 'burst-statistics' ) },
		{ value: 'monthly', label: __( 'Monthly', 'burst-statistics' ) }
	];

	const retentionOptions = [
		{ value: '3', label: __( 'Keep last 3 backups', 'burst-statistics' ) },
		{ value: '5', label: __( 'Keep last 5 backups (recommended)', 'burst-statistics' ) },
		{ value: '10', label: __( 'Keep last 10 backups', 'burst-statistics' ) }
	];

	const getCalculatedFallbackTime = () => {
		if ( ! scheduleConfig.enabled ) {
			return null;
		}
		const intervals = {
			daily: 86400,
			weekly: 604800,
			monthly: 2592000
		};
		const offset = intervals[ scheduleConfig.frequency ] || 604800;
		return Math.floor( Date.now() / 1000 ) + offset;
	};

	const effectiveNextScheduled = nextScheduled || statusData?.next_scheduled || getCalculatedFallbackTime();

	return (
		<div className="w-full px-6 py-6 flex flex-col gap-8 text-text-black box-border">
			{ /* Upgrade-in-progress notice is surfaced via the shared sidebar
			     notices (SettingsNotices) as a critical notice; export controls
			     below stay disabled while upgrade_running is true. */ }

			{ /* Description */ }
			<p className="text-xs text-text-gray m-0 leading-relaxed max-w-2xl">
				{ __(
					'Create a full, performant, chunked backup of all Burst Statistics tables and options. Backups are streamed directly to disk as compressed SQL (.sql.gz) using indexed keyset queries, avoiding server timeouts and PHP memory limits.',
					'burst-statistics'
				) }
			</p>

			{ /* Database Statistics Cards */ }
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
				<div className="p-5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[145px]">
					<div>
						<span className="text-xs text-text-gray font-medium block">
							{ __( 'Burst database tables', 'burst-statistics' ) }
						</span>
						<p className="text-2xl font-bold text-text-black m-0 mt-2">
							{ isLoading ? '…' : ( statusData?.tables_count ?? 0 ) }
						</p>
					</div>
					<span className="text-xs text-text-gray-light block mt-3">
						{ __( 'All core & pro analytics tables', 'burst-statistics' ) }
					</span>
				</div>

				<div className="p-5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[145px]">
					<div>
						<span className="text-xs text-text-gray font-medium block">
							{ __( 'Total estimated records', 'burst-statistics' ) }
						</span>
						<p className="text-2xl font-bold text-text-black m-0 mt-2">
							{ isLoading ? '…' : ( statusData?.total_rows ?? 0 ).toLocaleString() }
						</p>
					</div>
					<span className="text-xs text-text-gray-light block mt-3">
						{ __( 'Streamed in keyset chunks', 'burst-statistics' ) }
					</span>
				</div>

				<div className="p-5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[145px]">
					<div>
						<span className="text-xs text-text-gray font-medium block truncate">
							{ __( 'Estimated export size', 'burst-statistics' ) }
						</span>
						<div className="flex items-baseline gap-1.5 mt-2">
							<p className="text-2xl font-bold text-text-black m-0 whitespace-nowrap">
								{ isLoading ?
									'…' :
									`~${ statusData?.estimated_gz_size || statusData?.estimated_size || '0 MB' }` }
							</p>
							<span className="text-xs font-mono font-medium text-text-gray-light">.sql.gz</span>
						</div>
					</div>
					<span className="text-xs text-text-gray-light block mt-3 leading-relaxed">
						{ sprintf(

							/* translators: %s: uncompressed database size */
							__( '%s uncompressed', 'burst-statistics' ),
							statusData?.estimated_size || '0 MB'
						) }
						{ ' ' }
						<span className="text-primary font-medium whitespace-nowrap">
							{ __( '(~94% smaller)', 'burst-statistics' ) }
						</span>
					</span>
				</div>
			</div>

			{ /* Export Controls (Initial Idle State) */ }
			{ ! isExporting && ! isPaused && 'idle' === progressData.status && (
				<div className="border-t border-gray-200 pt-7 flex flex-col gap-6">
					<div className="flex items-center justify-between gap-6">
						<div className="flex flex-col gap-1 select-none">
							<label
								htmlFor="burst-export-include-options"
								className="text-sm font-medium text-text-black cursor-pointer"
							>
								{ __( 'Include Burst configuration settings & options in export', 'burst-statistics' ) }
							</label>
							<p className="text-xs text-text-gray m-0 leading-relaxed max-w-xl">
								{ __( 'Includes your tracking settings, custom goals, license status and reporting preferences.', 'burst-statistics' ) }
							</p>
						</div>
						<div className="shrink-0">
							<SwitchInput
								id="burst-export-include-options"
								value={ includeOptions }
								onChange={ ( checked ) => setIncludeOptions( checked ) }
								disabled={ isExporting || isPaused }
							/>
						</div>
					</div>

					<div>
						<ButtonInput
							btnVariant="primary"
							disabled={ isExporting || isPaused || startExportMutation.isPending || Boolean( statusData?.upgrade_running ) || 0 === ( statusData?.total_rows ?? 0 ) }
							onClick={ () => startExportMutation.mutate() }
						>
							{ startExportMutation.isPending ? (
								<span className="flex items-center gap-2">
									<Icon name="loading" size={ 14 } className="animate-spin" />
									<span>{ __( 'Preparing export...', 'burst-statistics' ) }</span>
								</span>
							) : (
								<span className="flex items-center gap-2">
									<Icon name="download" size={ 14 } />
									<span>{ __( 'Export all Burst data', 'burst-statistics' ) }</span>
								</span>
							) }
						</ButtonInput>
					</div>
				</div>
			) }

			{ /* Chunked Progress & Resumption Box */ }
			{ ( isExporting || isPaused || 'paused' === progressData.status ) && (
				<div className="border-t border-gray-200 pt-7 flex flex-col gap-3.5">
					<div className="flex items-center justify-between text-xs font-semibold text-text-black">
						<span className="flex items-center gap-2">
							{ isExporting ? (
								<>
									<Icon name="loading" size={ 15 } className="text-primary animate-spin" />
									<span>
										{ sprintf(

											/* translators: %s: table name */
											__( 'Exporting %s...', 'burst-statistics' ),
											progressData.current_table || __( 'tables', 'burst-statistics' )
										) }
									</span>
								</>
							) : (
								<>
									<span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
									<span className="text-amber-600 dark:text-amber-400 font-semibold">
										{ __( 'Export paused', 'burst-statistics' ) }
										{ progressData.current_table ? ` (${ progressData.current_table })` : '' }
									</span>
								</>
							) }
						</span>
						<span className={ isExporting ? 'text-primary font-bold text-sm' : 'text-amber-600 dark:text-amber-400 font-bold text-sm' }>
							{ progressData.progress }%
						</span>
					</div>

					<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
						<div
							className={ `h-2 rounded-full transition-all duration-300 ${ isExporting ? 'bg-primary' : 'bg-amber-500' }` }
							style={ { width: `${ progressData.progress }%` } }
						/>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-gray">
						<span>
							{ sprintf(

								/* translators: 1: processed rows, 2: total rows */
								__( '%1$s of %2$s records streamed to disk', 'burst-statistics' ),
								( progressData.processed_rows || 0 ).toLocaleString(),
								( progressData.total_rows || 0 ).toLocaleString()
							) }
							{ ! isExporting && (
								<span className="text-amber-600 dark:text-amber-400 font-medium ml-1.5">
									{ __( '(Paused)', 'burst-statistics' ) }
								</span>
							) }
						</span>

						<div className="flex items-center gap-2">
							{ isExporting ? (
								<ButtonInput
									btnVariant="tertiary"
									size="sm"
									onClick={ handlePause }
								>
									{ __( 'Pause export', 'burst-statistics' ) }
								</ButtonInput>
							) : (
								<>
									<ButtonInput
										btnVariant="primary"
										size="sm"
										onClick={ handleResume }
									>
										{ __( 'Resume export', 'burst-statistics' ) }
									</ButtonInput>
									<ButtonInput
										btnVariant="tertiary"
										size="sm"
										onClick={ handleCancelExport }
									>
										{ __( 'Cancel export', 'burst-statistics' ) }
									</ButtonInput>
								</>
							) }
						</div>
					</div>
				</div>
			) }


			{ /* Automated Export Schedule */ }
			<div className="border-t border-gray-200 pt-7 flex flex-col gap-5">
				<div className="flex items-center justify-between gap-6">
					<div className="flex flex-col gap-1 select-none">
						<div className="flex items-center gap-2">
							<h4 className="text-sm font-semibold text-text-black m-0">
								{ __( 'Automated export schedule', 'burst-statistics' ) }
							</h4>
							{ scheduleConfig.enabled && (
								<span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-100 text-green-700">
									{ __( 'Active', 'burst-statistics' ) }
								</span>
							) }
						</div>
						<p className="text-xs text-text-gray m-0 leading-relaxed max-w-xl">
							{ __(
								'Automatically back up all Burst Statistics tables in the background on a recurring schedule without affecting site performance.',
								'burst-statistics'
							) }
						</p>
					</div>
					<div className="shrink-0">
						<SwitchInput
							id="burst-export-schedule-enabled"
							value={ scheduleConfig.enabled }
							onChange={ ( checked ) => handleUpdateSchedule({ enabled: checked }) }
						/>
					</div>
				</div>

				{ scheduleConfig.enabled && (
					<div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center gap-6 flex-wrap">
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="burst-schedule-frequency"
									className="text-xs font-semibold text-text-black"
								>
									{ __( 'Backup frequency', 'burst-statistics' ) }
								</label>
								<SelectInput
									value={ scheduleConfig.frequency }
									onChange={ ( val ) => handleUpdateSchedule({ frequency: val }) }
									options={ frequencyOptions }
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="burst-schedule-retention"
									className="text-xs font-semibold text-text-black"
								>
									{ __( 'Retention limit', 'burst-statistics' ) }
								</label>
								<SelectInput
									value={ String( scheduleConfig.retention_count ) }
									onChange={ ( val ) => handleUpdateSchedule({ retention_count: Number( val ) }) }
									options={ retentionOptions }
								/>
							</div>
						</div>

						{ effectiveNextScheduled ? (
							<div className="text-left sm:text-right">
								<span className="text-[11px] text-text-gray block font-medium">
									{ __( 'Next scheduled backup', 'burst-statistics' ) }
								</span>
								<span className="text-xs font-semibold text-text-black font-mono block mt-0.5">
									{ formatDateAndTime( effectiveNextScheduled ) }
								</span>
								<span className="text-[11px] text-text-gray block mt-0.5">
									({ getRelativeTime( effectiveNextScheduled ) })
								</span>
							</div>
						) : null }
					</div>
				) }
			</div>

			{ /* Export History Table */ }
			{ 0 < historyList.length && (
				<div ref={ archivesRef } className="border-t border-gray-200 pt-7 flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-semibold text-text-black m-0">
							{ __( 'Available export archives', 'burst-statistics' ) }
						</h4>
						<span className="text-xs text-text-gray">
							{ sprintf(

								/* translators: %d: retention count */
								__( 'Retaining up to %d backups on server.', 'burst-statistics' ),
								scheduleConfig.retention_count || 5
							) }
						</span>
					</div>

					<div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 bg-white">
						{/* fallow-ignore-next-line complexity */}
						{ historyList.map( ( item ) => (
							<div
								key={ item.id || item.filename }
								className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
							>
								<div className="flex items-center gap-3 min-w-0">
									<div className="p-2 bg-gray-100 text-text-gray rounded-md shrink-0">
										<Icon name="file" size={ 16 } />
									</div>
									<div className="min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-xs font-semibold text-text-black font-mono truncate">
												{ item.filename }
											</span>
											{ item.created_at ? (
												<span className="text-[11px] text-text-gray-light whitespace-nowrap">
													({ getRelativeTime( item.created_at ) })
												</span>
											) : null }
										</div>
										<span className="text-xs text-text-gray block mt-0.5 truncate">
											{ item.created_at ? `${ formatDateAndTime( item.created_at ) } · ` : '' }
											{ sprintf(

												/* translators: 1: size, 2: rows count, 3: tables count */
												__( '%1$s · %2$s records · %3$d tables', 'burst-statistics' ),
												item.size,
												( item.rows || 0 ).toLocaleString(),
												item.tables || 0
											) }
										</span>
									</div>
								</div>

								<div className="flex items-center gap-2 shrink-0">
									<ButtonInput
										btnVariant="secondary"
										onClick={ () => handleDownload( item.download_url, item.filename ) }
									>
										<span className="flex items-center gap-1.5 text-xs">
											<Icon name="download" size={ 13 } />
											<span>{ __( 'Download', 'burst-statistics' ) }</span>
										</span>
									</ButtonInput>
									<button
										type="button"
										disabled={ deleteExportMutation.isPending }
										onClick={ () => deleteExportMutation.mutate( item.id || item.filename ) }
										className="p-1.5 text-text-gray hover:text-red-600 rounded hover:bg-gray-100 transition-colors cursor-pointer"
										title={ __( 'Delete archive', 'burst-statistics' ) }
									>
										<Icon name="trash" size={ 15 } />
									</button>
								</div>
							</div>
						) ) }
					</div>
				</div>
			) }
		</div>
	);
};

export default ExportDataField;
