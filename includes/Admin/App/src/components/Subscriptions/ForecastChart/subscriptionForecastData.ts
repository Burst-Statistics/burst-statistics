import { normalizeChartEnvelope } from '@/utils/chartData';
import type {
	SalesChartData,
	SalesChartDataset
} from '@/types/api-endpoints';

type SubscriptionRevenueRow = Record<string, unknown>;

/**
 * Convert the Subscription new/renewal chart response into the historical
 * total line used beside the future renewal forecast.
 *
 * @param payload         - Subscription revenue chart payload.
 * @param actualLabel     - Localized historical series label.
 * @param comparisonLabel - Localized comparison series label.
 * @param fallbackMode    - Mode used when the response is malformed.
 * @return SalesChartGraph-compatible historical line payload.
 */
// fallow-ignore-next-line complexity -- Branches are payload guards; covered by subscriptionForecastData.test.ts.
export function buildSubscriptionHistoryChartData(
	payload: unknown,
	actualLabel: string,
	comparisonLabel: string,
	fallbackMode: 'revenue' | 'sales' = 'revenue'
): SalesChartData {
	const response: Record<string, unknown> =
		payload && 'object' === typeof payload ? ( payload as Record<string, unknown> ) : {};
	const envelope = normalizeChartEnvelope( response, fallbackMode );
	const rows: SubscriptionRevenueRow[] = Array.isArray( response.rows ) ? response.rows : [];
	const comparisonRows: SubscriptionRevenueRow[] = Array.isArray( response.comparisonRows ) ?
		response.comparisonRows :
		[];

	// Renewals only: the forecast beside this line projects renewals, and
	// new-subscription signup revenue already counts in the sales total.
	const renewalValue = ( row: SubscriptionRevenueRow | undefined ): number =>
		Number( row?.renewalValue ?? 0 );
	const datasets: SalesChartDataset[] = [
		{
			data: rows.map( renewalValue ),
			label: actualLabel,
			metric_key: envelope.mode,
			is_comparison: false
		}
	];

	if ( 0 < comparisonRows.length ) {
		datasets.push({

			// Missing shifted buckets stay null instead of rendering as fake
			// zero values; extra comparison buckets beyond the current range
			// are dropped by mapping over the current rows.
			data: rows.map( ( row, index ) =>
				comparisonRows[ index ] ? renewalValue( comparisonRows[ index ]) : null
			),
			label: comparisonLabel,
			metric_key: envelope.mode,
			is_comparison: true,
			comparison_timestamps: rows.map( ( row, index ) =>
				comparisonRows[ index ] ? Number( comparisonRows[ index ].timestamp ) : null
			),
			...( 'string' === typeof response.compareMode ?
				{ compare_mode: response.compareMode } :
				{})
		});
	}

	return {
		...envelope,
		timestamps: rows.map( ( row ) => Number( row.timestamp ) ),
		datasets
	};
}
