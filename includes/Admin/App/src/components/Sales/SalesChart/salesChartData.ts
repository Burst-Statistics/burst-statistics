/**
 * A single point of a rendered chart series, carrying the flags the custom
 * line layer and tooltip need to style and label it.
 */
export interface SalesChartDatum {
	x: Date;

	/** Null marks a bucket without data, rendered as a gap in the line. */
	y: number | null;
	isComparison: boolean;
	isForecast: boolean;
	isBridge: boolean;
	compareDate: Date | null;
	compareMode: string | null;
}

/** Nivo line series shape for the sales chart. */
export interface SalesChartSeries {
	id: string;
	color: string;
	data: SalesChartDatum[];
}

/** Series colors: actuals, forecast, and comparison. */
export const SALES_CHART_COLORS = {
	primary: 'var(--color-primary-700)',
	forecast: 'var(--color-primary-300)',
	comparison: 'var(--color-gray-400)'
} as const;
