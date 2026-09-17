import { useState, useEffect, useRef, useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { InsightCallout } from '@/components/Common/InsightCallout';
import useSettingsData from '@/hooks/useSettingsData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAction, doAction } from '@/utils/api';
import { uploadFileInChunks } from '@/utils/chunkedUpload';
import { formatFileSize } from '@/utils/formatting';
import { clsx } from 'clsx';

const AVAILABLE_SOURCES = [
	{ id: 'burst', name: 'Burst Statistics Backup (.sql.gz / .zip)', type: 'upload' },
	{ id: 'ga4_csv', name: 'Google Analytics 4 (CSV / ZIP)', type: 'upload' },
	{ id: 'plausible', name: 'Plausible Analytics', type: 'upload' },
	{ id: 'fathom', name: 'Fathom Analytics', type: 'upload' },
	{ id: 'jetpack', name: 'Jetpack Stats', type: 'upload' },
	{ id: 'wp_statistics', name: 'WP Statistics', type: 'database' },
	{ id: 'matomo', name: 'Matomo for WordPress', type: 'database' },
	{ id: 'independent_analytics', name: 'Independent Analytics', type: 'database' },
	{ id: 'koko', name: 'Koko Analytics', type: 'database' },
	{ id: 'statify', name: 'Statify', type: 'database' },
	{ id: 'slimstat', name: 'Slimstat Analytics', type: 'database' }
];

// fallow-ignore-next-line complexity
const ImportDataField = () => {
	const [ currentStep, setCurrentStep ] = useState( 1 ); // 1: Select Source, 2: Configure & Ingest
	const [ selectedSource, setSelectedSource ] = useState( 'ga4_csv' );
	const [ importMode, setImportMode ] = useState( 'database' ); // 'database' | 'upload'
	const [ uploadedFilePath, setUploadedFilePath ] = useState( '' );
	const [ uploadedFileName, setUploadedFileName ] = useState( '' );
	const [ uploadedFileSize, setUploadedFileSize ] = useState( 0 );
	const [ isUploading, setIsUploading ] = useState( false );
	const [ uploadProgress, setUploadProgress ] = useState( 0 );
	const [ uploadChunkInfo, setUploadChunkInfo ] = useState( '' );
	const [ isDragging, setIsDragging ] = useState( false );
	const fileInputRef = useRef( null );
	const cancelRef = useRef( false );
	const isLoopRunningRef = useRef( false );

	const { addNotice } = useSettingsData();
	const queryClient = useQueryClient();

	// Fetch available sources status & detection
	const { data: sourcesResponse } = useQuery({
		queryKey: [ 'import_sources_status' ],
		queryFn: async() => {
			const res = await getAction( 'import_sources_status' );
			return res || {};
		},
		staleTime: 30000
	});
	const sourcesData = sourcesResponse?.sources || {};
	const burstTrackingStart = sourcesResponse?.burst_tracking_start;
	const isUpgradeRunning = Boolean( sourcesResponse?.upgrade_running );

	// Poll running import progress
	const { data: progressData } = useQuery({
		queryKey: [ 'import_progress' ],
		queryFn: async() => {
			const res = await getAction( 'import_progress' );
			return res?.progress || { percentage: 0, status: 'idle' };
		},
		refetchInterval: ( query ) => {
			const status = query.state.data?.status;
			return 'processing' === status ? 2000 : false;
		}
	});

	const isProcessing = 'processing' === progressData?.status;

	// Keep the detailed progress card mounted while an import is running, even
	// across a page refresh (the server keeps reporting 'processing'). This also
	// prevents starting a new import until the current one finishes or is
	// cancelled, since the source-selection step is not reachable meanwhile.
	useEffect( () => {
		if ( isProcessing ) {
			setCurrentStep( 2 );
		}
	}, [ isProcessing ]);

	// Fetch historical imports with live polling whenever an import is processing
	const { data: historyData } = useQuery({
		queryKey: [ 'import_history' ],
		queryFn: async() => {
			const res = await getAction( 'import_history' );
			return res?.history || [];
		},
		refetchInterval: ( query ) => {
			const data = query.state.data;
			const hasProcessing = Array.isArray( data ) && data.some( ( item ) => 'processing' === item.status );
			return hasProcessing || isProcessing ? 2000 : false;
		}
	});

	// Client-driven chunk execution loop (ensures rapid, continuous batching without relying solely on WP-Cron)
	// fallow-ignore-next-line complexity
	const runImportLoop = async( importId ) => {
		if ( isLoopRunningRef.current || ! importId ) {
			return;
		}
		isLoopRunningRef.current = true;
		cancelRef.current = false;

		let done = false;

		// A single chunk request can fail transiently (a heavy batch that times
		// out, an empty/invalid response). WP-Cron keeps driving the import
		// server-side regardless, so tolerate a few consecutive failures with a
		// short backoff before giving up the client-driven loop instead of
		// stopping (and toasting) on the first hiccup.
		let failures = 0;
		const maxFailures = 3;

		while ( ! done && ! cancelRef.current ) {
			try {
				const res = await doAction( 'import_chunk', { import_id: importId });
				if ( cancelRef.current ) {
					break;
				}

				if ( ! res || ! res.success ) {
					failures++;
					if ( failures >= maxFailures ) {
						break;
					}
					await new Promise( ( resolve ) => setTimeout( resolve, 1500 ) );
					continue;
				}

				failures = 0;

				const progress = res.progress;
				if ( progress ) {
					if ( 'cancelled' === progress.status || cancelRef.current ) {
						done = true;
						queryClient.setQueryData([ 'import_progress' ], { percentage: 0, status: 'idle', import_id: null });
						queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
						break;
					}

					queryClient.setQueryData([ 'import_progress' ], progress );
					queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });

					if ( 'completed' === progress.status ) {
						done = true;
						addNotice( __( 'Import completed successfully!', 'burst-statistics' ), 'success' );
						queryClient.invalidateQueries({ queryKey: [ 'import_progress' ] });
						queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
						break;
					}

					if ( 'failed' === progress.status ) {
						done = true;
						addNotice( __( 'Import failed or encountered an error.', 'burst-statistics' ), 'error' );
						queryClient.invalidateQueries({ queryKey: [ 'import_progress' ] });
						queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
						break;
					}
				}

				// Yield to UI thread.
				await new Promise( ( resolve ) => setTimeout( resolve, 120 ) );
			} catch {
				if ( cancelRef.current ) {
					break;
				}
				failures++;
				if ( failures >= maxFailures ) {
					break;
				}
				await new Promise( ( resolve ) => setTimeout( resolve, 1500 ) );
			}
		}

		isLoopRunningRef.current = false;
	};

	// Auto-resume active import loop on load or reload
	// fallow-ignore-next-line complexity
	useEffect( () => {
		const isProcessing = 'processing' === progressData?.status;
		const importId = progressData?.import_id;
		if ( isProcessing && importId && ! isLoopRunningRef.current && ! cancelRef.current ) {
			runImportLoop( importId );
		}
	}, [ progressData?.status, progressData?.import_id ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Start Import Mutation
	const startImportMutation = useMutation({
		mutationFn: async( payload ) => {
			return await doAction( 'start_import', payload );
		},
		onSuccess: ( res ) => {
			if ( res?.error ) {
				addNotice( res.error, 'error' );
				setUploadedFilePath( '' );
				setUploadedFileName( '' );
				setUploadedFileSize( 0 );
			} else {
				addNotice( __( 'Import started in the background.', 'burst-statistics' ), 'success' );
				cancelRef.current = false;
				queryClient.invalidateQueries({ queryKey: [ 'import_progress' ] });
				queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
				if ( res?.import_id ) {
					runImportLoop( res.import_id );
				}
			}
		},
		onError: ( err ) => {
			addNotice( err?.message || __( 'Failed to start import.', 'burst-statistics' ), 'error' );
		}
	});

	// Cancel Import Mutation
	const cancelImportMutation = useMutation({
		onMutate: async( importId ) => {
			cancelRef.current = true;
			if ( ! importId || Number( importId ) === Number( progressData?.import_id ) ) {
				queryClient.setQueryData([ 'import_progress' ], { percentage: 0, status: 'idle', import_id: null });
			}
		},
		mutationFn: async( importId ) => {
			cancelRef.current = true;
			const targetId = importId || progressData?.import_id;
			return await doAction( 'cancel_import', { import_id: targetId });
		},
		onSuccess: () => {
			cancelRef.current = true;
			addNotice( __( 'Import cancelled.', 'burst-statistics' ), 'warning' );
			queryClient.setQueryData([ 'import_progress' ], { percentage: 0, status: 'idle', import_id: null });
			queryClient.invalidateQueries({ queryKey: [ 'import_progress' ] });
			queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
		},
		onError: ( err ) => {
			addNotice( err?.message || __( 'Failed to cancel import.', 'burst-statistics' ), 'error' );
		}
	});

	// Rollback Mutation
	const rollbackMutation = useMutation({
		mutationFn: async( importId ) => {
			return await doAction( 'rollback_import', { import_id: importId });
		},
		onSuccess: () => {
			addNotice( __( 'Import rolled back successfully.', 'burst-statistics' ), 'success' );
			queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
			queryClient.invalidateQueries({ queryKey: [ 'import_progress' ] });
		}
	});

	// Clear History Mutation
	const clearHistoryMutation = useMutation({
		mutationFn: async() => {
			return await doAction( 'clear_import_history', {});
		},
		onSuccess: ( data ) => {
			addNotice( data?.message || __( 'Import history cleared.', 'burst-statistics' ), 'success' );
			queryClient.invalidateQueries({ queryKey: [ 'import_history' ] });
		},
		onError: ( err ) => {
			addNotice( err?.message || __( 'Failed to clear import history.', 'burst-statistics' ), 'error' );
		}
	});

	// fallow-ignore-next-line complexity
	const handleFileSelect = async( file ) => {
		if ( ! file ) {
			return;
		}

		setIsUploading( true );
		setUploadedFileName( file.name );
		setUploadedFileSize( file.size );
		setUploadProgress( 0 );
		setUploadChunkInfo( __( 'Starting chunked upload session...', 'burst-statistics' ) );

		try {
			const result = await uploadFileInChunks( file, ( progress ) => {
				setUploadProgress( progress.percentage );

				setUploadChunkInfo(
					sprintf(

						/* translators: 1: current chunk, 2: total chunks, 3: percentage */
						__( 'Uploading slice %1$d of %2$d (%3$d%%)...', 'burst-statistics' ),
						progress.chunkIndex + 1,
						progress.totalChunks,
						progress.percentage
					)
				);
			});

			setUploadedFilePath( result.filePath );
			setIsUploading( false );
			addNotice( __( 'File uploaded and validated in chunks successfully.', 'burst-statistics' ), 'success' );
		} catch ( err ) {
			setIsUploading( false );
			setUploadedFileName( '' );
			setUploadedFilePath( '' );
			setUploadedFileSize( 0 );
			addNotice( err?.message || __( 'Chunked file upload failed.', 'burst-statistics' ), 'error' );
		}
	};

	const handleInputChange = ( e ) => {
		handleFileSelect( e.target.files?.[0]);
	};

	const currentSourceMeta = AVAILABLE_SOURCES.find( ( s ) => s.id === selectedSource );
	const sourceStatus = sourcesData?.[ selectedSource ];
	const isLocalSource = 'database' === currentSourceMeta?.type;
	const isLocalDetected = isLocalSource && Boolean( sourceStatus?.detected );

	const activeMode = isLocalSource ?
		( isLocalDetected ? importMode : 'upload' ) :
		'upload';

	const isDatabaseAlreadyImported = useMemo( () => {
		if ( 'database' !== activeMode ) {
			return false;
		}
		return Array.isArray( historyData ) && historyData.some(
			( item ) => item.source === selectedSource && 'database' === item.source_type && 'completed' === item.status
		);
	}, [ activeMode, historyData, selectedSource ]);

	// Format source ID into a readable name (matches AVAILABLE_SOURCES display names).
	const formatSourceName = ( sourceId ) => {
		const found = AVAILABLE_SOURCES.find( ( s ) => s.id === sourceId );
		if ( found ) {
			return found.name;
		}

		// Fallback: title-case each word.
		return sourceId
			.split( '_' )
			.map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) )
			.join( ' ' );
	};

	return (
		<div className="w-full px-6 py-4 space-y-5 text-text-black box-border">
			{ /* Upgrade-in-progress notice is surfaced via the shared sidebar
			     notices (SettingsNotices) as a critical notice; controls below
			     stay disabled while isUpgradeRunning is true. */ }

			{ /* Step Breadcrumb Bar (Matching Burst ReportWizard Steps.tsx) */ }
			<div className="flex items-center gap-3 pb-4 border-b border-gray-200">
				{ /* Step 1 */ }
				<div
					className={ clsx(
						'flex items-center gap-2 rounded-md py-1 px-1.5 transition-colors',
						2 === currentStep && ! isProcessing ? 'cursor-pointer hover:bg-gray-100' : ''
					) }
					onClick={ () => 2 === currentStep && ! isProcessing && setCurrentStep( 1 ) }
				>
					<div
						className={ clsx(
							'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all shrink-0',
							1 === currentStep ?
								'bg-primary text-text-white border-primary shadow-xs' :
								'bg-green-50 border-green'
						) }
					>
						{ 2 === currentStep ? (
							<Icon name="check" size={ 13 } className="text-primary" />
						) : (
							<span className="text-xs font-bold leading-none">1</span>
						) }
					</div>
					<div className="flex flex-col text-left">
						<span className="text-[10px] text-text-gray-light uppercase tracking-wider font-semibold leading-none mb-0.5">
							{ __( 'Step 1', 'burst-statistics' ) }
						</span>
						<span
							className={ clsx(
								'text-xs whitespace-nowrap leading-none',
								1 === currentStep ? 'text-text-black font-semibold' : 'text-text-gray font-medium'
							) }
						>
							{ __( 'Select provider', 'burst-statistics' ) }
						</span>
					</div>
				</div>

				{ /* Connector Line */ }
				<div className="h-0.5 flex-1 max-w-[4rem] bg-gray-300 rounded-full shrink-0" />

				{ /* Step 2 */ }
				<div className="flex items-center gap-2 rounded-md py-1 px-1.5">
					<div
						className={ clsx(
							'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all shrink-0',
							2 === currentStep ?
								'bg-primary text-text-white border-primary shadow-xs' :
								'border-gray-400 bg-gray-200'
						) }
					>
						<span className={ clsx(
							'text-xs font-bold leading-none',
							2 === currentStep ? 'text-text-white' : 'text-text-gray'
						) }>2</span>
					</div>
					<div className="flex flex-col text-left">
						<span className="text-[10px] text-text-gray-light uppercase tracking-wider font-semibold leading-none mb-0.5">
							{ __( 'Step 2', 'burst-statistics' ) }
						</span>
						<span
							className={ clsx(
								'text-xs whitespace-nowrap leading-none',
								2 === currentStep ? 'text-text-black font-semibold' : 'text-text-gray font-medium'
							) }
						>
							{ __( 'Configure & ingest', 'burst-statistics' ) }
						</span>
					</div>
				</div>
			</div>

			{ /* STEP 1: Provider Selection Grid */ }
			{ 1 === currentStep && (
				<div>
					{ /* Heading with breathing room from stepper border */ }
					<div className="pt-5 pb-4">
						<h3 className="text-sm font-semibold text-text-black mb-1.5">
							{ __( 'Choose your analytics provider', 'burst-statistics' ) }
						</h3>
						<p className="text-xs text-text-gray m-0 leading-relaxed">
							{ __( 'Select the platform or WordPress plugin you are migrating data from.', 'burst-statistics' ) }
						</p>
					</div>

					{ /* Cards grid — mb-5 gives breathing room before the divider */ }
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
						{/* fallow-ignore-next-line complexity */}
						{ AVAILABLE_SOURCES.map( ( src ) => {
							const isDetected = Boolean( sourcesData?.[ src.id ]?.detected );
							const isSelected = selectedSource === src.id;

							return (
								<label
									key={ src.id }
									onClick={ () => {
										setSelectedSource( src.id );
										setUploadedFilePath( '' );
										setUploadedFileName( '' );
										setUploadedFileSize( 0 );
										setImportMode( 'database' );
									} }
									className={ clsx(
										'relative flex items-start gap-3 p-3 rounded-lg border-2 transition-all duration-150 cursor-pointer text-left',
										isSelected ?
											'border-primary bg-primary-100' :
											'border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50'
									) }
								>
									{ /* Left radio indicator */ }
									<div className="shrink-0 mt-1">
										<div
											className={ clsx(
												'w-4 h-4 rounded-full border-2 transition-all duration-150 flex items-center justify-center',
												isSelected ?
													'border-primary bg-primary' :
													'border-gray-400 bg-white'
											) }
										>
											{ isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" /> }
										</div>
									</div>

									{ /* Card content */ }
									<div className="flex-1 min-w-0 pr-5">
										<p className="text-sm font-semibold text-text-black leading-snug mb-1 m-0">
											{ src.name }
										</p>
										<p className="text-xs text-text-gray-light mb-0 leading-normal m-0">
											{ 'burst' === src.id ?
												__( 'Export archive (.sql.gz / .zip)', 'burst-statistics' ) :
												( 'database' === src.type ?
													( isDetected ? __( 'Direct DB or export file', 'burst-statistics' ) : __( 'Export file (.csv / .zip)', 'burst-statistics' ) ) :
													__( 'Export file (.csv / .zip)', 'burst-statistics' )
												)
											}
										</p>
									</div>

									{ /* Green dot — always at top-right of card */ }
									{ isDetected && (
										<span
											className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-primary shrink-0"
											title={ __( 'Detected on this site', 'burst-statistics' ) }
										/>
									) }
								</label>
							);
						}) }
					</div>

					{ /* Divider + Continue button */ }
					<div className="flex justify-end pt-4 border-t border-gray-200">
						<ButtonInput
							btnVariant="primary"
							disabled={ isUpgradeRunning }
							onClick={ () => setCurrentStep( 2 ) }
						>
							{ __( 'Continue', 'burst-statistics' ) }
						</ButtonInput>
					</div>
				</div>
			) }

			{ /* STEP 2: Ingestion & Configuration */ }
			{ 2 === currentStep && (
				<div className="pt-2 flex flex-col gap-6">
					{ isProcessing ? (
						<div className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col gap-5 shadow-xs">
							{ /* Active Import Header */ }
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-start gap-3.5">
									<div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center shrink-0 mt-0.5">
										<Icon name="loading" size={ 20 } className="text-orange animate-spin" />
									</div>
									<div className="flex flex-col gap-1">
										<h4 className="text-sm font-semibold text-text-black m-0 leading-snug">
											{ sprintf(

												/* translators: %s: source name */
												__( 'Importing %s data...', 'burst-statistics' ),
												formatSourceName( progressData?.source || selectedSource )
											) }
										</h4>
										<p className="text-xs text-text-gray m-0 leading-relaxed">
											{ __( 'Processing batches in the background. You can safely navigate away; your import will continue.', 'burst-statistics' ) }
										</p>
									</div>
								</div>
								<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-orange/10 text-orange shrink-0">
									{ progressData?.percentage || 0 }%
								</span>
							</div>

							{ /* Progress Bar */ }
							<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden my-0.5">
								<div
									className="bg-orange h-2.5 rounded-full transition-all duration-300"
									style={ { width: `${ progressData?.percentage || 0 }%` } }
								/>
							</div>

							{ /* Metrics Grid */ }
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
								<div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 flex flex-col justify-center gap-1.5">
									<span className="text-text-gray block text-xs font-medium leading-none">
										{ __( 'Processed rows', 'burst-statistics' ) }
									</span>
									<span className="text-text-black font-bold text-base tracking-tight">
										{ Number( progressData?.rows || 0 ).toLocaleString() }
									</span>
								</div>
								<div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 flex flex-col justify-center gap-1.5">
									<span className="text-text-gray block text-xs font-medium leading-none">
										{ __( 'Pageviews', 'burst-statistics' ) }
									</span>
									<span className="text-text-black font-bold text-base tracking-tight">
										{ Number( progressData?.pageviews || 0 ).toLocaleString() }
									</span>
								</div>
								{ progressData?.current_table && (
									<div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 col-span-2 sm:col-span-1 flex flex-col justify-center gap-1.5">
										<span className="text-text-gray block text-xs font-medium leading-none">
											{ __( 'Current table', 'burst-statistics' ) }
										</span>
										<span className="text-text-black font-semibold text-xs font-mono truncate block bg-white border border-gray-200/80 px-2 py-1 rounded mt-0.5" title={ progressData.current_table }>
											{ progressData.current_table }
										</span>
									</div>
								) }
							</div>

							{ /* Cancel Button */ }
							<div className="pt-4 flex justify-end border-t border-gray-200/80">
								<ButtonInput
									btnVariant="danger"
									size="sm"
									disabled={ cancelImportMutation.isPending }
									onClick={ () => cancelImportMutation.mutate( progressData?.import_id ) }
								>
									{ cancelImportMutation.isPending ? __( 'Cancelling...', 'burst-statistics' ) : __( 'Cancel import', 'burst-statistics' ) }
								</ButtonInput>
							</div>
						</div>
					) : (
						<>
							{ /* Provider Header Row */ }
							<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-4">
								<div className="min-w-0">
									<h4 className="text-sm font-semibold text-text-black m-0 leading-snug">
										{ currentSourceMeta?.name }
									</h4>
									<p className="text-xs text-text-gray m-0 mt-0.5 leading-relaxed max-w-xs">
										{ 'burst' === selectedSource ?
											__( 'Upload your Burst export archive (.sql.gz, .sql, or .zip) to restore historical data.', 'burst-statistics' ) :
											( isLocalSource ?
												__( 'Import directly from the local database or upload an export archive.', 'burst-statistics' ) :
												__( 'Upload your export archive (.csv / .zip) to import historical data.', 'burst-statistics' ) ) }
									</p>
								</div>

								{ /* Dual Mode Switcher (Matching TabsList.tsx) */ }
								{ isLocalSource && isLocalDetected && (
									<div className="grid grid-flow-col auto-cols-fr gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shrink-0 shadow-xs self-start">
										<button
											type="button"
											onClick={ () => setImportMode( 'database' ) }
											className={ clsx(
												'text-xs px-3 py-1.5 transition-colors rounded-sm font-medium border border-transparent cursor-pointer whitespace-nowrap',
												'database' === importMode ?
													'bg-white text-text-black shadow-xs font-semibold' :
													'text-text-gray hover:text-text-black'
											) }
										>
											{ __( 'Local database', 'burst-statistics' ) }
										</button>
										<button
											type="button"
											onClick={ () => setImportMode( 'upload' ) }
											className={ clsx(
												'text-xs px-3 py-1.5 transition-colors rounded-sm font-medium border border-transparent cursor-pointer whitespace-nowrap',
												'upload' === importMode ?
													'bg-white text-text-black shadow-xs font-semibold' :
													'text-text-gray hover:text-text-black'
											) }
										>
											{ __( 'Upload file', 'burst-statistics' ) }
										</button>
									</div>
								) }
							</div>

							{ /* DIRECT DATABASE VIEW */ }
							{ 'database' === activeMode && (
								<div className="flex flex-col gap-4">
									<div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
										<div className="flex items-center justify-between text-xs">
											<span className="text-text-gray">{ __( 'Connection status', 'burst-statistics' ) }</span>
											<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
												<span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" />
												{ __( 'Source tables detected', 'burst-statistics' ) }
											</span>
										</div>
										{ sourceStatus?.estimate && (
											<div className="flex items-center justify-between text-xs">
												<span className="text-text-gray">{ __( 'Estimated records', 'burst-statistics' ) }</span>
												<span className="font-semibold text-text-black text-xs">
													{ Number( sourceStatus.estimate.total_records ).toLocaleString() }
												</span>
											</div>
										) }
										{ sourceStatus?.estimate?.date_start && (
											<div className="flex items-center justify-between text-xs">
												<span className="text-text-gray">{ __( 'Available date range', 'burst-statistics' ) }</span>
												<span className="text-text-black text-xs font-medium">
													{ sourceStatus.estimate.date_start } – { sourceStatus.estimate.date_end }
												</span>
											</div>
										) }
										{ burstTrackingStart?.formatted && (
											<div className="flex items-center justify-between text-xs">
												<span className="text-text-gray">{ __( 'Burst tracking started', 'burst-statistics' ) }</span>
												<span className="text-text-black text-xs font-medium">
													{ burstTrackingStart.formatted }
												</span>
											</div>
										) }
									</div>

									{ sourceStatus?.estimate && 0 === Number( sourceStatus.estimate.total_records ) && (
										<div className="py-1">
											<InsightCallout>
												{ sprintf(

													/* translators: %s: date */
													__( 'All detected records in this source were logged after Burst began tracking (%s). No prior historical data is available to import.', 'burst-statistics' ),
													burstTrackingStart?.formatted || __( 'Burst activation', 'burst-statistics' )
												) }
											</InsightCallout>
										</div>
									) }

									<div className="py-1">
										<InsightCallout>
											{ sprintf(

												/* translators: %s: formatted date when Burst started tracking */
												__( 'Burst reads statistics directly from your local database in background batches. To prevent duplicate data, only records prior to %s (when Burst began tracking) will be imported. Each database source can only be imported once. Your existing data will not be modified, and you can roll back at any time.', 'burst-statistics' ),
												burstTrackingStart?.formatted || __( 'Burst activation', 'burst-statistics' )
											) }
										</InsightCallout>
									</div>

									{ isDatabaseAlreadyImported && (
										<div className="py-1">
											<InsightCallout>
												{ __( 'This database source has already been imported. To prevent duplicate records, database sources cannot be re-imported. If you need to re-import, roll back the previous import first.', 'burst-statistics' ) }
											</InsightCallout>
										</div>
									) }
								</div>
							) }

							{ /* CHUNKED FILE UPLOAD VIEW */ }
							{ 'upload' === activeMode && (
								<div className="flex flex-col gap-4">
									{ isLocalSource && ! isLocalDetected && (
										<div className="py-1">
											<InsightCallout>
												{ __( 'This plugin is not active on this site. If migrating from another server, export the dataset from that environment and upload below.', 'burst-statistics' ) }
											</InsightCallout>
										</div>
									) }

									{ uploadedFilePath ? (
										<div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/60">
											<Icon name="file" size={ 20 } className="text-primary shrink-0" />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-semibold text-text-black truncate m-0">
													{ uploadedFileName }
												</p>
												<p className="text-xs text-text-gray m-0 mt-0.5">
													{ formatFileSize( uploadedFileSize ) } { __( '· Ready to import', 'burst-statistics' ) }
												</p>
											</div>
											<button
												type="button"
												onClick={ () => {
													setUploadedFilePath( '' );
													setUploadedFileName( '' );
													setUploadedFileSize( 0 );
												} }
												className="p-1 rounded hover:bg-gray-200 text-text-gray hover:text-text-black transition-colors cursor-pointer"
												title={ __( 'Remove file', 'burst-statistics' ) }
											>
												<Icon name="times" size={ 16 } />
											</button>
										</div>
									) : (
										<div
											onDragOver={ ( e ) => {
												e.preventDefault();
												e.stopPropagation();
											} }
											onDragEnter={ ( e ) => {
												e.preventDefault();
												e.stopPropagation();
												setIsDragging( true );
											} }
											onDragLeave={ ( e ) => {
												e.preventDefault();
												e.stopPropagation();
												setIsDragging( false );
											} }
											onDrop={ ( e ) => {
												e.preventDefault();
												e.stopPropagation();
												setIsDragging( false );
												handleFileSelect( e.dataTransfer.files?.[0]);
											} }
											onClick={ () => fileInputRef.current?.click() }
											className={ clsx(
												'border-2 border-dashed rounded-lg py-8 px-6 text-center transition-colors cursor-pointer',
												isDragging ?
													'border-primary bg-primary-100/40' :
													'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
											) }
										>
											<input
												ref={ fileInputRef }
												type="file"
												id="burst-import-file-input"
												className="hidden"
												accept=".csv,.zip,.json,.ndjson,.gz,.sql"
												onChange={ handleInputChange }
											/>
											<div className="flex flex-col items-center gap-2">
												<div className="w-9 h-9 rounded-full bg-gray-200/80 flex items-center justify-center text-text-gray">
													<Icon name="upload" size={ 17 } />
												</div>
												<div className="text-sm text-text-black">
													<span className="text-primary font-semibold">
														{ __( 'Click to browse', 'burst-statistics' ) }
													</span>
													{ ' ' }
													{ __( 'or drag & drop', 'burst-statistics' ) }
												</div>
												<p className="text-xs text-text-gray-light max-w-xs m-0">
													{ 'burst' === selectedSource ?
														__( 'Burst backup archives (.sql.gz, .sql, or .zip), streamed in 2 MB slices.', 'burst-statistics' ) :
														__( 'CSV, ZIP, SQL, or GZ archives, streamed in 2 MB slices.', 'burst-statistics' ) }
												</p>
											</div>
										</div>
									) }

									{ uploadedFilePath && burstTrackingStart?.formatted && (
										<div className="py-1">
											<InsightCallout>
												{ sprintf(

													/* translators: %s: formatted date */
													__( 'To avoid duplicate data, any rows dated on or after %s (when Burst began tracking) will be skipped automatically during import. Identical files that have already been imported will be rejected. Note: Re-exported files covering the same historic period cannot be detected as duplicates if file contents or export timestamps differ.', 'burst-statistics' ),
													burstTrackingStart.formatted
												) }
											</InsightCallout>
										</div>
									) }

									{ isUploading && (
										<div className="flex flex-col gap-1.5 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200">
											<div className="flex justify-between text-xs font-semibold text-text-black">
												<span className="flex items-center gap-1.5">
													<Icon name="loading" size={ 13 } className="text-primary animate-spin" />
													{ uploadChunkInfo || __( 'Uploading slices...', 'burst-statistics' ) }
												</span>
												<span className="text-primary font-bold">{ uploadProgress }%</span>
											</div>
											<div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
												<div
													className="bg-primary h-1.5 rounded-full transition-all duration-300"
													style={ { width: `${ uploadProgress }%` } }
												/>
											</div>
										</div>
									) }
								</div>
							) }

							{ /* Action Buttons */ }
							<div className="pt-4 mt-6 flex items-center justify-between border-t border-gray-200">
								<ButtonInput
									btnVariant="tertiary"
									onClick={ () => setCurrentStep( 1 ) }
								>
									{ __( 'Previous', 'burst-statistics' ) }
								</ButtonInput>

								<ButtonInput
									btnVariant="primary"
									disabled={
										isUpgradeRunning ||
										startImportMutation.isPending ||
										isUploading ||
										( 'upload' === activeMode && ! uploadedFilePath ) ||
										( 'database' === activeMode && 0 === Number( sourceStatus?.estimate?.total_records || 0 ) ) ||
										( 'database' === activeMode && isDatabaseAlreadyImported )
									}
									onClick={ () =>
										startImportMutation.mutate({
											source: selectedSource,
											upload_id: 'upload' === activeMode ? uploadedFilePath : '',
											file_path: 'upload' === activeMode ? uploadedFilePath : ''
										})
									}
								>
									{ startImportMutation.isPending ? (
										<span className="flex items-center gap-2">
											<Icon name="loading" size={ 14 } className="animate-spin" />
											<span>{ __( 'Starting...', 'burst-statistics' ) }</span>
										</span>
									) : (
										'database' === activeMode ? __( 'Start database import', 'burst-statistics' ) : __( 'Start file import', 'burst-statistics' )
									) }
								</ButtonInput>
							</div>
						</>
					) }
				</div>
			) }

			{ /* History & Rollback Panel — always visible, separated from step content */ }
			{ ( ( historyData && 0 < historyData.length ) || isProcessing ) && (
				<div className="mt-10 pt-7 border-t border-gray-200/80">
					<ImportHistoryPanel
						historyData={ historyData || [] }
						formatSourceName={ formatSourceName }
						rollbackMutation={ rollbackMutation }
						clearHistoryMutation={ clearHistoryMutation }
					/>
				</div>
			) }
		</div>
	);
};

// ─── Import History Panel ─────────────────────────────────────────────────────

const STATUS_META = {
	completed: { label: __( 'Completed', 'burst-statistics' ), color: 'text-primary' },
	processing: { label: __( 'Processing', 'burst-statistics' ), color: 'text-orange' },
	cancelled: { label: __( 'Cancelled', 'burst-statistics' ), color: 'text-text-gray' },
	failed: { label: __( 'Failed', 'burst-statistics' ), color: 'text-red' },
	rolled_back: { label: __( 'Rolled back', 'burst-statistics' ), color: 'text-text-gray' }
};

// fallow-ignore-next-line complexity
const ImportHistoryRow = ({
	item,
	formatSourceName,
	formatTimestamp,
	rollbackMutation
}) => {
	const statusMeta = STATUS_META[ item.status ] || { label: item.status, color: 'text-text-gray' };

	const canRollback = ( 'completed' === item.status || 'cancelled' === item.status || 'failed' === item.status ) &&
		0 < Number( item.rows_imported || 0 );

	return (
		<div key={ item.id } className="px-5 py-4 flex items-center gap-3.5 hover:bg-gray-50/50 transition-colors">
			{ /* Status dot */ }
			<div className={ clsx(
				'w-2.5 h-2.5 rounded-full shrink-0 mt-0.5',
				'completed' === item.status && 'bg-primary',
				'failed' === item.status && 'bg-red-500',
				'cancelled' === item.status && 'bg-gray-400',
				'rolled_back' === item.status && 'bg-gray-400'
			) } />

			{ /* Primary info */ }
			<div className="flex-1 min-w-0 flex flex-col gap-1">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs font-semibold text-text-black capitalize leading-normal">
						{ formatSourceName( item.source ) }
					</span>
					<span className={ clsx( 'text-xs font-medium capitalize leading-normal', statusMeta.color ) }>
						{ statusMeta.label }
					</span>
				</div>
				<div className="flex items-center gap-2 text-xs text-text-gray">
					{ 0 < ( item.rows_imported || 0 ) && (
						<span>{ Number( item.rows_imported ).toLocaleString() } { __( 'rows', 'burst-statistics' ) }</span>
					) }
					{ item.created_at && (
						<>
							<span className="text-gray-400">·</span>
							<span>{ formatTimestamp( item.created_at ) }</span>
						</>
					) }
				</div>
			</div>

			{ /* Action */ }
			{ canRollback && (
				<ButtonInput
					btnVariant="danger"
					size="sm"
					onClick={ () => rollbackMutation.mutate( item.id ) }
					disabled={ rollbackMutation.isPending }
				>
					{ __( 'Rollback', 'burst-statistics' ) }
				</ButtonInput>
			) }
		</div>
	);
};

// fallow-ignore-next-line complexity
const ImportHistoryPanel = ({
	historyData,
	formatSourceName,
	rollbackMutation,
	clearHistoryMutation
}) => {
	const [ isExpanded, setIsExpanded ] = useState( false );

	const sortedHistory = useMemo( () => {
		if ( ! Array.isArray( historyData ) ) {
			return [];
		}
		return [ ...historyData ].sort( ( a, b ) => {
			if ( 'processing' === a.status && 'processing' !== b.status ) {
				return -1;
			}
			if ( 'processing' !== a.status && 'processing' === b.status ) {
				return 1;
			}
			return Number( b.id ) - Number( a.id );
		});
	}, [ historyData ]);

	const hasTerminalItems = useMemo( () => {
		if ( ! Array.isArray( historyData ) ) {
			return false;
		}
		return historyData.some( ( item ) => 'processing' !== item.status );
	}, [ historyData ]);

	const VISIBLE_COUNT = 3;
	const hasMore = sortedHistory.length > VISIBLE_COUNT;
	const displayedRows = isExpanded ? sortedHistory : sortedHistory.slice( 0, VISIBLE_COUNT );

	const formatTimestamp = ( ts ) => {
		if ( ! ts ) {
			return '';
		}

		try {
			const date = new Date( ts * 1000 );
			return date.toLocaleDateString( undefined, { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return '';
		}
	};

	return (
		<div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-xs">
			{ /* Panel header */ }
			<div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between gap-4">
				<div className="flex items-center gap-2.5">
					<span className="text-xs font-semibold text-text-black uppercase tracking-wider">
						{ __( 'Import history', 'burst-statistics' ) }
					</span>
					<span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-gray-200 text-[10px] font-semibold text-text-gray">
						{ sortedHistory.length }
					</span>
				</div>
				<div className="flex items-center gap-3">
					{ hasTerminalItems && (
						<button
							type="button"
							onClick={ () => clearHistoryMutation?.mutate() }
							disabled={ clearHistoryMutation?.isPending }
							className="inline-flex items-center gap-1 text-xs text-text-gray hover:text-red transition-colors cursor-pointer"
							title={ __( 'Clear completed and rolled-back imports from history', 'burst-statistics' ) }
						>
							<Icon name="trash" size={ 12 } />
							<span>{ clearHistoryMutation?.isPending ? __( 'Clearing...', 'burst-statistics' ) : __( 'Clear history', 'burst-statistics' ) }</span>
						</button>
					) }
				</div>
			</div>

			{ /* Row list */ }
			<div className={ clsx( 'divide-y divide-gray-100', isExpanded && 'max-h-[380px] overflow-y-auto' ) }>
				{ displayedRows.map( ( item ) => (
					<ImportHistoryRow
						key={ item.id }
						item={ item }
						formatSourceName={ formatSourceName }
						formatTimestamp={ formatTimestamp }
						rollbackMutation={ rollbackMutation }
					/>
				) ) }
			</div>

			{ /* Footer hint */ }
			{ hasMore && (
				<div
					className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-center cursor-pointer hover:bg-gray-100 transition-colors"
					onClick={ () => setIsExpanded( ( v ) => ! v ) }
				>
					<span className="text-xs text-text-gray hover:text-primary transition-colors font-medium">
						{ isExpanded ?
							__( 'Show less', 'burst-statistics' ) :
							sprintf( __( '+ %d more import(s)', 'burst-statistics' ), sortedHistory.length - VISIBLE_COUNT )
						}
					</span>
				</div>
			) }
		</div>
	);
};

ImportDataField.displayName = 'ImportDataField';
export default ImportDataField;
