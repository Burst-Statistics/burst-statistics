import { getData } from '@/utils/api';
import {
  formatPercentage,
  formatTime,
  getCountryName
} from '@/utils/formatting';
import Flag from '@/components/Statistics/Flag';
import ClickToFilter from '@/components/Common/ClickToFilter';
import { memo, useMemo } from 'react';
import { safeDecodeURI } from '@/utils/lib';
import { __ } from '@wordpress/i18n';

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

// Memoize API call result for the same parameters
const resultCache = new Map();
const getCacheKey = ( startDate, endDate, range, args ) =>
  `${startDate}:${endDate}:${range}:${JSON.stringify( args )}`;

const getDataTableData = async({
  startDate,
  endDate,
  range,
  args,
  columnsOptions
}) => {
  try {
    const cacheKey = getCacheKey( startDate, endDate, range, args );

    // Check if we have a cached result for these parameters
    if ( resultCache.has( cacheKey ) ) {
      return resultCache.get( cacheKey );
    }

    const { data } = await getData(
      'datatable',
      startDate,
      endDate,
      range,
      args
    );

    const result = transformDataTableData( data, columnsOptions );

    // Cache the result
    resultCache.set( cacheKey, result );

    // Clear old cache entries if cache gets too large (limit to 20 entries)
    if ( 20 < resultCache.size ) {
      const oldestKey = resultCache.keys().next().value;
      resultCache.delete( oldestKey );
    }

    return result;
  } catch ( error ) {
    console.error( 'Error fetching data table data:', error );
    return { columns: [], data: [] }; // Return an empty result on error
  }
};

export default getDataTableData;
