/**
 * Insights block API types.
 */

export type {
	InsightsChartDataset,
	InsightsData,
	BurstDataResponse
} from './api-endpoints';

export interface GetInsightsDataArgs {
	startDate: string;
	endDate: string;
	range: string;
	args?: Record<string, unknown>;
}
