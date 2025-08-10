import { __ } from '@wordpress/i18n';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import PopoverFilter from '../Common/PopoverFilter';
import SearchButton from '../Common/SearchButton';
import DataTableSelect from './DataTableSelect';
import { useDataTableStore } from '@/store/useDataTableStore';
import EmptyDataTable from './EmptyDataTable';
import DataTable from 'react-data-table-component';
import { useDate } from '@/store/useDateStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useQuery } from '@tanstack/react-query';
import getDataTableData from '@/api/getDataTableData';
import { burst_get_website_url } from '../../utils/lib';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';

const defaultColumnsOptions = {
  pageviews: {
    label: __( 'Pageviews', 'burst-statistics' ),
    default: true,
    align: 'right'
  },
  sessions: {
    label: __( 'Sessions', 'burst-statistics' ),
    pro: true,
    align: 'right'
  },
  visitors: {
    label: __( 'Visitors', 'burst-statistics' ),
    pro: true,
    align: 'right'
  },
  conversions: {
    label: __( 'Conversions', 'burst-statistics' ),
    pro: true,
    align: 'right'
  },
  conversion_rate: {
    label: __( 'Conversion Rate', 'burst-statistics' ),
    format: 'percentage',
    pro: true,
    align: 'right'
  },
  bounce_rate: {
    label: __( 'Bounce rate', 'burst-statistics' ),
    format: 'percentage',
    pro: true,
    align: 'right'
  },
  avg_time_on_page: {
    label: __( 'Time on page', 'burst-statistics' ),
    pro: true,
    format: 'time',
    align: 'right'
  }
};

const config = {
  pages: {
    label: __( 'Pages', 'burst-statistics' ),
    searchable: true,
    defaultColumns: [ 'page_url', 'pageviews' ],
    columnsOptions: {
      page_url: {
        label: __( 'Page URL', 'burst-statistics' ),
        default: true,
        format: 'url',
        align: 'left',
        group_by: true
      },
      ...defaultColumnsOptions
    },
  },
  referrers: {
    label: __( 'Referrers', 'burst-statistics' ),
    searchable: true,
    defaultColumns: [ 'referrer', 'pageviews' ],
    columnsOptions: {
      referrer: {
        label: __( 'Referrer', 'burst-statistics' ),
        default: true,
        format: 'referrer',
        align: 'left',
        group_by: true
      },
      ...defaultColumnsOptions
    },
  },
  countries: {
    label: __( 'Locations', 'burst-statistics' ),
    pro: true,
    searchable: true,
    defaultColumns: [ 'country_code', 'state', 'city', 'pageviews' ],
    columnsOptions: {
      country_code: {
        label: __( 'Country', 'burst-statistics' ),
        default: true,
        format: 'country',
        align: 'left',
        group_by: true
      },
      state: {
        label: __( 'State', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      city: {
        label: __( 'City', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      continent: {
        label: __( 'Continent', 'burst-statistics' ),
        format: 'continent',
        align: 'left',
        group_by: true
      },

      ...defaultColumnsOptions
    }
  },
  campaigns: {
    label: __( 'Campaigns', 'burst-statistics' ),
    pro: true,
    searchable: true,
    defaultColumns: [ 'source', 'pageviews' ],
    columnsOptions: {
      campaign: {
        label: __( 'Campaign', 'burst-statistics' ),
        default: true,
        format: 'text',
        align: 'left',
        group_by: true
      },
      source: {
        label: __( 'Source', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      medium: {
        label: __( 'Medium', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      term: {
        label: __( 'Term', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      content: {
        label: __( 'Content', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      ...defaultColumnsOptions
    }
  },
  parameters: {
    label: __( 'Parameters', 'burst-statistics' ),
    searchable: true,
    pro: true,
    defaultColumns: [ 'parameter', 'pageviews' ],
    columnsOptions: {
      parameter: {
        label: __( 'Parameter', 'burst-statistics' ),
        default: true,
        format: 'text',
        align: 'left',
        group_by: true
      },
      parameters: {
        label: __( 'Parameters', 'burst-statistics' ),
        format: 'text',
        align: 'left',
        group_by: true
      },
      ...defaultColumnsOptions
    }
  },
  ghost: {
    label: __( 'Dummy', 'burst-statistics' ),
    searchable: true,
    defaultColumns: [ 'pageviews' ],
    columnsOptions: {
      ...defaultColumnsOptions
    }
  }
};

/**
 * DataTableBlock component for displaying a block with a datatable. This
 * component is used in the StatisticsPage.
 * @param allowedConfigs
 * @param id
 * @return {JSX.Element}
 * @constructor
 */
const DataTableBlock = ({ allowedConfigs = [ 'pages', 'referrers' ], id }) => {
  const { startDate, endDate, range } = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const defaultConfig = allowedConfigs[0];

  // Use the DataTable store
  const {
    getSelectedConfig,
    setSelectedConfig: setSelectedConfigStore,
    getColumns: getColumnsStore,
    setColumns: setColumnsStore
  } = useDataTableStore();

  const [ selectedConfig, setSelectedConfigState ] = useState( () =>
    getSelectedConfig( id, defaultConfig )
  );

  const configDetails = useMemo( () => config[selectedConfig], [ selectedConfig ]);
  const columnsOptions = useMemo(
    () => configDetails?.columnsOptions || {},
    [ configDetails ]
  );
  const defaultColumns = useMemo(
    () => configDetails?.defaultColumns || [],
    [ configDetails ]
  );

  const [ columns, setColumnsState ] = useState( () => {
    const initialColumns = getColumnsStore( selectedConfig, defaultColumns );
    const availableColumns = Object.keys( columnsOptions );
    return initialColumns.filter( ( column ) => availableColumns.includes( column ) );
  });

  const setColumns = useCallback(
    ( value ) => {
      const orderedColumns = value.filter( ( key ) =>
        Object.keys( columnsOptions ).includes( key )
      );
      if ( JSON.stringify( orderedColumns ) !== JSON.stringify( columns ) ) {
        setColumnsState( orderedColumns );
        setColumnsStore( selectedConfig, orderedColumns );
      }
    },
    [ selectedConfig, columns, columnsOptions, setColumnsStore ]
  );

  const setSelectedConfig = useCallback(
    async( value ) => {
      setSelectedConfigState( value );
      setSelectedConfigStore( id, value );
    },
    [ id, setSelectedConfigStore ]
  );

  useEffect( () => {
    const newColumns = getColumnsStore(
      selectedConfig,
      config[selectedConfig]?.defaultColumns || []
    );
    setColumns( newColumns );
  }, [ selectedConfig, setColumns, getColumnsStore ]);

  // search
  const [ filterText, setFilterText ] = useState( '' );

  // only add select options that are allowed, only allow key and label
  const selectOptions = useMemo( () => {
    return Object.keys( config )
      .filter( ( key ) => allowedConfigs.includes( key ) )
      .map( ( key ) => ({
        key,
        label: config[key].label,
        pro: !! config[key].pro,
        upsellPopover: config[key].upsellPopover || null
      }) );
  }, [ allowedConfigs ]);

  // query
  const args = useMemo( () => {
    const queryArgs = {
      filters: filters,
      metrics: Object.keys( columnsOptions ).filter( ( column ) =>
        columns.includes( column )
      ),
      group_by: []
    };

    // add group by based on the columnOptions
    columns.forEach( ( column ) => {
      if ( columnsOptions[column]?.group_by ) {
        queryArgs.group_by.push( column );
      }
    });

    return queryArgs;
  }, [ filters, columnsOptions, columns ]);

  const query = useQuery({
    queryKey: [ selectedConfig, startDate, endDate, args ],
    queryFn: () =>
      getDataTableData({
        type: 'datatable',
        startDate,
        endDate,
        range,
        args,
        columnsOptions
      }),
    enabled: !! selectedConfig // The query will run only if selectedConfig is truthy
  });

  const data = query.data || {};
  const tableData = data.data;
  const columnsData = data.columns;

  // Memoize the filtered data to avoid recalculations
  const filteredData = useMemo( () => {
    let filtered = [];
    if ( configDetails?.searchable && Array.isArray( tableData ) ) {
      if ( '' === filterText.trim() ) {
        filtered = tableData;
      } else {
        const searchTerm = filterText.toLowerCase();

        // Get searchable columns (those with group_by: true)
        const searchableColumns = Object.keys( columnsOptions ).filter(
          ( column ) => columnsOptions[column]?.group_by
        );

        filtered = tableData.filter( ( item ) => {

          // Search through all searchable columns
          return searchableColumns.some( ( column ) => {
            const value = item[column];
            if ( null === value || value === undefined ) {
              return false;
            }
            return value.toString().toLowerCase().includes( searchTerm );
          });
        });
      }
    } else {
      filtered = tableData;
    }

    return Array.isArray( filtered ) ? filtered : [];
  }, [ tableData, filterText, configDetails?.searchable, columnsOptions ]);

  const isLoading = query.isLoading || query.isFetching;
  const error = query.error;
  const noData = 0 === filteredData.length;

  // Add a useMemo to sort columnsData based on columnsOptions order
  const sortedColumnsData = useMemo( () => {

    // Check if columnsData and columnsOptions are valid
    if ( ! columnsData || ! columnsOptions ) {
      return [];
    }

    // Create an array from columnsOptions keys to define the order
    const order = Object.keys( columnsOptions );

    // Sort columnsData based on the order of columns in columnsOptions
    return columnsData.sort( ( a, b ) => {
      const orderA = order.indexOf( a.selector );
      const orderB = order.indexOf( b.selector );

      return orderA - orderB;
    });
  }, [ columnsData, columnsOptions ]);

  // Early return if config details are not available
  if ( ! configDetails ) {
    return null;
  }

  // Memoize DataTable props to prevent unnecessary re-renders
  const dataTableProps = useMemo(
    () => ({
      columns: sortedColumnsData,
      data: filteredData,
      defaultSortFieldId: 2,
      defaultSortAsc: false,
      pagination: true,
      paginationRowsPerPageOptions: [ 10, 25, 50, 100, 200 ],
      paginationPerPage: 10,
      paginationComponentOptions: {
        rowsPerPageText: '',
        rangeSeparatorText: __( 'of', 'burst-statistics' ),
        noRowsPerPage: false,
        selectAllRowsItem: true,
        selectAllRowsItemText: __( 'All', 'burst-statistics' )
      },
      noDataComponent: (
        <EmptyDataTable
          noData={noData}
          data={[]}
          isLoading={isLoading}
          error={error}
        />
      ),

      // Additional optimization
      progressPending: isLoading,
      progressComponent: (
        <EmptyDataTable
          noData={noData}
          data={[]}
          isLoading={isLoading}
          error={error}
        />
      )
    }),
    [ sortedColumnsData, filteredData, noData, isLoading, error ]
  );

  return (
    <Block className="row-span-2 overflow-hidden xl:col-span-6">
      <BlockHeading
        title={
          <DataTableSelect
            value={selectedConfig}
            onChange={setSelectedConfig}
            options={selectOptions}
            disabled={[]}
          />
        }
        controls={
          <>
            {configDetails?.searchable && (
              <SearchButton
                value={filterText}
                onChange={setFilterText}
                className="ml-auto"
              />
            )}
            <PopoverFilter
              selectedOptions={columns}
              options={columnsOptions}
              onApply={setColumns}
            />
          </>
        }
      />
      <BlockContent className={'px-0 py-0'}>
        <DataTable {...dataTableProps} />
      </BlockContent>
    </Block>
  );
};

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo( DataTableBlock );
