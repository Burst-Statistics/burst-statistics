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
	| 'ecommerce/quick-wins'
	| 'ecommerce/top-performers'
	| 'ecommerce/sales-funnel'
	| 'ecommerce/subscriptions';

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

export interface BurstDataResponse<T = unknown> {
	data: T;
	request_success?: boolean;
	message?: string;
	code?: number;
}
