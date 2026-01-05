import { getData } from '../utils/api';
import { __, _n, sprintf } from '@wordpress/i18n';
import { formatCurrency, formatCurrencyCompact, formatPercentage } from '../utils/formatting';

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
const getSales = async( args ) => {
	const { startDate, endDate, range, filters } = args;
	const { data } = await getData(
		'ecommerce/sales',
		startDate,
		endDate,
		range,
		{
			filters
		}
	);
	return transformSalesData( data );
};

/**
 * Get the current value for a metric key.
 *
 * @param {string} key     The metric key.
 * @param {Object} current The current data object.
 * @return {number} The current value.
 */
const getCurrentValue = ( key, current ) => {
	switch ( key ) {
		case 'conversion-rate':
			return current.conversion_rate ?? 0;
		case 'abandonment-rate':
			return current.abandoned_rate ?? 0;
		case 'average-order':
			return current.average_order_value ?? 0;
		case 'revenue':
			return current.total_revenue ?? 0;
		default:
			return 0;
	}
};

/**
 * Get the previous value for a metric key.
 *
 * @param {string} key      The metric key.
 * @param {Object} previous The previous data object.
 * @return {number} The previous value.
 */
const getPreviousValue = ( key, previous ) => {
	switch ( key ) {
		case 'conversion-rate':
			return previous.conversion_rate ?? 0;
		case 'abandonment-rate':
			return previous.abandoned_rate ?? 0;
		case 'average-order':
			return previous.average_order_value ?? 0;
		case 'revenue':
			return previous.total_revenue ?? 0;
		default:
			return 0;
	}
};

const transformSalesData = ( data ) => {
	const transformed = {};

	Object.entries( data ).forEach( ([ key, metric ]) => {

		// Set default subtitle based on metric type.
		let defaultSubtitle = __( 'No data available', 'burst-statistics' );
		switch ( key ) {
			case 'conversion-rate':
				defaultSubtitle = __( 'No conversion data available', 'burst-statistics' );
				break;
			case 'abandonment-rate':
				defaultSubtitle = __( 'No cart data available', 'burst-statistics' );
				break;
			case 'average-order':
				defaultSubtitle = __( 'No order data available', 'burst-statistics' );
				break;
			case 'revenue':
				defaultSubtitle = __( 'No revenue data available', 'burst-statistics' );
				break;
		}

		transformed[key] = {
			title: metric.label,
			value: '-',
			exactValue: null,
			subtitle: defaultSubtitle,
			changeStatus: null,
			change: null,
			tooltipText: null
		};

		if ( ! metric || ! metric.label ) {
			return;
		}

		const { current, previous, rate_change } = metric;

		// Determine change value and status, handling infinity and zero cases.
		const isAbandonmentRate = 'abandonment-rate' === key;
		if ( null !== rate_change && rate_change !== undefined ) {
			if ( 0 === rate_change ) {
				transformed[key].change = '0%';
				transformed[key].changeStatus = 'positive';
			} else {
				transformed[key].change = formatPercentage( rate_change );
				if ( 0 < rate_change ) {
					transformed[key].change = `+${transformed[key].change}`;

					// For abandonment rate, higher is bad (negative), otherwise positive.
					transformed[key].changeStatus = isAbandonmentRate ? 'negative' : 'positive';
				} else {

					// For abandonment rate, lower is good (positive), otherwise negative.
					transformed[key].changeStatus = isAbandonmentRate ? 'positive' : 'negative';
				}
			}
		} else if ( current && previous ) {

			// Handle infinity cases when rate_change is null.
			const currentValue = getCurrentValue( key, current );
			const previousValue = getPreviousValue( key, previous );

			if ( 0 === previousValue && 0 < currentValue ) {

				// Positive infinity: went from 0 to something.
				transformed[key].change = '∞';

				// For abandonment rate, going from 0 to something is bad (negative).
				transformed[key].changeStatus = isAbandonmentRate ? 'negative' : 'positive';
			} else if ( 0 < previousValue && 0 === currentValue ) {

				// Negative infinity: went from something to 0.
				transformed[key].change = '-∞';

				// For abandonment rate, going from something to 0 is good (positive).
				transformed[key].changeStatus = isAbandonmentRate ? 'positive' : 'negative';
			} else if ( 0 === previousValue && 0 === currentValue ) {

				// Both are 0: no change.
				transformed[key].change = '0%';
				transformed[key].changeStatus = 'positive';
			}
		} else if ( current ) {

			// Only current data exists, treat as positive (new data).
			const currentValue = getCurrentValue( key, current );
			if ( 0 < currentValue ) {
				transformed[key].change = '∞';

				// For abandonment rate, having data when there was none is bad (negative).
				transformed[key].changeStatus = isAbandonmentRate ? 'negative' : 'positive';
			} else {
				transformed[key].change = '0%';
				transformed[key].changeStatus = 'positive';
			}
		} else {

			// No data: set to 0%.
			transformed[key].change = '0%';
			transformed[key].changeStatus = 'positive';
		}

		switch ( key ) {
			case 'conversion-rate': {
				transformed[key].icon = 'eye';

				if ( ! current ) {
					transformed[key].subtitle = __(
						'No conversion data available',
						'burst-statistics'
					);
					break;
				}

				const conversionRate = current.conversion_rate ?? 0;
				transformed[key].value = formatPercentage( conversionRate );

				const totalVisitors = parseInt( current.visitors ) ?? 0;
				const totalConverted = parseInt( current.total_converted ) ?? 0;

				if ( 0 < totalVisitors && 0 < totalConverted ) {
					const visitorsPerConversion =
						totalVisitors / totalConverted;
					const roundedRatio = Math.round( visitorsPerConversion );

					if ( 1 >= roundedRatio ) {

						// Everyone converts
						transformed[key].subtitle = __(
							'All visitors converted',
							'burst-statistics'
						);
					} else if ( 5 >= roundedRatio ) {

						// Small ratio — show "X of Y visitors convert"
						const gcd = ( a, b ) => ( 0 === b ? a : gcd( b, a % b ) );
						const divisor = gcd( totalConverted, totalVisitors );
						const simplifiedConverted = Math.round(
							totalConverted / divisor
						);
						const simplifiedVisitors = Math.round(
							totalVisitors / divisor
						);

						transformed[key].subtitle = sprintf(

							/* translators: 1: converted visitors, 2: total visitors */
							__(
								'%1$d of %2$d visitors convert',
								'burst-statistics'
							),
							simplifiedConverted,
							simplifiedVisitors
						);
					} else {

						// Larger ratios — use "1 in X visitors convert"
						transformed[key].subtitle = _n(
							`1 in ${roundedRatio} visitor converts`,
							`1 in ${roundedRatio} visitors convert`,
							roundedRatio,
							'burst-statistics'
						);
					}
				} else if ( 0 < totalVisitors ) {

					// Visitors but no conversions.
					transformed[key].subtitle = __(
						'No conversions yet',
						'burst-statistics'
					);
				} else {

					// No visitors.
					transformed[key].subtitle = __(
						'No visitors in this period',
						'burst-statistics'
					);
				}

				break;
			}

			case 'abandonment-rate': {
				transformed[key].icon = 'sessions';

				if ( ! current ) {
					transformed[key].subtitle = __(
						'No cart data available',
						'burst-statistics'
					);
					break;
				}

				const abandonedRate = current.abandoned_rate ?? 0;
				transformed[key].value = formatPercentage( abandonedRate );
				const totalAbandoned = parseInt( current.total_abandoned, 10 );
				if ( 0 < totalAbandoned ) {
					transformed[key].subtitle = _n(
						`${totalAbandoned} cart was abandoned`,
						`${totalAbandoned} carts were abandoned`,
						totalAbandoned,
						'burst-statistics'
					);
				} else {
					transformed[key].subtitle = __(
						'No carts were abandoned',
						'burst-statistics'
					);
				}

				// Note: changeStatus is already set correctly in the main logic above.
				break;
			}

			case 'average-order': {
				transformed[key].icon = 'visitors';

				if ( ! current ) {
					transformed[key].subtitle = __(
						'No order data available',
						'burst-statistics'
					);
					break;
				}

				const avg = current.average_order_value ?? 0;
				const currency = current.currency ?? 'USD';
				transformed[key].value = formatCurrencyCompact( currency, avg );
				transformed[key].exactValue = avg;
				transformed[key].tooltipText = formatCurrency( currency, avg );

				if ( previous && null !== previous.average_order_value && previous.average_order_value !== undefined ) {
					if (
						previous.average_order_value <
						current.average_order_value
					) {
						transformed[key].subtitle = __(
							`Up from ${formatCurrencyCompact( currency, previous.average_order_value )} last period`,
							'burst-statistics'
						);
					} else if (
						previous.average_order_value >
						current.average_order_value
					) {
						transformed[key].subtitle = __(
							`Down from ${formatCurrencyCompact( currency, previous.average_order_value )} last period`,
							'burst-statistics'
						);
					} else {
						transformed[key].subtitle = __(
							'No change from last period',
							'burst-statistics'
						);
					}
				} else {

					// No previous data to compare.
					transformed[key].subtitle = __(
						'No previous period data',
						'burst-statistics'
					);
				}
				break;
			}

			case 'revenue': {
				transformed[key].icon = 'log-out';

				if ( ! current ) {
					transformed[key].subtitle = __(
						'No revenue data available',
						'burst-statistics'
					);
					break;
				}

				const total = current.total_revenue ?? 0;
				const currency = current.currency ?? 'USD';
				transformed[key].value = formatCurrencyCompact( currency, total );
				transformed[key].exactValue = total;
				transformed[key].tooltipText = formatCurrency( currency, total );

				const totalOrders = parseInt( current.total_orders ) ?? 0;
				if ( 0 < totalOrders ) {
					transformed[key].subtitle = _n(
						`${totalOrders} successful order`,
						`${totalOrders} successful orders`,
						totalOrders,
						'burst-statistics'
					);
				} else {
					transformed[key].subtitle = __(
						'No orders in this period',
						'burst-statistics'
					);
				}
				break;
			}

			default:
				break;
		}
	});

	return transformed;
};

export default getSales;
