/**
 * `getData()` first-argument types for `burst/v1/data/...` routes.
 *
 * Aligned with `includes/Admin/App/class-app.php` `get_data()` and Pro `burst_get_data` handlers.
 * Ecommerce types use path `burst/v1/data/ecommerce/{segment}` — pass as `ecommerce/{segment}` to `getData`.
 */

/** Handled in `App::get_data()` switch (lowercase type param). */
export type BurstCoreDataType =
	| 'insights'
	| 'compare'
	| 'today'
	| 'goals'
	| 'live-visitors'
	| 'live-traffic'
	| 'live-goals'
	| 'devicestitleandvalue'
	| 'devicessubtitle';

/** Pro / filter handlers (`burst_get_data`). */
export type BurstProDataType =
	| 'geo'
	| 'page-parameters'
	| 'page-parameter-counts'
	| 'sources-over-time';

/** Ecommerce segment after `ecommerce/` (Pro). */
export type BurstEcommerceDataType =
	| 'ecommerce/sales'
	| 'ecommerce/sales-chart'
	| 'ecommerce/sales-forecast'
	| 'ecommerce/quick-wins'
	| 'ecommerce/top-performers'
	| 'ecommerce/sales-funnel'
	| 'ecommerce/subscriptions'
	| 'ecommerce/subscriptions-forecast';

export type ForecastSource = 'sales' | 'subscriptions';

export type ForecastMode = 'revenue' | 'sales';

export interface ForecastRow {
	timestamp: number;
	value: number;
}

export interface ForecastMetadata {
	growth_rate: number;
	limited_data: boolean;
	churn_rate?: number;
}

export interface ForecastData {
	interval: string;
	spans_multiple_years: boolean;
	rows: ForecastRow[];
	comparison_rows?: Array<{ timestamp: number; value: number | null }>;
	mode: ForecastMode;
	currency: string | null;
	metadata: ForecastMetadata;
}

/** All known `getData` type strings used in Admin App `src/api/`. */
export type BurstDataType =
	| BurstCoreDataType
	| BurstProDataType
	| BurstEcommerceDataType
	| string;

/**
 * Maps to PHP: `Statistics::get_insights_data()`.
 */
export interface InsightsChartDataset {
	data: number[];
	backgroundColor: string;
	borderColor: string;
	label: string;
	fill: string;
	metric_key?: string;
	is_comparison?: boolean;
	comparison_timestamps?: number[];
	compare_mode?: string;
}

export interface InsightsData {
	timestamps: number[];
	interval: string;
	spans_multiple_years: boolean;
	datasets: InsightsChartDataset[];
}

/**
 * Maps to PHP: `Sales_Chart::get_data()`.
 */
export interface SalesChartDataset {
	data: Array<number | null>;
	label: string;
	metric_key: string;
	is_comparison: boolean;
	is_forecast?: boolean;
	forecast_timestamps?: number[];
	comparison_timestamps?: Array<number | null>;
	compare_mode?: string;

	/**
	 * The forecast series starts with a copy of the last measured point so
	 * the solid and dashed lines connect; tooltips skip that bridge point.
	 */
	has_bridge_point?: boolean;

	/**
	 * Explicit x positions when the dataset covers more buckets than the
	 * shared timestamps (a comparison line extended across the forecast).
	 */
	x_timestamps?: number[];
}

export interface SalesChartData {
	timestamps: number[];
	interval: string;
	spans_multiple_years: boolean;
	mode: 'revenue' | 'sales';
	currency: string | null;
	datasets: SalesChartDataset[];
}
