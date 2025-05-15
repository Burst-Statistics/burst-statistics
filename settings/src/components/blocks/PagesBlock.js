import {__} from '@wordpress/i18n';
import DataTable from 'react-data-table-component';
import EmptyDataTable from './EmptyDataTable';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useDate} from '../../store/useDateStore';
import ClickToFilter from './ClickToFilter';
import GridItem from '../common/GridItem';
import {useQuery} from '@tanstack/react-query';
import getPagesData from '../../api/getPagesData';
import {useState} from '@wordpress/element';
import PopoverFilter from './PopoverFilter';
import {getLocalStorage, setLocalStorage} from '../../utils/api';
import {safeDecodeURI} from '../../utils/lib';

const PagesBlock = () => {
  const {startDate, endDate, range} = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const [ filterText, setFilterText ] = useState( '' );
  const defaultColumns = [ 'page_url', 'pageviews' ];
  const [ columns, setColumnsState ] = useState( getLocalStorage( 'pages_columns', defaultColumns ) );
  const setColumns = ( value ) => {
    setColumnsState( value );
    setLocalStorage( 'pages_columns', value );
  };
  const columnsOptions = {
    'pageviews': {
      'label': __( 'Pageviews', 'burst-statistics' ),
      'default': true
    },
    'sessions': {
      'label': __( 'Sessions', 'burst-statistics' ),
      'pro': true
    },
    'visitors': {
      'label': __( 'Visitors', 'burst-statistics' ),
      'pro': true
    },
    'bounce_rate': {
      'label': __( 'Bounce rate', 'burst-statistics' ),
      'format': 'percentage',
      'pro': true,
      'sortFunction': percentageSort
    },
    'avg_time_on_page': {
      'label': __( 'Time on page', 'burst-statistics' ),
      'pro': true,
      'format': 'time'
    }
  };

  const args = {'filters': filters, 'metrics': columns};
  const query = useQuery({
    queryKey: [ 'pages', startDate, endDate, args ],
    queryFn: () => getPagesData({startDate, endDate, range, args, columnsOptions})
  });

  const data = query.data || {};

  const loading = query.isLoading || query.isFetching;

  const loadingClass = loading ? 'burst-loading' : '';

  // if data is an empty array, show the empty data table
  if ( query.isFetched && 0 !== data.length && data.columns ) {
    const renderPageUrlCell = ( row ) => (
        <ClickToFilter filter="page_url" filterValue={row.page_url}>
          {safeDecodeURI( row.page_url )}
        </ClickToFilter>
    );

    data.columns[0].cell = renderPageUrlCell;
  }

  let tableData = data.data;
  let columnsData = data.columns;
  let filteredData = [];
  if ( Array.isArray( tableData ) ) {
    filteredData = tableData.filter(
        item => item.page_url.toLowerCase().includes( filterText.toLowerCase() ) );
  }

  return (
      <GridItem
          className={'burst-column-2 border-to-border datatable'}
          title={__( 'Per page', 'burst-statistics' )}
          controls={
            <>
              <input className="burst-datatable-search" type="text"
                     placeholder={__( 'Search', 'burst-statistics' )}
                     value={filterText}
                     onChange={e => setFilterText( e.target.value )}
              />
              <PopoverFilter
                  selectedOptions={columns}
                  options={columnsOptions}
                  onApply={setColumns}
              />
            </>
          }
      >
        <div className={`burst-loading-container ${loadingClass}`}>
          <DataTable
              columns={columnsData}
              data={filteredData}
              defaultSortFieldId={2}
              defaultSortAsc={false}
              pagination
              paginationRowsPerPageOptions={[ 10, 25, 50, 100, 200 ]}
              paginationPerPage={10}
              paginationComponentOptions={{
                rowsPerPageText: '',
                rangeSeparatorText: __( 'of', 'burst-statistics' ),
                noRowsPerPage: false,
                selectAllRowsItem: true,
                selectAllRowsItemText: __( 'All', 'burst-statistics' )
              }}
              noDataComponent={<EmptyDataTable/>}
          />
        </div>
      </GridItem>
  );
};

export default PagesBlock;
