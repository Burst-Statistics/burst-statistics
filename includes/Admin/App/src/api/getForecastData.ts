import { getData } from '@/utils/api';
import { normalizeChartEnvelope, toFiniteNumber } from '@/utils/chartData';
import type {
	ForecastData,
	ForecastMode,
	ForecastSource
} from '@/types/api-endpoints';

interface GetForecastDataArgs {
	source: ForecastSource;
	startDate: string;
	endDate: string;
	range: string;
	filters: Record<string, unknown>;
	chartMode: ForecastMode;
	groupBy?: 'month' | 'year';
}

const FORECAST_ENDPOINTS: Record<ForecastSource, string> = {
	sales: 'ecommerce/sales-forecast',
	subscriptions: 'ecommerce/subscriptions-forecast'
};

/**
 * Fetch and normalize the common sales/subscription forecast response.
 *
 * Sales forecasts receive the active visitor filters. Subscription forecasts
 * deliberately omit them because subscription aggregates are not connected to
 * visitor statistics.
 */
// fallow-ignore-next-line complexity
export async function getForecastData({
	source,
	startDate,
	endDate,
	range,
	filters,
	chartMode,
	groupBy
}: GetForecastDataArgs ): Promise<ForecastData> {
	const requestArgs: Record<string, unknown> = {
		chart_mode: chartMode,

		// Explicit bucket size, matching the historical chart request, so the
		// backend cannot resolve a different interval than the chart shows.
		...( groupBy ? { group_by: groupBy } : {})
	};

	if ( 'sales' === source ) {
		requestArgs.filters = filters;
	}

	const { data } = await getData(
		FORECAST_ENDPOINTS[source],
		startDate,
		endDate,
		range,
		requestArgs
	);

	const rows = Array.isArray( data?.rows ) ?
		data.rows
			.map( ( row: Record<string, unknown> ) => ({
				timestamp: toFiniteNumber( row?.timestamp ),
				value: toFiniteNumber( row?.value )
			}) )
			.filter( ( row: { timestamp: number }) => 0 < row.timestamp ) :
		[];

	// Same-month-last-year totals per forecast bucket; null marks months the
	// history does not reach, so the extended comparison line stops there.
	const comparisonRows = Array.isArray( data?.comparison_rows ) ?
		data.comparison_rows

			// fallow-ignore-next-line complexity
			.map( ( row: Record<string, unknown> ) => ({
				timestamp: toFiniteNumber( row?.timestamp ),
				value: null === row?.value || undefined === row?.value ?
					null :
					toFiniteNumber( row?.value )
			}) )
			.filter( ( row: { timestamp: number }) => 0 < row.timestamp ) :
		[];

	const churnRate = toFiniteNumber( data?.metadata?.churn_rate, 0 );

	return {
		...normalizeChartEnvelope( data, chartMode ),
		rows,
		comparison_rows: comparisonRows,
		metadata: {
			growth_rate: toFiniteNumber( data?.metadata?.growth_rate, 0 ),
			limited_data: Boolean( data?.metadata?.limited_data ),
			...( 'subscriptions' === source ? { churn_rate: churnRate } : {})
		}
	};
}
