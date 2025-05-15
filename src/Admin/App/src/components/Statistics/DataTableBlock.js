import { __ } from '@wordpress/i18n';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import PopoverFilter from '../Common/PopoverFilter';
import { getLocalStorage, setLocalStorage } from '@/utils/api';
import DataTableSelect from './DataTableSelect';
import EmptyDataTable from './EmptyDataTable';
import DataTable from 'react-data-table-component';
import { useDate } from '@/store/useDateStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useQuery } from '@tanstack/react-query';
import getDataTableData from '@/api/getDataTableData';
import { burst_get_website_url } from '../../utils/lib';
import Block from '@/components/Blocks/Block';
import BlockHeading from '@/components/Blocks/BlockHeading';
import BlockContent from '@/components/Blocks/BlockContent';

const defaultColumnsOptions = {
  pageviews: {
    label: __( 'Pageviews', 'burst-statistics' ),
    default: true
  },
  sessions: {
    label: __( 'Sessions', 'burst-statistics' ),
    pro: true
  },
  visitors: {
    label: __( 'Visitors', 'burst-statistics' ),
    pro: true
  },
  conversions: {
    label: __( 'Conversions', 'burst-statistics' ),
    pro: true
  },
  bounce_rate: {
    label: __( 'Bounce rate', 'burst-statistics' ),
    format: 'percentage',
    pro: true
  },
  avg_time_on_page: {
    label: __( 'Time on page', 'burst-statistics' ),
    pro: true,
    format: 'time'
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
    upsellPopover: {
      title: __( 'Unlock Campaign Insights with Pro', 'burst-statistics' ),
      subtitle: __(
        'Get in-depth analysis of your marketing efforts.',
        'burst-statistics'
      ),
      bulletPoints: [
        {
          text: (
            <>
              <b>{__( 'Track URL parameters:', 'burst-statistics' )}</b>{' '}
              {__( 'Understand visitors patterns.', 'burst-statistics' )}
            </>
          ),
          icon: 'world'
        },
        {
          text: (
            <>
              <b>{__( 'UTM Analytics:', 'burst-statistics' )}</b>{' '}
              {__(
                'Measure the success of your UTM campaigns.',
                'burst-statistics'
              )}
            </>
          ),
          icon: 'goals'
        },
        {
          text: (
            <>
              <b>{__( 'Filter data:', 'burst-statistics' )}</b>{' '}
              {__( 'By device, page, goal, or country.', 'burst-statistics' )}
            </>
          ),
          icon: 'filter'
        }
      ],
      primaryButtonUrl: burst_get_website_url( '/pricing/', {
        burst_source: 'params-campaigns-upsell',
        burst_content: 'upgrade'
      }),
      secondaryButtonUrl: burst_get_website_url( '/', {
        burst_source: 'params-campaigns-upsell',
        burst_content: 'more-info'
      })
    }
  },
  referrers: {
    label: __( 'Referrers', 'burst-statistics' ),
    searchable: true,
    defaultColumns: [ 'referrer', 'pageviews' ],
    columnsOptions: {
      referrer: {
        label: __( 'Referrer', 'burst-statistics' ),
        default: true,
        format: 'url',
        align: 'left',
        group_by: true
      },
      ...defaultColumnsOptions
    },
    upsellPopover: {
      title: __( 'Unlock Country Insights with Pro', 'burst-statistics' ),
      subtitle: __(
        'Get detailed information on your users',
        'burst-statistics'
      ),
      bulletPoints: [
        {
          text: (
            <>
              <b>{__( 'See Countries:', 'burst-statistics' )}</b>{' '}
              {__( 'Know where your visitors are from.', 'burst-statistics' )}
            </>
          ),
          icon: 'world'
        },
        {
          text: (
            <>
              <b>{__( 'Track More Goals:', 'burst-statistics' )}</b>{' '}
              {__(
                'Follow different things at the same time.',
                'burst-statistics'
              )}
            </>
          ),
          icon: 'goals'
        },
        {
          text: (
            <>
              <b>{__( 'Filter by Country:', 'burst-statistics' )}</b>{' '}
              {__( 'Only see data from specific places.', 'burst-statistics' )}
            </>
          ),
          icon: 'filter'
        }
      ],
      primaryButtonUrl: burst_get_website_url( '/pricing/', {
        burst_source: 'countries-upsell',
        burst_content: 'upgrade'
      }),
      secondaryButtonUrl: burst_get_website_url( '/', {
        burst_source: 'countries-upsell',
        burst_content: 'more-info'
      })
    }
  },
  countries: {
    label: __( 'Countries', 'burst-statistics' ),
    pro: true,
    searchable: false,
    defaultColumns: [ 'country_code', 'pageviews' ],
    columnsOptions: {
      country_code: {
        label: __( 'Country', 'burst-statistics' ),
        default: true,
        format: 'country',
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
  const [ selectedConfig, setSelectedConfigState ] = useState( () =>
    getLocalStorage( 'datatable_config_' + id, defaultConfig )
  );

  const configDetails = useMemo( () => config[selectedConfig], [ selectedConfig ]);
  const columnsOptions = useMemo( () => configDetails?.columnsOptions || {}, [ configDetails ]);
  const defaultColumns = useMemo( () => configDetails?.defaultColumns || [], [ configDetails ]);

  const [ columns, setColumnsState ] = useState( () => {
    const initialColumns = getLocalStorage( `datatable_columns_${selectedConfig}`, defaultColumns );
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
      setLocalStorage( `datatable_columns_${selectedConfig}`, orderedColumns );
    }
  },
  [ selectedConfig, columns, columnsOptions ]
);

  const setSelectedConfig = useCallback(
    async( value ) => {
      setSelectedConfigState( value );
      setLocalStorage( 'datatable_config_' + id, value );
    },
    [ id ]
  );

  useEffect( () => {
    const newColumns = getLocalStorage(
      'datatable_columns_' + selectedConfig,
      config[selectedConfig]?.defaultColumns || []
    );
    setColumns( newColumns );
  }, [ selectedConfig, setColumns ]);

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
        filtered = tableData.filter( ( item ) => {

          // Get the first key and its corresponding value in the object
          const firstKey = Object.keys( item )[0];
          const firstValue =
            null === item[firstKey] ? '' : item[firstKey].toString().toLowerCase();

          // Check if the first value includes the filter text
          return firstValue.includes( filterText.toLowerCase() );
        });
      }
    } else {
      filtered = tableData;
    }

    return Array.isArray( filtered ) ? filtered : [];
  }, [ tableData, filterText, configDetails?.searchable ]);

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
  const dataTableProps = useMemo( () => ({
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
    progressComponent: <EmptyDataTable
    noData={noData}
    data={[]}
    isLoading={isLoading}
    error={error}
  />
  }), [ sortedColumnsData, filteredData, noData, isLoading, error ]);

  return (
    <Block className="row-span-2 xl:col-span-6">
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
            {configDetails.searchable && (
              <input
                className="burst-datatable-search ml-auto"
                type="text"
                placeholder={__( 'Search', 'burst-statistics' )}
                value={filterText}
                onChange={( e ) => setFilterText( e.target.value )}
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
