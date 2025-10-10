import { useState, useEffect, forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import useArchiveStore from '@/store/useArchivesStore';
import useSettingsData from '@/hooks/useSettingsData';
import DataTable from 'react-data-table-component';

const RestoreArchivesField = forwardRef(
    ({ ...props }, ref) => {
  const [ searchValue, setSearchValue ] = useState( '' );
  const [ selectedArchives, setSelectedArchives ] = useState([]);
  const [ downloading, setDownloading ] = useState( false );
  const [ pagination, setPagination ] = useState({});
  const [ indeterminate, setIndeterminate ] = useState( false );
  const [ entirePageSelected, setEntirePageSelected ] = useState( false );
  const [ sortBy, setSortBy ] = useState( 'title' );
  const [ sortDirection, setSortDirection ] = useState( 'asc' );


  const archives = useArchiveStore( state => state.archives );
  const archivesLoaded = useArchiveStore( state => state.archivesLoaded );
  const fetching = useArchiveStore( state => state.fetching );
  const fetchData = useArchiveStore( state => state.fetchData );
  const deleteArchives = useArchiveStore( state => state.deleteArchives );
  const downloadUrl = useArchiveStore( state => state.downloadUrl );
  const startRestoreArchives = useArchiveStore( state => state.startRestoreArchives );
  const fetchRestoreArchivesProgress = useArchiveStore( state => state.fetchRestoreArchivesProgress );
  const restoring = useArchiveStore( state => state.restoring );
  const progress = useArchiveStore( state => state.progress );
  const {addNotice} = useSettingsData();

  useEffect( () => {
    fetchRestoreArchivesProgress();
  }, []);

  useEffect( () => {
    if ( ! archivesLoaded ) {
      fetchData();
    }
  }, [ archivesLoaded ]);

  const handlePageChange = ( page ) => {
    setPagination({ ...pagination, currentPage: page });
  };

  const updateSelectedArchives = ( ids ) => {
    if ( 0 === ids.length ) {
      setEntirePageSelected( false );
      setIndeterminate( false );
    }
    setSelectedArchives( ids );
  }

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
      __( 'Because restoring files can conflict with the archiving functionality, archiving has been disabled.', 'burst-statistics' ),
      __( 'Archiving disabled', 'burst-statistics' )
    );
  };

  const downloadArchives = async(e) => {
    e.preventDefault();
    let selectedArchivesCopy = archives.filter( ( archive ) =>
      selectedArchives.includes( archive.id )
    );
    setDownloading( true );
    const downloadNext = async() => {
      if ( 0 < selectedArchivesCopy.length ) {
        const archive = selectedArchivesCopy.shift();
        const url = downloadUrl + archive.id;

        try {
          let request = new XMLHttpRequest();
          request.responseType = 'blob';
          request.open( 'get', url, true );
          request.send();
          request.onreadystatechange = function() {
            if ( 4 === this.readyState && 200 === this.status ) {
              let obj = window.URL.createObjectURL( this.response );
              let element = window.document.createElement( 'a' );
              element.href = obj;
              element.download = archive.title;
              element.style.display = 'none';
              document.body.appendChild(element);
              element.click();
              document.body.removeChild(element); // prevents redirect

              updateSelectedArchives( selectedArchivesCopy );

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
      let currentPage = pagination.currentPage ? pagination.currentPage : 1;
      let filtered = handleFiltering( archives );
      let archivesOnPage = filtered.slice(
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
      docs = [ ...selectedArchives.filter( ( archiveId ) => archiveId !== id ) ];
      setSelectedArchives( docs );
    }

    let currentPage = pagination.currentPage ? pagination.currentPage : 1;
    let filtered = handleFiltering( archives );
    let archivesOnPage = filtered.slice(
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
      return archive.title.toLowerCase().includes( searchValue.toLowerCase() );
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
    } else if ( -1 !== selector.toString().indexOf( 'size' ) && 'size' !== sortBy ) {
      setSortBy( 'size' );
    }
    if ( 'title' === sortBy ) {
      rows.sort( ( a, b ) => {
        const [ yearA, monthA ] = a.id.replace( '.zip', '' ).split( '-' ).map( Number );
        const [ yearB, monthB ] = b.id.replace( '.zip', '' ).split( '-' ).map( Number );

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
          onChange={( e ) => handleSelectEntirePage( e.target.checked )}
        />
      ),
      selector: ( row ) => row.selectControl,
      grow: 1
    },
    {
      name: __( 'Archive', 'burst-statistics' ),
      selector: ( row ) => row.title,
      sortable: true,
      grow: 6
    },
    {
      name: __( 'Size', 'burst-statistics' ),
      selector: ( row ) => row.size,
      sortable: true,
      grow: 2,
      right: 1
    }
  ];

  let filteredArchives = handleFiltering( archives );
  let data = [];
  filteredArchives.forEach( ( archive ) => {
    let archiveCopy = { ...archive };
    archiveCopy.selectControl = (
      <input
        type="checkbox"
        className="m-0"
        disabled={archiveCopy.restoring || restoring}
        checked={selectedArchives.includes( archiveCopy.id )}
        onChange={( e ) => onSelectArchive( e.target.checked, archiveCopy.id )}
      />
    );
    data.push( archiveCopy );
  });

  let showDownloadButton = 1 < selectedArchives.length;
  if ( ! showDownloadButton && 1 === selectedArchives.length ) {
    let currentSelected = archives.filter( ( archive ) =>
      selectedArchives.includes( archive.id )
    );
    showDownloadButton =
      currentSelected.hasOwnProperty( 0 ) &&
      '' !== currentSelected[0].download_url;
  }

  return (
    <div className="w-full p-6">
      <div className="py-2.5 px-6">
        <div>
          <input
            type="text"
            placeholder={__( 'Search', 'burst-statistics' )}
            value={searchValue}
            onChange={( e ) => setSearchValue( e.target.value )}
          />
        </div>
      </div>

      {0 < selectedArchives.length && (
          <div className="mt-[10px] mb-[10px] items-center bg-blue-light py-2.5 px-6 flex space-y-2">
            <div className="ml-auto flex gap-2.5 mb-4 mt-4 items-center">
              {showDownloadButton && (
                  <>
                    <button
                        disabled={downloading || (progress && 100 > progress)}
                        className="burst-button burst-button--secondary"
                        onClick={(e) => downloadArchives(e)}
                    >
                      {__('Download', 'burst-statistics')}
                      {downloading && <Icon name="loading" color="gray"/>}
                    </button>
                  </>
              )}
              <button
                  disabled={progress && 100 > progress}
                  className="burst-button burst-button--primary"
                  onClick={(e) => onRestoreArchives(e, selectedArchives)}
              >
                {__('Restore', 'burst-statistics')}
                {100 > progress && <Icon name="loading" color="gray"/>}
              </button>
              <button
                  disabled={progress && 100 > progress}
                  className="burst-button burst-button--tertiary"
                  onClick={(e) => onDeleteArchives(e, selectedArchives)}
              >
                {__('Delete', 'burst-statistics')}
              </button>
              <div>
                {1 < selectedArchives.length &&
                    __('%s items selected', 'burst-statistics').replace(
                        '%s',
                        selectedArchives.length
                    )}
                {1 === selectedArchives.length &&
                    __('1 item selected', 'burst-statistics')}
              </div>
            </div>

          </div>
      )}
      {0 < progress && 100 > progress && (
          <div className="my-2.5 items-center bg-blue-light py-2.5 px-l flex space-y-2">
            {__('Restore in progress, %s complete', 'burst-statistics').replace(
                '%s',
                progress + '%'
            )}
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

export default RestoreArchivesField;
