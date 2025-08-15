import { getData } from '@/utils/api';
import {
  formatPercentage,
  formatTime,
  getCountryName,
  getContinentName
} from '@/utils/formatting';
import Flag from '@/components/Statistics/Flag';
import ClickToFilter from '@/components/Common/ClickToFilter';
import { memo } from 'react';
import { safeDecodeURI } from '@/utils/lib';
import { __ } from '@wordpress/i18n';
import Icon from "@/utils/Icon";
import Tooltip from "@/components/Common/Tooltip";

// Column format constants
const FORMATS = {
  PERCENTAGE: 'percentage',
  TIME: 'time',
  COUNTRY: 'country',
  CONTINENT: 'continent',
  URL: 'url',
  TEXT: 'text',
  INTEGER: 'integer',
  REFERRER: 'referrer'
};

// Create memoized version of ClickToFilter to prevent unnecessary re-renders
const MemoizedClickToFilter = memo( ClickToFilter );

// Memoized filter components to prevent unnecessary recreations
const CountryFilter = memo( ({ value }) => (
  <MemoizedClickToFilter filter="country_code" filterValue={value}>
    <Flag country={value} countryNiceName={getCountryName( value )} />
  </MemoizedClickToFilter>
) );

const UrlFilter = memo( ({ value }) => (
  <MemoizedClickToFilter filter="page_url" filterValue={value}>
    {safeDecodeURI( value )}
  </MemoizedClickToFilter>
) );

const ReferrerFilter = memo( ({ value }) => (
    <MemoizedClickToFilter filter="referrer" filterValue={value}>
      {safeDecodeURI( value )}
    </MemoizedClickToFilter>
) );

// Cache for format cell functions to avoid recreating them for every cell
const formatFunctionCache = new Map();

// Optimized version of transformDataTableData
const transformDataTableData = ( response, columnOptions ) => {
  if ( ! response || ! response.columns ) {
    return { columns: [], data: [] };
  }

  // Create a new object instead of mutating the response
  const result = {
    ...response,
    columns: [],
    data: Array.isArray( response.data ) ? [ ...response.data ] : []
  };

  // Pre-calculate column formats once
  const columnFormats = {};
  response.columns.forEach( column => {
    columnFormats[column.id] = columnOptions[column.id]?.format || 'integer';
  });

  // Update columns
  result.columns = response.columns.map( ( column ) => {

    // Check if column exists in columnOptions
    if ( ! columnOptions[column.id]) {
      return column;
    }

    //@todo fix "right" as boolean value warning
    let rightValue = 'left' !== columnOptions[column.id]?.align;
    const format = columnFormats[column.id];

    const updatedColumn = {
      ...column,
      selector: ( row ) => row[column.id],
      right: rightValue
    };

    // add sort function if percentage or time or integer
    if ( 'percentage' === format || 'time' === format || 'integer' === format ) {
      updatedColumn.sortFunction = ( rowA, rowB ) => {

        // Handle null/undefined values by placing them at the end when sorting
        if ( null === rowA[column.id] || rowA[column.id] === undefined ) {
          return 1;
        }
        if ( null === rowB[column.id] || rowB[column.id] === undefined ) {
          return -1;
        }

        // Parse values to numbers for comparison
        const numA = parseFloat( rowA[column.id]);
        const numB = parseFloat( rowB[column.id]);

        // Handle NaN values
        if ( isNaN( numA ) ) {
return 1;
}
        if ( isNaN( numB ) ) {
return -1;
}

        return numA - numB;
      };
    } else if ( 'url' === format || 'text' === format ) {

      // Add string-based sorting for text and URL columns
      updatedColumn.sortFunction = ( rowA, rowB ) => {

        // Handle null/undefined values
        if ( ! rowA[column.id]) {
return 1;
}
        if ( ! rowB[column.id]) {
return -1;
}

        // Convert to strings and compare
        const strA = String( rowA[column.id]).toLowerCase();
        const strB = String( rowB[column.id]).toLowerCase();

        return strA.localeCompare( strB );
      };
    }

    // Use cached format cell function if it exists, or create a new one
    const cacheKey = `${column.id}:${format}`;
    if ( ! formatFunctionCache.has( cacheKey ) ) {

      // Define a cell rendering function based on the format
      formatFunctionCache.set( cacheKey, ( row ) => {
        const value = row[column.id];

        switch ( format ) {
          case 'percentage':
            return formatPercentage( value );
          case 'time':
            return formatTime( value );
          case 'country':
               // Return null for undefined or null values to prevent rendering errors
            if ( value === undefined || null === value ) {
              return __( 'Not set', 'burst-statistics' );
            }
            return <CountryFilter value={value} />;
          case 'url':
            return <UrlFilter value={value} />;
          case 'referrer':
            return <ReferrerFilter value={value} />;
          case 'text':
            return value;
          case 'integer':
            return parseInt( value, 10 );
          default:
            return value;
        }
      });
    }

    updatedColumn.cell = formatFunctionCache.get( cacheKey );
    return updatedColumn;
  });

  return result;
};

// Memoized filter components - created once, reused everywhere
const MemoizedClickToFilter = memo(ClickToFilter);

const CountryFilter = memo(({ value }) => (
  <MemoizedClickToFilter filter="country_code" filterValue={value}>
    <Flag country={value} countryNiceName={getCountryName(value)} />
  </MemoizedClickToFilter>
));

const ContinentFilter = memo(({ value }) => (
  <MemoizedClickToFilter filter="continent_code" filterValue={value}>
    <>{getContinentName(value)}</>
  </MemoizedClickToFilter>
));

const UrlFilter = memo(({ filter, value }) => (
  <MemoizedClickToFilter filter={filter} filterValue={value}>
    {safeDecodeURI(value)}
  </MemoizedClickToFilter>
));

const TextFilter = memo(({ filter, value }) => (
  <MemoizedClickToFilter filter={filter} filterValue={value}>
    {value}
  </MemoizedClickToFilter>
));

/**
 * Registry of column formatters - easily extensible
 * @type {Object<string, function>}
 */
const COLUMN_FORMATTERS = {
  [FORMATS.PERCENTAGE]: (value) => formatPercentage(value),
  [FORMATS.TIME]: (value) => formatTime(value),
  [FORMATS.INTEGER]: (value) => parseInt(value, 10),
  [FORMATS.COUNTRY]: (value) => {
    if (!value || value === '') {
      return __('Not set', 'burst-statistics');
    }
    return <CountryFilter value={value} />;
  },
  [FORMATS.CONTINENT]: (value) => <ContinentFilter value={value} />,
  [FORMATS.URL]: (value, columnId) => <UrlFilter filter={columnId} value={value} />,
  [FORMATS.TEXT]: (value, columnId) => <TextFilter filter={columnId} value={value} />,
  [FORMATS.REFERRER]: (value, columnId) => <ReferrerFilter value={value} />,
};

/**
 * Unified sorting function that handles all data types
 * @param {string} columnId - The column identifier
 * @param {string} format - The column format type
 * @returns {function} Sort comparison function
 */
const createSortFunction = (columnId, format) => {
  const isNumeric = [FORMATS.PERCENTAGE, FORMATS.TIME, FORMATS.INTEGER].includes(format);
  
  return (rowA, rowB) => {
    const valueA = rowA[columnId];
    const valueB = rowB[columnId];

    // Handle null/undefined values consistently
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;

    if (isNumeric) {
      const numA = parseFloat(valueA);
      const numB = parseFloat(valueB);
      
      if (isNaN(numA) && isNaN(numB)) return 0;
      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;
      
      return numA - numB;
    } else {
      // String comparison for text-based columns
      return String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
    }
  };
};
const addABTestIcon = (content, row) => {
  if (!row.is_ab_test) return content;

  let name;
  let color;
  let tooltip;
  if ( row.significant === 'no_winner' ) {
    tooltip = __('The test resulted in a tie. More hits might still result in a winner, but the difference will probably be very small.', 'burst-statistics');
    color = 'gold';
    name = 'scale';
  } else if ( row.significant === 'still_running' ) {
    tooltip = __('Not enough data yet to declare a winner or tie.', 'burst-statistics');
    color = 'grey';
    name = 'hourglass';
  } else {
    tooltip = row.winner ? __('Winner of the A/B test with a probability of >95%.', 'burst-statistics')
    : __('Least performant version of the A/B test with a probability of >95%.', 'burst-statistics');
    color = row.winner ? "gold": "black";
    name = row.winner ? "trophy" : "frown";
  }

  return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Icon name={name} color={color} tooltip={tooltip} />
        {content}
    </span>
  );
};

/**
 * Creates a cell formatter function for a specific column
 * @param {string} format - The column format type
 * @param {string} columnId - The column identifier
 * @returns {function} Cell formatter function
 */
const createCellFormatter = (format, columnId) => {
  const formatter = COLUMN_FORMATTERS[format];
  
  if (!formatter) {
    console.warn(`Unknown column format: ${format}. Using default text formatter.`);
    return (row) => row[columnId] || '';
  }

  return (row) => {
    try {
      const value = row[columnId] ?? '';
      const formatted = formatter(value, columnId);
      //add a-b test icon when conversion_rate or conversions column are present, but not both.
      if (
          (columnId === 'conversion_rate') ||
          (columnId === 'conversions' && !('conversion_rate' in row))
      ) {
        return addABTestIcon(formatted, row);
      }
      return formatted;
    } catch (error) {
      console.error(`Error formatting cell value for column ${columnId}:`, error);
      return row[columnId] || '';
    }
  };
};

/**
 * Transforms a single column configuration
 * @param {Object} column - Column definition from API
 * @param {Object} columnOptions - Column configuration options
 * @returns {Object} Transformed column for data table
 */
const transformColumn = (column, columnOptions) => {
  const options = columnOptions[column.id];

  // Return original column if no options configured
  if (!options) {
    return column;
  }

  const format = options.format || FORMATS.INTEGER;
  const align = options.align || 'left';

  const transformedColumn = {
    ...column,
    selector: (row) => row[column.id],
    right: align !== 'left',
    sortFunction: createSortFunction(column.id, format),
    cell: createCellFormatter(format, column.id),
  };

  return transformedColumn;
};

/**
 * Validates API response structure
 * @param {*} response - API response to validate
 * @throws {Error} If response is invalid
 */
const validateResponse = (response) => {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response: expected object');
  }

  if (!Array.isArray(response.columns)) {
    throw new Error('Invalid response: columns must be an array');
  }

  if (!Array.isArray(response.data)) {
    throw new Error('Invalid response: data must be an array');
  }
};

/**
 * Transforms API response data for data table consumption
 * @param {Object} response - Raw API response
 * @param {Object} columnOptions - Column configuration options
 * @returns {Object} Transformed data with columns and data arrays
 */
const transformDataTableData = (response, columnOptions) => {
  try {
    validateResponse(response);

    return {
      columns: response.columns.map(column => transformColumn(column, columnOptions)),
      data: [...response.data],
    };
  } catch (error) {
    console.error('Data transformation error:', error);
    return { 
      columns: [], 
      data: [],
      error: error.message,
    };
  }
};

/**
 * Validates input parameters for data fetching
 * @param {Object} params - Input parameters
 * @throws {Error} If required parameters are missing
 */
const validateParams = ({ startDate, endDate, range, columnsOptions }) => {
  if (!startDate || !endDate || !range) {
    throw new Error('Missing required parameters: startDate, endDate, range');
  }

  if (!columnsOptions || typeof columnsOptions !== 'object') {
    throw new Error('Missing or invalid columnsOptions parameter');
  }
};

/**
 * Fetches and transforms data table data
 * @param {Object} params - Request parameters
 * @param {string} params.startDate - Start date for data range
 * @param {string} params.endDate - End date for data range
 * @param {string} params.range - Date range identifier
 * @param {Object} params.args - Additional query arguments
 * @param {Object} params.columnsOptions - Column configuration options
 * @returns {Promise<Object>} Transformed data table data
 */
const getDataTableData = async (params) => {
  try {
    validateParams(params);

    const { startDate, endDate, range, args, columnsOptions } = params;

    // Fetch data from API
    const { data } = await getData('datatable', startDate, endDate, range, args);

    if (!data) {
      throw new Error('No data received from API');
    }

    // Transform data for table consumption
    return transformDataTableData(data, columnsOptions);

  } catch (error) {
    console.error('Error fetching data table data:', error);
    
    return {
      columns: [],
      data: [],
      error: error.message,
    };
  }
};

// Export utilities for testing and extension
export {
  FORMATS,
  COLUMN_FORMATTERS,
  createSortFunction,
  createCellFormatter,
  transformColumn,
  transformDataTableData,
  validateResponse,
  validateParams,
};

export default getDataTableData;
