import {__} from '@wordpress/i18n';
import DataTable from 'react-data-table-component';
import EmptyDataTable from './EmptyDataTable';
import ClickToFilter from './ClickToFilter';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useDate} from '../../store/useDateStore';
import GridItem from '../common/GridItem';
import {useQuery} from '@tanstack/react-query';
import getAcquisitionData from '../../api/getAcquisitionData';
import {useAcquisitionStore} from '../../store/useAcquisitionStore';
import Flag from './Flag';
import AcquisitionSwitch from './Fields/AcquisitionSwitch';
import {safeDecodeURI} from '../../utils/lib';

/**
 * Acquisition block, shows referrers, country or language  based on the filters
 * @param props
 * @return {JSX.Element}
 * @constructor
 */
const AcquisitionBlock = ( props ) => {
  const {startDate, endDate, range} = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const type = useAcquisitionStore( ( state ) => state.type );
  const setType = useAcquisitionStore( ( state ) => state.setType );
  const args = {'filters': filters, 'metrics': [ 'referrers', 'pageviews' ]};
  const availableTypes = {
    'referrers': __( 'Referrers', 'burst-statistics' ),
    'countries': __( 'Countries', 'burst-statistics' )
  };

  const disabledTypes = burst_settings.is_pro ? [] : [ 'countries' ];

  const query = useQuery({
    queryKey: [ type, startDate, endDate, args ],
    queryFn: () => getAcquisitionData({type, startDate, endDate, range, args})
  });

  const data = query.data || {};
  const loading = query.isLoading || query.isFetching;
  let loadingClass = loading ? 'burst-loading' : '';

  if ( query.isFetched && 0 !== data.length && data.columns ) {
    data.columns[1].selector = row =>  Number( row.count ); // select data for referrer column
    // make cell clickable
    if ( 'countries' === type ) {
      data.columns[0].cell = ( row ) => {
        return (
            <ClickToFilter filter="country_code" filterValue={row.country_code}>
              <Flag country={row.country_code} countryNiceName={row.value} />
            </ClickToFilter>
        );
      };
    } else {
      data.columns[0].cell = ( row ) => {
        return (
            <ClickToFilter filter="referrer" filterValue={row.value}>
              {safeDecodeURI( row.value )}
            </ClickToFilter>
        );
      };
    }
  }

  let tableData = data.data;
  let columns = data.columns;

  function onChangeType( value ) {
    setType( value );
  }

  return (
      <GridItem
          className={'burst-column-2 border-to-border datatable'}
          title={__( 'Acquisition', 'burst-statistics' )}
          controls={ <AcquisitionSwitch value={type} onChange={( value ) => onChangeType( value ) } options={availableTypes} disabled={disabledTypes} /> }
      >
        <div className={'burst-loading-container ' + loadingClass}>
          <DataTable
              columns={columns}
              data={tableData}
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
              noDataComponent={<EmptyDataTable></EmptyDataTable>}
          />
        </div>
      </GridItem>
  );

};

export default AcquisitionBlock;

