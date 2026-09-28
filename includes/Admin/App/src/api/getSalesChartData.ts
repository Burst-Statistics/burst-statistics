import { getData } from '@/utils/api';
import { normalizeChartEnvelope } from '@/utils/chartData';
import type { SalesChartData } from '@/types/api-endpoints';

export interface GetSalesChartDataArgs {
	startDate: string;
	endDate: string;
	range: string;
	chartMode: 'revenue' | 'sales';
	compareMode: string;
	groupBy?: 'auto' | 'day' | 'week' | 'month' | 'year';
}

/**
 * Fetch total sales-over-time chart data from the ecommerce API.
 *
 * The chart shows the store's total revenue next to its forecast, so visitor
 * filters do not apply and are deliberately not part of the request.
 *
 * @param args - Date range and the chart mode/series toggles.
 * @return Sales chart payload from PHP `Sales_Chart::get_data()`.
 */
// fallow-ignore-next-line complexity
export async function getSalesChartData({
	startDate,
	endDate,
	range,
	chartMode,
	compareMode,
	groupBy = 'auto'
}: GetSalesChartDataArgs ): Promise<SalesChartData> {
	const { data } = await getData(
		'ecommerce/sales-chart',
		startDate,
		endDate,
		range,
		{
			chart_mode: chartMode,
			...( compareMode ? { compare_mode: compareMode } : {}),
			...( 'auto' !== groupBy ? { group_by: groupBy } : {})
		}
	);

	return {
		...normalizeChartEnvelope( data, chartMode ),
		timestamps: Array.isArray( data?.timestamps ) ? data.timestamps : [],
		datasets: Array.isArray( data?.datasets ) ? data.datasets : []
	};
}
