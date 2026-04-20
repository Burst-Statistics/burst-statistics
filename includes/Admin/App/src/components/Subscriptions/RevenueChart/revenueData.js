import { getData } from '@/utils/api';

/**
 * Fetch new vs recurring chart data from the subscriptions API.
 *
 * @param {Object} args Chart request arguments.
 * @param {string} args.startDate Start date.
 * @param {string} args.endDate End date.
 * @param {string} args.range Selected range key.
 * @param {Object} args.filters Active filters.
 * @param {string} args.chartMode Selected chart mode.
 * @return {Promise<Object>} Chart payload for Nivo.
 */
export async function fetchRevenueData({ startDate, endDate, range, filters, chartMode }) {
	const { data } = await getData(
		'subscriptions-revenue-chart',
		startDate,
		endDate,
		range,
		{ filters, chart_mode: chartMode }
	);

	if ( ! data || 'object' !== typeof data ) {
		return {
			interval: 'day',
			spans_multiple_years: false,
			rows: [],
			mode: chartMode,
			currency: null
		};
	}

	return {
		interval: data.interval ?? 'day',
		spans_multiple_years: Boolean( data.spans_multiple_years ),
		rows: Array.isArray( data.rows ) ? data.rows : [],
		mode: data.mode ?? chartMode,
		currency: data.currency ?? null
	};
}

/** Colors for new and recurring revenue bars respectively. */
export const REVENUE_COLORS = [ 'var(--color-primary-700)', 'var(--color-primary-300)' ];
