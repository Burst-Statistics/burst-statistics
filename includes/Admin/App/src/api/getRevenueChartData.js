import { getData } from '@/utils/api';
import { normalizeChartEnvelope } from '@/utils/chartData';

/**
 * Fetch new vs recurring chart data from the subscriptions API.
 *
 * Subscription daily rows are site-wide, so visitor filters do not apply and
 * are deliberately not part of the request.
 *
 * @param {Object} args Chart request arguments.
 * @param {string} args.startDate Start date.
 * @param {string} args.endDate End date.
 * @param {string} args.range Selected range key.
 * @param {string} args.chartMode Selected chart mode.
 * @param {string} args.compareMode Optional comparison mode.
 * @param {string} args.groupBy Optional bucket size override (auto|day|week|month|year).
 * @return {Promise<Object>} Chart payload for Nivo.
 */
// fallow-ignore-next-line complexity
export async function getRevenueChartData({ startDate, endDate, range, chartMode, compareMode = '', groupBy = 'auto' }) {
	const { data } = await getData(
		'ecommerce/subscriptions-revenue-chart',
		startDate,
		endDate,
		range,
		{
			chart_mode: chartMode,
			...( compareMode ? { compare_mode: compareMode } : {}),
			...( 'auto' !== groupBy ? { group_by: groupBy } : {})
		}
	);
	const response = data && 'object' === typeof data ? data : {};

	return {
		...normalizeChartEnvelope( response, chartMode ),
		rows: Array.isArray( response.rows ) ? response.rows : [],
		comparisonRows: Array.isArray( response.comparison_rows ) ? response.comparison_rows : [],
		compareMode: 'string' === typeof response.compare_mode ? response.compare_mode : null
	};
}
