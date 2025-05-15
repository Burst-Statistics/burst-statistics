import useArchiveStore from '../../../store/useArchivesStore';
import {useState, useEffect} from '@wordpress/element';
import {__} from '@wordpress/i18n';
import Icon from '../../../utils/Icon';
import {useFields} from '../../../store/useFieldsStore';

const RestoreArchivesControl = () => {
  const [ DataTable, setDataTable ] = useState( null );
  useEffect( () => {
    import( 'react-data-table-component' ).then( ({default: DataTable}) => {
      setDataTable( () => DataTable );
    });
  }, []);
  let columns = [];
  if ( ! burst_settings.is_pro ) {
    columns = [
      {
        name: <input type="checkbox" disabled={true}/>,
        grow: 1
      },
      {
        name: __( 'Archive', 'burst-statistics' ),
        grow: 6
      },
      {
        name: __( 'Size', 'burst-statistics' ),
        grow: 2,
        right: 1
      }
    ];

    // fake data
    const data = [
      {
        id: 1,
        title: '2021-01-01.zip',
        size: '1.2 MB',
        selectControl: <input type="checkbox" disabled={true}/>
      },
      {
        id: 2,
        title: '2021-02-01.zip',
        size: '1.2 MB',
        selectControl: <input type="checkbox" disabled={true}/>
      } ];
    return <>
        <div className="burst-table-header">
          <div className="burst-table-header-controls">
            <input className="burst-datatable-search" type="text"
                   placeholder={__( 'Search', 'burst-statistics' )} />
          </div>
        </div>
      {DataTable && <>
        <DataTable
          columns={columns}
          data={data}
          />
      </>}
    </>;
  }

  const {
    archives,
    archivesLoaded,
    fetchData,
    deleteArchives,
    downloadUrl,
    startRestoreArchives,
    fetchRestoreArchivesProgress,
    restoring,
    progress
  } = useArchiveStore();
  const [ searchValue, setSearchValue ] = useState( '' );
  const [ selectedArchives, setSelectedArchives ] = useState([]);
  const [ downloading, setDownloading ] = useState( false );
  const paginationPerPage = 10;
  const [ pagination, setPagination ] = useState({});
  const [ indeterminate, setIndeterminate ] = useState( false );
  const [ entirePageSelected, setEntirePageSelected ] = useState( false );
  const [ sortBy, setSortBy ] = useState( 'title' );
  const [ sortDirection, setSortDirection ] = useState( 'asc' );
  const {addHelpNotice} = useFields();

  const handlePageChange = ( page ) => {
    setPagination({...pagination, currentPage: page});
  };

  //check if there's an export running
  useEffect( () => {
    fetchRestoreArchivesProgress();
  }, []);

  useEffect( () => {
    if ( 100 > progress && restoring ) {
      fetchRestoreArchivesProgress();
    }
  }, [ progress ]);

  useEffect( () => {
    if ( ! archivesLoaded ) {
      fetchData();
    }
  }, [ archivesLoaded ]);

  const onDeleteArchives = async( ids ) => {
    setSelectedArchives([]);
    await deleteArchives( ids );
  };

  const onRestoreArchives = async( ids ) => {
    setSelectedArchives([]);
    await startRestoreArchives( ids );
    addHelpNotice( 'archive_data', 'warning',
        __( 'Because restoring files can conflict with the archiving functionality, archiving has been disabled.',
            'burst-statistics' ), __( 'Archiving disabled', 'burst-statistics' ) );
  };

  const downloadArchives = async() => {

    //filter out all archives that are not included in selectedArchives
    let selectedArchivesCopy = archives.filter(
        archive => selectedArchives.includes( archive.id ) );
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
              element.setAttribute( 'href', obj );
              element.setAttribute( 'download', archive.title );
              window.document.body.appendChild( element );

              //onClick property
              element.click();
              setSelectedArchives( selectedArchivesCopy );
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

      //add all archives on this page to the selectedArchives array
      let currentPage = pagination.currentPage ? pagination.currentPage : 1;

      //get archives from currentPage * paginationPerPage to (currentPage+1) *
      // paginationPerPage
      let filtered = handleFiltering( archives );
      let archivesOnPage = filtered.slice( ( currentPage - 1 ) * paginationPerPage,
          currentPage * paginationPerPage );
      setSelectedArchives( archivesOnPage.map( archive => archive.id ) );
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

      //remove the archive from the selected archives
      docs = [ ...selectedArchives.filter( archiveId => archiveId !== id ) ];
      setSelectedArchives( docs );
    }

    //check if all archives on this page are selected
    let currentPage = pagination.currentPage ? pagination.currentPage : 1;

    //get archives from currentPage * paginationPerPage to (currentPage+1) *
    // paginationPerPage
    let filtered = handleFiltering( archives );
    let archivesOnPage = filtered.slice( ( currentPage - 1 ) * paginationPerPage,
        currentPage * paginationPerPage );
    let allSelected = true;
    let hasOneSelected = false;
    archivesOnPage.forEach( record => {
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

    //sort the plugins by 'sortBy'
    newArchives = newArchives.filter( archive => {
      return archive.title.toLowerCase().includes( searchValue.toLowerCase() );
    });
    return newArchives;
  };

  /**
   * Sort the rows by month and year provided in the 'date' column with the
   * format 'YYYYMM'
   * @param rows
   * @param selector
   * @param direction
   */
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
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024
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

        // Extract year and month from the id for each row
        const [ yearA, monthA ] = a.id.replace( '.zip', '' ).split( '-' ).map( Number );
        const [ yearB, monthB ] = b.id.replace( '.zip', '' ).split( '-' ).map( Number );

        // Compare years, then months
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

  columns = [
    {
      name: <input type="checkbox"
                   className={indeterminate ? 'burst-indeterminate' : ''}
                   checked={entirePageSelected}
                   onChange={( e ) => handleSelectEntirePage( e.target.checked )}/>,
      selector: row => row.selectControl,
      grow: 1
    },
    {
      name: __( 'Archive', 'burst-statistics' ),
      selector: row => row.title,
      sortable: true,
      grow: 6
    },
    {
      name: __( 'Size', 'burst-statistics' ),
      selector: row => row.size,
      sortable: true,
      grow: 2,
      right: 1
    }
  ];

  // filter the plugins by search value
  let filteredArchives = handleFiltering( archives );

  // add the controls to the plugins
  let data = [];
  filteredArchives.forEach( archive => {
    let archiveCopy = {...archive};
    archiveCopy.selectControl =
        <input type="checkbox" disabled={archiveCopy.restoring || restoring}
               checked={selectedArchives.includes( archiveCopy.id )}
               onChange={( e ) => onSelectArchive( e.target.checked,
                   archiveCopy.id )}/>;
    data.push( archiveCopy );
  });

  let showDownloadButton = 1 < selectedArchives.length;
  if ( ! showDownloadButton && 1 === selectedArchives.length ) {
    let currentSelected = archives.filter(
        archive => selectedArchives.includes( archive.id ) );
    showDownloadButton = currentSelected.hasOwnProperty( 0 ) &&
        '' !== currentSelected[0].download_url;
  }

  return (
      <>
        <div className="burst-table-header">
          <div className="burst-table-header-controls">
            <input className="burst-datatable-search" type="text"
                   placeholder={__( 'Search', 'burst-statistics' )}
                   value={searchValue}
                   onChange={( e ) => setSearchValue( e.target.value )}/>
          </div>
        </div>

        {
            0 < selectedArchives.length &&
            <div className="burst-selected-archive">
              {1 < selectedArchives.length &&
                  __( '%s items selected', 'burst-statistics' ).
                      replace( '%s', selectedArchives.length )}
              {1 === selectedArchives.length &&
                  __( '1 item selected', 'burst-statistics' )}
              <div className="burst-selected-archive-controls">
                {showDownloadButton && <>
                  <button disabled={downloading || ( progress && 100 > progress )}
                          className="burst-button burst-button--secondary"
                          onClick={() => downloadArchives()}>
                    {__( 'Download', 'burst-statistics' )}
                    {downloading && <Icon name="loading" color="grey"/>}
                  </button>
                </>}
                <button disabled={progress && 100 > progress}
                        className="burst-button burst-button--primary"
                        onClick={() => onRestoreArchives( selectedArchives )}>
                  {__( 'Restore', 'burst-statistics' )}
                  {100 > progress && <Icon name="loading" color="grey"/>}
                </button>
                <button disabled={progress && 100 > progress}
                        className="burst-button burst-button--tertiary"
                        onClick={() => onDeleteArchives( selectedArchives )}>{__(
                    'Delete', 'burst-statistics' )}</button>
              </div>
            </div>
        }
        {
            0 < progress && 100 > progress &&
            <div className="burst-selected-archive">
              {__( 'Restore in progress, %s complete', 'burst-statistics' ).
                  replace( '%s', progress + '%' )}
            </div>
        }

        {DataTable && <>
          <DataTable
              columns={columns}
              data={data}
              dense
              paginationPerPage={paginationPerPage}
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
              noDataComponent={<div className="burst-no-archives">{__(
                  'No archives', 'burst-statistics' )}</div>}
              sortFunction={handleSort}
          /></>
        }
      </>
  );
};
export default RestoreArchivesControl;
