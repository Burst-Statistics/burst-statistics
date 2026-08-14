import { getData } from '@/utils/api';
import { normalizeChartEnvelope } from '@/utils/chartData';
import type { SalesChartData } from '@/types/api-endpoints';

export interface GetSalesChartDataArgs {
	startDate: string;
	endDate: string;
	range: string;
	filters: Record<string, unknown>;
	chartMode: 'revenue' | 'sales';
	compareMode: string;
	groupBy?: 'auto' | 'day' | 'week' | 'month' | 'year';
}

/**
 * Fetch total sales-over-time chart data from the ecommerce API.
 *
 * @param args - Date range, filters and the chart mode/series toggles.
 * @return Sales chart payload from PHP `Sales_Chart::get_data()`.
 */
// fallow-ignore-next-line complexity
export async function getSalesChartData({
	startDate,
	endDate,
	range,
	filters,
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
			filters,
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
