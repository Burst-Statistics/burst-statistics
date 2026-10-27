import type { InsightsData } from '@/types/insights-api';

export const DEFAULT_INSIGHTS_PLACEHOLDER_DATA: InsightsData = {
	timestamps: [ 0, 0, 0, 0, 0, 0, 0 ],
	interval: 'day',
	spans_multiple_years: false,
	datasets: [
		{
			data: [ 0, 0, 0, 0, 0, 0, 0 ],
			backgroundColor: 'var(--color-blue-400)',
			borderColor: 'var(--color-blue-400)',
			label: '-',
			metric_key: 'placeholder_a',
			is_comparison: false,
			fill: 'false'
		},
		{
			data: [ 0, 0, 0, 0, 0, 0, 0 ],
			backgroundColor: 'var(--color-yellow-500)',
			borderColor: 'var(--color-yellow-500)',
			label: '-',
			metric_key: 'placeholder_b',
			is_comparison: false,
			fill: 'false'
		}
	]
};
