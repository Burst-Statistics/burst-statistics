/**
 * Insights block API types.
 */

export type {
	InsightsData
} from './api-endpoints';

export interface GetInsightsDataArgs {
	startDate: string;
	endDate: string;
	range: string;
	args?: Record<string, unknown>;
}
