import { getData } from '../utils/api';
import {
	formatCurrency,
	formatPercentage,
	getCountryName,
	formatCurrencyCompact
} from '../utils/formatting';
import { __ } from '@wordpress/i18n';

/**
 * Get top performers
 *
 * @param { Object } args           - The arguments object.
 * @param { string } args.startDate - The start date for the data range.
 * @param { string } args.endDate   - The end date for the data range.
 * @param { string } args.range     - The range of data to retrieve.
 * @param { Object } args.filters   - Additional filters to apply to the data.
 *
 * @return {Promise<*>} The formatted number of live visitors.
 */
const getTopPerformers = async( args ) => {
	const { startDate, endDate, range, filters } = args;
	const { data } = await getData(
		'ecommerce/top-performers',
		startDate,
		endDate,
		range,
		{
			filters
		}
	);
	return data;
};

/**
 * Get the current value for a top performer metric.
 *
 * @param {string} selectedOption The selected option ('revenue' or 'count').
 * @param {Object} current        The current data object.
 * @return {number} The current value.
 */
const getCurrentValue = ( selectedOption, current ) => {
	if ( 'revenue' === selectedOption ) {
		return current.total_revenue ?? 0;
	}
	return current.total_quantity_sold ?? 0;
};

/**
 * Get the previous value for a top performer metric.
 *
 * @param {string} selectedOption The selected option ('revenue' or 'count').
 * @param {Object} previous       The previous data object.
 * @return {number} The previous value.
 */
const getPreviousValue = ( selectedOption, previous ) => {
	if ( 'revenue' === selectedOption ) {
		return previous.total_revenue ?? 0;
	}
	return previous.total_quantity_sold ?? 0;
};

/**
 * Transform top performers data.
 *
 * @param { Object } data           - The raw data array.
 * @param { string } selectedOption - The selected option for data retrieval.
 *
 * @return { Object } The transformed data array.
 */
export const transformTopPerformersData = ( data, selectedOption ) => {
	const transformedData = {};

	Object.entries( data ).forEach( ([ name, value ]) => {
		if ( ! transformedData[name]) {
			transformedData[name] = {};
		}

		transformedData[name].title = value.label;

		// Set default subtitle based on metric type.
		let defaultSubtitle = __( 'No data available', 'burst-statistics' );
		switch ( name ) {
			case 'top-product':
				defaultSubtitle = __( 'No product data available', 'burst-statistics' );
				break;
			case 'top-device':
				defaultSubtitle = __( 'No device data available', 'burst-statistics' );
				break;
			case 'top-country':
				defaultSubtitle = __( 'No country data available', 'burst-statistics' );
				break;
			case 'top-campaign':
				defaultSubtitle = __( 'No campaign data available', 'burst-statistics' );
				break;
		}

		const { current, previous, revenue_change } = value;

		// Always set subtitle.
		if ( current ) {
			switch ( name ) {
				case 'top-product':
					transformedData[name].subtitle =
						current.product_name || defaultSubtitle;
					break;
				case 'top-device':
					transformedData[name].subtitle =
						current.device_name || defaultSubtitle;
					break;
				case 'top-country':
					transformedData[name].subtitle = current.country_code ?
						getCountryName( current.country_code ) :
						defaultSubtitle;
					break;
				case 'top-campaign':
					transformedData[name].subtitle =
						current.campaign_name || defaultSubtitle;
					break;
			}
		} else {
			transformedData[name].subtitle = defaultSubtitle;
		}

		// Always set value.
		if ( 'revenue' === selectedOption ) {
			const revenue = current?.total_revenue ?? 0;
			transformedData[name].value = 0 < revenue ?
				formatCurrencyCompact( current.currency ?? 'USD', revenue ) :
				formatCurrencyCompact( current?.currency ?? 'USD', 0 );
			transformedData[name].exactValue = revenue;
			transformedData[name].tooltipText = formatCurrency( current.currency ?? 'USD', revenue );
		} else {
			const quantity = current?.total_quantity_sold ?? 0;
			transformedData[name].value = quantity;
			transformedData[name].exactValue = quantity;
		}

		// Determine change value and status, handling infinity and zero cases.
		if ( null !== revenue_change && revenue_change !== undefined ) {
			if ( 0 === revenue_change ) {
				transformedData[name].change = '0%';
				transformedData[name].changeStatus = 'positive';
			} else {
				transformedData[name].change = formatPercentage( revenue_change );
				if ( 0 < revenue_change ) {
					transformedData[name].change = `+${transformedData[name].change}`;
					transformedData[name].changeStatus = 'positive';
				} else {
					transformedData[name].changeStatus = 'negative';
				}
			}
		} else if ( current && previous ) {

			// Handle infinity cases when revenue_change is null.
			const currentValue = getCurrentValue( selectedOption, current );
			const previousValue = getPreviousValue( selectedOption, previous );

			if ( 0 === previousValue && 0 < currentValue ) {

				// Positive infinity: went from 0 to something.
				transformedData[name].change = '∞';
				transformedData[name].changeStatus = 'positive';
			} else if ( 0 < previousValue && 0 === currentValue ) {

				// Negative infinity: went from something to 0.
				transformedData[name].change = '-∞';
				transformedData[name].changeStatus = 'negative';
			} else if ( 0 === previousValue && 0 === currentValue ) {

				// Both are 0: no change.
				transformedData[name].change = '0%';
				transformedData[name].changeStatus = 'positive';
			}
		} else if ( current ) {

			// Only current data exists, treat as positive (new data).
			const currentValue = getCurrentValue( selectedOption, current );
			if ( 0 < currentValue ) {
				transformedData[name].change = '∞';
				transformedData[name].changeStatus = 'positive';
			} else {
				transformedData[name].change = '0%';
				transformedData[name].changeStatus = 'positive';
			}
		} else {

			// No data: set to placeholder values.
			transformedData[name].change = null;
			transformedData[name].changeStatus = '-';
		}
	});
	return transformedData;
};
export default getTopPerformers;
