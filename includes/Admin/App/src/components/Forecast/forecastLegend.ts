import { __ } from '@wordpress/i18n';
import { SALES_CHART_COLORS } from '@/components/Sales/SalesChart/salesChartData';
import type { ChartLegendItem } from '@/components/Common/ChartLegend';

/**
 * Build the legend for a forecast line chart: the actuals series, plus the
 * comparison and forecast series while their toggles are on.
 *
 * @param actualLabel     - Localized label for the actuals series.
 * @param showComparison  - Whether the comparison series is shown.
 * @param comparisonLabel - Localized label for the comparison series.
 * @param showForecast    - Whether the forecast series is shown.
 * @return Legend items for ChartLegend.
 */
export function buildForecastLegendItems(
	actualLabel: string,
	showComparison: boolean,
	comparisonLabel: string,
	showForecast: boolean
): ChartLegendItem[] {
	const items: ChartLegendItem[] = [
		{
			key: 'actual',
			color: SALES_CHART_COLORS.primary,
			dashed: false,
			label: actualLabel
		}
	];

	if ( showComparison ) {
		items.push({
			key: 'comparison',
			color: SALES_CHART_COLORS.comparison,
			dashed: true,
			label: comparisonLabel
		});
	}

	if ( showForecast ) {
		items.push({
			key: 'forecast',
			color: SALES_CHART_COLORS.forecast,
			dashed: true,
			label: __( 'Forecast', 'burst-statistics' )
		});
	}

	return items;
}
