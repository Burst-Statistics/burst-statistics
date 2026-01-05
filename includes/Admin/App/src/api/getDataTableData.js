import { getData } from '@/utils/api';
import {
	formatPercentage,
	formatTime,
	getCountryName,
	getContinentName,
	formatCurrency, formatCurrencyCompact
} from '@/utils/formatting';
import Flag from '@/components/Statistics/Flag';
import ClickToFilter from '@/components/Common/ClickToFilter';
import { memo } from 'react';
import { safeDecodeURI } from '@/utils/lib';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';

// Column format constants
const FORMATS = {
	PERCENTAGE: 'percentage',
	TIME: 'time',
	COUNTRY: 'country',
	CONTINENT: 'continent',
	URL: 'url',
	TEXT: 'text',
	INTEGER: 'integer',
	REFERRER: 'referrer',
	FLOAT: 'float',
	CURRENCY: 'currency'
};

// Memoized filter components - created once, reused everywhere
const MemoizedClickToFilter = memo( ClickToFilter );

const CountryFilter = memo( ({ value }) => (
	<MemoizedClickToFilter filter="country_code" filterValue={value}>
    <Flag country={value} countryNiceName={getCountryName( value )} />
  </MemoizedClickToFilter>
) );

CountryFilter.displayName = 'CountryFilter';

const ContinentFilter = memo( ({ value }) => (
	<MemoizedClickToFilter filter="continent_code" filterValue={value}>
    <>{getContinentName( value )}</>
  </MemoizedClickToFilter>
) );

ContinentFilter.displayName = 'ContinentFilter';

const UrlFilter = memo( ({ value, row }) => (
	<MemoizedClickToFilter filter="page_url" filterValue={value} row={row}>
      {safeDecodeURI( value )}
    </MemoizedClickToFilter>
) );

UrlFilter.displayName = 'UrlFilter';

const TextFilter = memo( ({ filter, value }) => (
	<MemoizedClickToFilter filter={filter} filterValue={value}>
    {value}
  </MemoizedClickToFilter>
) );

TextFilter.displayName = 'TextFilter';

const ReferrerFilter = memo( ({ value }) => (
	<MemoizedClickToFilter filter="referrer" filterValue={value}>
      {safeDecodeURI( value )}
    </MemoizedClickToFilter>
) );

ReferrerFilter.displayName = 'ReferrerFilter';

const CurrencyValue = memo( ({ value }) => {
	const exactValue = value?.value || 0;

	if ( ! value || ! value?.currency || isNaN( exactValue ) ) {
		return '';
	}

	const compactValue = formatCurrencyCompact( value.currency, exactValue );
	let tooltipValue = false;

	if ( 1000 < exactValue ) {
		tooltipValue = formatCurrency( value.currency, exactValue );
	}

	if ( ! tooltipValue ) {
		return compactValue;
	}

	return (
		<HelpTooltip content={tooltipValue} delayDuration={1000}>
			{compactValue}
		</HelpTooltip>
	);
});

CurrencyValue.displayName = 'CurrencyValue';

/**
 * Registry of column formatters - easily extensible
 * @type {Object<string, function>}
 */
const COLUMN_FORMATTERS = {
	[FORMATS.PERCENTAGE]: ( value ) => formatPercentage( value ),
	[FORMATS.TIME]: ( value ) => formatTime( value ),
	[FORMATS.INTEGER]: ( value ) => parseInt( value, 10 ),
	[FORMATS.COUNTRY]: ( value ) => {
		if ( ! value || '' === value ) {
			return __( 'Not set', 'burst-statistics' );
		}
		return <CountryFilter value={value} />;
	},
	[FORMATS.CONTINENT]: ( value ) => <ContinentFilter value={value} />,
	[FORMATS.URL]: ( value, columnId, row ) => <UrlFilter filter={columnId} value={value} row={row} />,
	[FORMATS.TEXT]: ( value, columnId ) => <TextFilter filter={columnId} value={value} />,
	[FORMATS.REFERRER]: ( value ) => <ReferrerFilter value={value} />,
	[FORMATS.FLOAT]: ( value ) => parseFloat( value ),
	[FORMATS.CURRENCY]: ( value ) => <CurrencyValue value={value} />
};

/**
 * Unified sorting function that handles all data types
 * @param {string} columnId - The column identifier
 * @param {string} format - The column format type
 * @returns {function} Sort comparison function
 */
const createSortFunction = ( columnId, format ) => {
	const isNumeric = [
		FORMATS.PERCENTAGE,
		FORMATS.TIME,
		FORMATS.INTEGER,
		FORMATS.FLOAT
	].includes( format );

	const isCurrency = format === FORMATS.CURRENCY;

	return ( rowA, rowB ) => {
		const valueA = rowA[columnId];
		const valueB = rowB[columnId];

		// Handle null/undefined values consistently
		if ( null == valueA && null == valueB ) {
			return 0;
		}
		if ( null == valueA ) {
			return 1;
		}
		if ( null == valueB ) {
			return -1;
		}

		// --- CURRENCY SORTING ---
		if ( isCurrency ) {
			const amountA = 'object' === typeof valueA ? parseFloat( valueA.value ) : parseFloat( valueA );
			const amountB = 'object' === typeof valueB ? parseFloat( valueB.value ) : parseFloat( valueB );

			if ( isNaN( amountA ) && isNaN( amountB ) ) {
				return 0;
			}
			if ( isNaN( amountA ) ) {
				return 1;
			}
			if ( isNaN( amountB ) ) {
				return -1;
			}

			return amountA - amountB;
		}

		// --- NUMERIC SORTING ---
		if ( isNumeric ) {
			const numA = parseFloat( valueA );
			const numB = parseFloat( valueB );

			if ( isNaN( numA ) && isNaN( numB ) ) {
				return 0;
			}
			if ( isNaN( numA ) ) {
				return 1;
			}
			if ( isNaN( numB ) ) {
				return -1;
			}

			return numA - numB;
		}

		return String( valueA ).toLowerCase().localeCompare( String( valueB ).toLowerCase() );
	};
};

const addABTestIcon = ( content, row ) => {
	if ( ! row.is_ab_test ) {
		return content;
	}

	let name;
	let color;
	let tooltip;
	if ( 'no_winner' === row.significant ) {
		tooltip = __( 'The test resulted in a tie. More hits might still result in a winner, but the difference will probably be very small.', 'burst-statistics' );
		color = 'gold';
		name = 'scale';
	} else if ( 'still_running' === row.significant ) {
		tooltip = __( 'Not enough data yet to declare a winner or tie.', 'burst-statistics' );
		color = 'grey';
		name = 'hourglass';
	} else {
		tooltip = row.winner ? __( 'Winner of the A/B test with a probability of >95%.', 'burst-statistics' ) :
			__( 'Least performant version of the A/B test with a probability of >95%.', 'burst-statistics' );
		color = row.winner ? 'gold' : 'black';
		name = row.winner ? 'trophy' : 'frown';
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
const createCellFormatter = ( format, columnId ) => {
	const formatter = COLUMN_FORMATTERS[format];

	if ( ! formatter ) {
		console.warn( `Unknown column format: ${format}. Using default text formatter.` );
		return ( row ) => row[columnId] || '';
	}

	return ( row ) => {
		try {
			const value = row[columnId] ?? '';
			const formatted = formatter( value, columnId, row );

			// Add a-b test icon when conversion_rate or conversions column are present, but not both.
			if (
				( 'conversion_rate' === columnId ) ||
				( 'conversions' === columnId && ! ( 'conversion_rate' in row ) )
			) {
				return addABTestIcon( formatted, row );
			}

			return formatted;
		} catch ( error ) {
			console.error( `Error formatting cell value for column ${columnId}:`, error );
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
const transformColumn = ( column, columnOptions ) => {
	const options = columnOptions[column.id];

	// Return original column if no options configured
	if ( ! options ) {
		return column;
	}

	const format = options.format || FORMATS.INTEGER;
	const align = options.align || 'left';

	const transformedColumn = {
		...column,
		selector: ( row ) => row[column.id],
		right: 'left' !== align,
		sortFunction: createSortFunction( column.id, format ),
		cell: createCellFormatter( format, column.id )
	};

	return transformedColumn;
};

/**
 * Validates API response structure
 * @param {*} response - API response to validate
 * @throws {Error} If response is invalid
 */
const validateResponse = ( response ) => {
	if ( ! response || 'object' !== typeof response ) {
		throw new Error( 'Invalid response: expected object' );
	}

	if ( ! Array.isArray( response.columns ) ) {
		throw new Error( 'Invalid response: columns must be an array' );
	}

	if ( ! Array.isArray( response.data ) ) {
		throw new Error( 'Invalid response: data must be an array' );
	}
};

/**
 * Transforms API response data for data table consumption
 * @param {Object} response - Raw API response
 * @param {Object} columnOptions - Column configuration options
 * @returns {Object} Transformed data with columns and data arrays
 */
const transformDataTableData = ( response, columnOptions ) => {
	try {
		validateResponse( response );

		return {
			columns: response.columns.map( column => transformColumn( column, columnOptions ) ),
			data: [ ...response.data ]
		};
	} catch ( error ) {
		console.error( 'Data transformation error:', error );
		return {
			columns: [],
			data: [],
			error: error.message
		};
	}
};

/**
 * Validates input parameters for data fetching
 * @param {Object} params - Input parameters
 * @throws {Error} If required parameters are missing
 */
const validateParams = ({ startDate, endDate, range, columnsOptions }) => {
	if ( ! startDate || ! endDate || ! range ) {
		throw new Error( 'Missing required parameters: startDate, endDate, range' );
	}

	if ( ! columnsOptions || 'object' !== typeof columnsOptions ) {
		throw new Error( 'Missing or invalid columnsOptions parameter' );
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
 *
 * @returns {Promise<Object>} Transformed data table data
 */
const getDataTableData = async( params ) => {
	try {
		validateParams( params );

		const { startDate, endDate, range, args, columnsOptions, type } = params;

		const endpoint = 'ecommerce-datatable' === type ? 'ecommerce/datatable' : 'datatable';

		const { data } = await getData( endpoint, startDate, endDate, range, args );

		if ( ! data ) {
			throw new Error( 'No data received from API' );
		}

		// Transform data for table consumption.
		return transformDataTableData( data, columnsOptions );

	} catch ( error ) {
		console.error( 'Error fetching data table data:', error );

		return {
			columns: [],
			data: [],
			error: error.message
		};
	}
};

export {
	FORMATS,
	COLUMN_FORMATTERS,
	createSortFunction,
	createCellFormatter,
	transformColumn,
	transformDataTableData,
	validateResponse,
	validateParams
};

export default getDataTableData;
