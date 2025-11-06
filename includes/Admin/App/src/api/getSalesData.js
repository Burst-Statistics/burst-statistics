import { getData } from '../utils/api';
import { __, _n } from '@wordpress/i18n';
import { formatCurrency, formatPercentage } from '../utils/formatting'

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
const getSales = async ( args ) => {
	const { startDate, endDate, range, filters } = args;
	const { data } = await getData( 'ecommerce/sales', startDate, endDate, range, {
		filters
	} );
	return transformSalesData( data );
};

const transformSalesData = ( data ) => {
	const transformed = {};

	Object.entries(data).forEach(([key, metric]) => {
		transformed[key] = {
			title: metric.label,
			value: '-',
			exactValue: null,
			subtitle: null,
			changeStatus: null,
			change: null,
		};

		if ( ! metric || ! metric.label ) {
			return;
		}

		const { current, previous, rate_change } = metric;

		if ( rate_change ) {
			transformed[key].change = formatPercentage(rate_change);
			if ( rate_change > 0 ) {
				transformed[key].change = `+${transformed[key].change}`;
				transformed[key].changeStatus = 'positive';
			} else {
				transformed[key].changeStatus = 'negative';
			}
		}

		switch (key) {
			case 'conversion-rate': {
				transformed[key].icon = 'eye';

				if ( ! current ) {
					break;
				}

				const conversionRate = current.conversion_rate ?? 0;
				transformed[key].value = formatPercentage(conversionRate);

				const totalVisitors = parseInt(current.visitors) ?? 0;
				const totalConverted = parseInt(current.total_converted) ?? 0;

				if (totalVisitors > 0 && totalConverted > 0) {
					const visitorsPerConversion = totalVisitors / totalConverted;
					const roundedRatio = Math.round(visitorsPerConversion);

					if (roundedRatio <= 1) {
						// Everyone converts
						transformed[key].subtitle = __('All visitors converted', 'burst-statistics');
					} else if (roundedRatio <= 5) {
						// Small ratio — show "X of Y visitors convert"
						const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
						const divisor = gcd(totalConverted, totalVisitors);
						const simplifiedConverted = Math.round(totalConverted / divisor);
						const simplifiedVisitors = Math.round(totalVisitors / divisor);

						transformed[key].subtitle = sprintf(
						  /* translators: 1: converted visitors, 2: total visitors */
						  __('%1$d of %2$d visitors convert', 'burst-statistics'),
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
				}

				break;
			}

			case 'abandonment-rate': {
				transformed[key].icon = 'sessions';

				if ( ! current ) {
					break;
				}

				const abandonedRate = current.abandoned_rate ?? 0;
				transformed[key].value = formatPercentage(abandonedRate);
				const totalAbandoned = parseInt(current.total_abandoned, 10);
				if (totalAbandoned > 0) {
					transformed[key].subtitle = _n(
					  `${totalAbandoned} cart was abandoned`,
					  `${totalAbandoned} carts were abandoned`,
					  totalAbandoned,
					  'burst-statistics'
					);
				} else {
					transformed[key].subtitle = __('No carts were abandoned', 'burst-statistics');
				}
				if ( rate_change > 0 ) {
					transformed[key].changeStatus = 'negative';
				} else {
					transformed[key].changeStatus = 'positive';
				}
				break;
			}

			case 'average-order': {
				transformed[key].icon = 'visitors';

				if ( ! current || ! current.average_order_value ) {
					break;
				}

				const avg = current.average_order_value ?? 0;
				const currency = current.currency ?? 'USD';
				transformed[key].value = formatCurrency(currency, avg);
				transformed[key].exactValue = avg;

				if (previous && previous.average_order_value) {
					if ( previous.average_order_value < current.average_order_value ) {
						transformed[key].subtitle = __(
						  `Up from ${formatCurrency(currency, previous.average_order_value)} last period`,
						  'burst-statistics'
						);
					} else if ( previous.average_order_value > current.average_order_value ) {
						transformed[ key ].subtitle = __(
						  `Down from ${ formatCurrency(currency, previous.average_order_value) } last period`,
						  'burst-statistics'
						);
					} else {
						transformed[key].subtitle = __('No change from last period', 'burst-statistics');
					}
				}
				break;
			}

			case 'revenue': {
				transformed[key].icon = 'log-out';

				if ( ! current || ! current.total_revenue ) {
					break;
				}

				const total = current.total_revenue ?? 0;
				const currency = current.currency ?? 'USD';
				transformed[key].value = formatCurrency(currency, total);
				transformed[key].exactValue = total;

				if (current.total_orders) {
					transformed[key].subtitle = _n(
					  `${current.total_orders} successful order`,
					  `${current.total_orders} successful orders`,
					  current.total_orders,
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