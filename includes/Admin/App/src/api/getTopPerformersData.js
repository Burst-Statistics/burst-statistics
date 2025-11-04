import { getData } from '../utils/api';
import { formatCurrency, formatPercentage, getCountryName } from '../utils/formatting'

/**
 * Get top performers
 *
 * @param { Object } args - The arguments object.
 * @param { string } args.startDate - The start date for the data range.
 * @param { string } args.endDate - The end date for the data range.
 * @param { string } args.range - The range of data to retrieve.
 * @param { Object } args.filters - Additional filters to apply to the data.
 *
 * @returns {Promise<*>} The formatted number of live visitors.
 */
const getTopPerformers = async ( args ) => {
	const { startDate, endDate, range, filters } = args;
	const { data } = await getData( 'ecommerce/top-performers', startDate, endDate, range, {
		filters
	} );
	return data;
};

/**
 * Transform top performers data.
 *
 * @param { Object }  data - The raw data array.
 * @param { string } selectedOption - The selected option for data retrieval.
 *
 * @returns { Object } The transformed data array.
 */
export const transformTopPerformersData = ( data, selectedOption ) => {
	const transformedData = {};

	Object.entries( data ).forEach(
	  ( [ name, value ] ) => {
		  if ( ! transformedData[ name ] ) {
			  transformedData[ name ] = {};
		  }

		  transformedData[ name ].title = value.label;

		  if ( value.current ) {
			  switch ( name ) {
				  case 'top-product':
					  transformedData[ name ].subtitle = value.current.product_name ?? '-';
					  break;
				  case 'top-device':
					  transformedData[ name ].subtitle = value.current.device_name ?? '-';
					  break;
				  case 'top-country':
					  transformedData[ name ].subtitle = value.current.country_code ? getCountryName( value.current.country_code ) : '-';
					  break;
				  case 'top-campaign':
					  transformedData[ name ].subtitle = value.current.campaign_name ?? '-';
					  break;
			  }

			  if ( selectedOption === 'revenue' ) {
				  transformedData[ name ].value = value.current.total_revenue ? formatCurrency( value.current.currency, value.current.total_revenue ) : '-';
			  } else {
				  transformedData[ name ].value = value.current.total_quantity_sold ? value.current.total_quantity_sold : '-';
			  }

			  if ( selectedOption === 'revenue' ) {
				  transformedData[ name ].exactValue = value.current.total_revenue ? value.current.total_revenue : '-';
			  } else {
				  transformedData[ name ].exactValue = value.current.total_quantity_sold ? value.current.total_quantity_sold : '-';
			  }

			  transformedData[ name ].change = value.revenue_change ? formatPercentage( value.revenue_change ) : null;

			  if ( value.revenue_change && value.revenue_change > 0 ) {
				  transformedData[name].change = `+${transformedData[name].change}`;
				  transformedData[name].changeStatus = 'positive';
			  } else {
				  transformedData[name].changeStatus = 'negative';
			  }
		  } else {
			  transformedData[ name ].value = '-';
			  transformedData[ name ].exactValue = '-';
			  transformedData[ name ].change = null;
			  transformedData[ name ].changeStatus = '-';
		  }
	  }
	);
	return transformedData;
}
export default getTopPerformers;
