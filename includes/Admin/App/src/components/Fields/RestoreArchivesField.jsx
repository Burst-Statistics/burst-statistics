import { useState, useEffect, forwardRef } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import useArchiveStore from '@/store/useArchivesStore';
import useSettingsData from '@/hooks/useSettingsData';
import DataTable from 'react-data-table-component';
import useLicenseData from '@/hooks/useLicenseData';
import { useQuery } from '@tanstack/react-query';

const RestoreArchivesField = forwardRef( () => {
	const [ searchValue, setSearchValue ] = useState( '' );
	const [ selectedArchives, setSelectedArchives ] = useState([]);
	const [ downloading, setDownloading ] = useState( false );
	const [ pagination, setPagination ] = useState({});
	const [ indeterminate, setIndeterminate ] = useState( false );
	const [ entirePageSelected, setEntirePageSelected ] = useState( false );
	const [ sortBy, setSortBy ] = useState( 'title' );
	const [ sortDirection, setSortDirection ] = useState( 'asc' );
	const [ localProgress, setLocalProgress ] = useState( 0 );

	const archives = useArchiveStore( ( state ) => state.archives );
	const fetching = useArchiveStore( ( state ) => state.fetching );
	const fetchData = useArchiveStore( ( state ) => state.fetchData );
	const deleteArchives = useArchiveStore( ( state ) => state.deleteArchives );
	const downloadUrl = useArchiveStore( ( state ) => state.downloadUrl );
	const startRestoreArchives = useArchiveStore(
		( state ) => state.startRestoreArchives
	);
	const fetchRestoreArchivesProgress = useArchiveStore(
		( state ) => state.fetchRestoreArchivesProgress
	);
	const restoring = useArchiveStore( ( state ) => state.restoring );
	const progress = useArchiveStore( ( state ) => state.progress );
	const { addNotice } = useSettingsData();
	const { isPro } = useLicenseData();

	const { isFetching } = useQuery({
		queryFn: () => fetchRestoreArchivesProgress(),
		queryKey: [ 'restore-archives-progress' ],
		refetchInterval: restoring ? 5000 : false
	});

	// Update local progress from server progress when fetch completes
	useEffect( () => {
		if ( ! isFetching && progress !== undefined ) {
			setLocalProgress( progress );
		}
	}, [ isFetching, progress ]);

	// Update local progress from server progress when fetch completes
	useEffect( () => {
		if ( ! isFetching && progress !== undefined ) {
			setLocalProgress( progress );
		}
	}, [ isFetching, progress ]);

	// Increment local progress every second when restoring and not fetching
	useEffect( () => {
		if ( ! restoring || 100 <= localProgress ) {
			return;
		}

		const interval = setInterval( () => {
			setLocalProgress( ( prev ) => {

				// Only increment if not currently fetching and below 100
				if ( ! isFetching && 100 > prev ) {
					return Math.min( prev + 1, 99 ); // Cap at 99 until real progress arrives
				}
				return prev;
			});
		}, 2000 );

		return () => clearInterval( interval );
	}, [ restoring, isFetching, localProgress ]);

	// Reset local progress when restoring stops
	useEffect( () => {
		if ( ! restoring ) {
			setLocalProgress( 0 );
		}
	}, [ restoring ]);

	useEffect( () => {
		let mounted = true;

		const loadData = async() => {
			if ( mounted ) {
				await fetchData( isPro );
			}
		};

		loadData();

		return () => {
			mounted = false;
		};
	}, [ isPro, fetchData ]);

	const handlePageChange = ( page ) => {
		setPagination({ ...pagination, currentPage: page });
	};

	const updateSelectedArchives = ( ids ) => {
		try {
			if ( 0 === ids.length ) {
				setEntirePageSelected( false );
				setIndeterminate( false );
			}
			setSelectedArchives( ids );
		} catch ( e ) { // eslint-disable-line @typescript-eslint/no-unused-vars

			// Component was unmounted, ignore the error
			console.log( 'Component unmounted, ignoring state update' );
		}
	};

	const onDeleteArchives = async( e, ids ) => {
		e.preventDefault();
		updateSelectedArchives([]);
		await deleteArchives( ids );
	};

	const onRestoreArchives = async( e, ids ) => {
		e.preventDefault();
		updateSelectedArchives([]);
		await startRestoreArchives( ids );
		addNotice(
			'archive_data',
			'warning',
			__(
				'Because restoring files can conflict with the archiving functionality, archiving has been disabled.',
				'burst-statistics'
			),
			__( 'Archiving disabled', 'burst-statistics' )
		);
	};

	const downloadArchives = async( e ) => {
		e.preventDefault();
		const selectedArchivesCopy = archives.filter( ( archive ) =>
			selectedArchives.includes( archive.id )
		);
		setDownloading( true );
		const downloadNext = async() => {
			if ( 0 < selectedArchivesCopy.length ) {
				const archive = selectedArchivesCopy.shift();
				const url = downloadUrl + archive.id;

				try {
					const request = new XMLHttpRequest();
					request.responseType = 'blob';
					request.open( 'get', url, true );
					request.send();
					request.onreadystatechange = function() {
						if ( 4 === this.readyState && 200 === this.status ) {
							const obj = window.URL.createObjectURL(
								this.response
							);
							const element = window.document.createElement( 'a' );
							element.href = obj;
							element.download = archive.title;
							element.style.display = 'none';
							document.body.appendChild( element );
							element.click();
							document.body.removeChild( element ); // prevents redirect

							updateSelectedArchives(
								selectedArchivesCopy.map(
									( archive ) => archive.id
								)
							);

							setDownloading( false );

							setTimeout( function() {
								window.URL.revokeObjectURL( obj );
							}, 60 * 1000 );
						}
					};

					await downloadNext();
				} catch ( error ) {
					console.error( error );
					setDownloading( false );
				}
			} else {
				setDownloading( false );
			}
		};

		await downloadNext();
	};

	const handleSelectEntirePage = ( selected ) => {
		if ( selected ) {
			setEntirePageSelected( true );
			const currentPage = pagination.currentPage ?
				pagination.currentPage :
				1;
			const filtered = handleFiltering( archives );
			const archivesOnPage = filtered.slice(
				( currentPage - 1 ) * 10,
				currentPage * 10
			);
			setSelectedArchives( archivesOnPage.map( ( archive ) => archive.id ) );
		} else {
			setEntirePageSelected( false );
			setSelectedArchives([]);
		}
		setIndeterminate( false );
	};

	const onSelectArchive = ( selected, id ) => {
		let docs = [ ...selectedArchives ];
		if ( selected ) {
			if ( ! docs.includes( id ) ) {
				docs.push( id );
				setSelectedArchives( docs );
			}
		} else {
			docs = [
				...selectedArchives.filter( ( archiveId ) => archiveId !== id )
			];
			setSelectedArchives( docs );
		}

		const currentPage = pagination.currentPage ? pagination.currentPage : 1;
		const filtered = handleFiltering( archives );
		const archivesOnPage = filtered.slice(
			( currentPage - 1 ) * 10,
			currentPage * 10
		);
		let allSelected = true;
		let hasOneSelected = false;
		archivesOnPage.forEach( ( record ) => {
			if ( ! docs.includes( record.id ) ) {
				allSelected = false;
			} else {
				hasOneSelected = true;
			}
		});

		if ( allSelected ) {
			setEntirePageSelected( true );
			setIndeterminate( false );
		} else if ( ! hasOneSelected ) {
			setIndeterminate( false );
		} else {
			setEntirePageSelected( false );
			setIndeterminate( true );
		}
	};

	const handleFiltering = ( archives ) => {
		let newArchives = [ ...archives ];
		newArchives = handleSort( newArchives, sortBy, sortDirection );
		newArchives = newArchives.filter( ( archive ) => {
			return archive.title
				.toLowerCase()
				.includes( searchValue.toLowerCase() );
		});
		return newArchives;
	};

	const handleSort = ( rows, selector, direction ) => {
		if ( 0 === rows.length ) {
			return rows;
		}
		const multiplier = 'asc' === direction ? 1 : -1;
		if ( direction !== sortDirection ) {
			setSortDirection( direction );
		}
		const convertToBytes = ( size ) => {
			const units = {
				B: 1,
				KB: 1024,
				MB: 1024 * 1024
			};

			const [ value, unit ] = size.split( ' ' );

			return parseFloat( value ) * units[unit];
		};
		if ( -1 !== selector.toString().indexOf( 'title' ) && 'title' !== sortBy ) {
			setSortBy( 'title' );
		} else if (
			-1 !== selector.toString().indexOf( 'size' ) &&
			'size' !== sortBy
		) {
			setSortBy( 'size' );
		}
		if ( 'title' === sortBy ) {
			rows.sort( ( a, b ) => {
				const [ yearA, monthA ] = a.id
					.replace( '.zip', '' )
					.split( '-' )
					.map( Number );
				const [ yearB, monthB ] = b.id
					.replace( '.zip', '' )
					.split( '-' )
					.map( Number );

				if ( yearA !== yearB ) {
					return multiplier * ( yearA - yearB );
				}
				return multiplier * ( monthA - monthB );
			});
		} else if ( 'size' === sortBy ) {
			rows.sort( ( a, b ) => {
				const sizeA = convertToBytes( a.size );
				const sizeB = convertToBytes( b.size );

				return multiplier * ( sizeA - sizeB );
			});
		}
		return rows;
	};

	const columns = [
		{
			name: (
				<input
					type="checkbox"
					className={indeterminate ? 'burst-indeterminate' : ''}
					checked={entirePageSelected}
					disabled={fetching || 0 === archives.length || restoring}
					onChange={( e ) => handleSelectEntirePage( e.target.checked )}
				/>
			),
			selector: ( row ) => row.selectControl,
			width: '60px'
		},
		{
			name: __( 'Archive', 'burst-statistics' ),
			selector: ( row ) => row.title,
			sortable: true
		},
		{
			name: __( 'Size', 'burst-statistics' ),
			selector: ( row ) => row.size,
			sortable: true,
			width: '120px',
			style: {
				justifyContent: 'flex-end' // replaces right:true
			}
		}
	];

	const filteredArchives = handleFiltering( archives );
	const data = [];
	filteredArchives.forEach( ( archive ) => {
		const archiveCopy = { ...archive };
		archiveCopy.selectControl = (
			<input
				type="checkbox"
				className="m-0"
				disabled={archiveCopy.restoring || restoring}
				checked={selectedArchives.includes( archiveCopy.id )}
				onChange={( e ) =>
					onSelectArchive( e.target.checked, archiveCopy.id )
				}
			/>
		);
		data.push( archiveCopy );
	});

	let showDownloadButton = 1 < selectedArchives.length;
	if ( ! showDownloadButton && 1 === selectedArchives.length ) {
		const currentSelected = archives.filter( ( archive ) =>
			selectedArchives.includes( archive.id )
		);
		showDownloadButton =
			Object.prototype.hasOwnProperty.call( currentSelected, 0 ) &&
			'' !== currentSelected[0].download_url;
	}
	const displayProgress = restoring ? localProgress : 0;

	return (
		<div className="w-full p-6">
			<div className="flex py-2.5 px-6 justify-between">
				<input
					type="text"
					placeholder={__( 'Search', 'burst-statistics' )}
					value={searchValue}
					onChange={( e ) => setSearchValue( e.target.value )}
				/>

				{restoring && (
					<div className="flex items-center justify-end text-gray-400 w-full gap-1 restore-processing">
						{displayProgress} %<Icon name="loading" color="gray" />
					</div>
				)}
			</div>

			{0 < selectedArchives.length && (
				<div className="mt-[10px] mb-[10px] items-center bg-blue-light py-2.5 px-6 flex space-y-2">
					<div className="flex mb-4 mt-4 justify-between items-center w-full">
						<div>
							{0 < selectedArchives.length &&
								sprintf(
									_n(
										'%s item selected',
										'%s items selected',
										selectedArchives.length,
										'burst-statistics'
									),
									selectedArchives.length
								)}
						</div>

						<div className="flex gap-2.5">
							{showDownloadButton && (
								<button
									disabled={
										downloading ||
										( progress && 100 > progress )
									}
									className="burst-button burst-button--secondary"
									onClick={( e ) => downloadArchives( e )}
								>
									{__( 'Download', 'burst-statistics' )}

									{downloading && (
										<Icon name="loading" color="gray" />
									)}
								</button>
							)}

							<button
								disabled={progress && 100 > progress}
								className="burst-button burst-button--primary"
								onClick={( e ) =>
									onRestoreArchives( e, selectedArchives )
								}
							>
								{__( 'Restore', 'burst-statistics' )}
								{100 > progress && (
									<Icon name="loading" color="gray" />
								)}
							</button>

							<button
								disabled={progress && 100 > progress}
								className="burst-button burst-button--tertiary"
								onClick={( e ) =>
									onDeleteArchives( e, selectedArchives )
								}
							>
								{__( 'Delete', 'burst-statistics' )}
							</button>
						</div>
					</div>
				</div>
			)}

			{DataTable && (
				<DataTable
					columns={columns}
					data={data}
					dense
					paginationPerPage={10}
					onChangePage={handlePageChange}
					paginationState={pagination}
					persistTableHead
					defaultSortFieldId={2}
					pagination
					paginationRowsPerPageOptions={[ 10, 25, 50 ]}
					paginationComponentOptions={{
						rowsPerPageText: '',
						rangeSeparatorText: __( 'of', 'burst-statistics' ),
						noRowsPerPage: false,
						selectAllRowsItem: true,
						selectAllRowsItemText: __( 'All', 'burst-statistics' )
					}}
					noDataComponent={
						<div className="p-8">
							{__( 'No archives', 'burst-statistics' )}
						</div>
					}
					sortFunction={handleSort}
				/>
			)}
		</div>
	);
});

RestoreArchivesField.displayName = 'RestoreArchivesField';

export default RestoreArchivesField;
