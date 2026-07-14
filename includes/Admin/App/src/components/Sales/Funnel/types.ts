/**
 * Funnel stage data structure from API.
 */
export interface FunnelStage {
	id: string;
	stage: string;
	value: number;
}

/**
 * Statistics calculated for each step in the funnel.
 */
export interface StepStatistics {
	label: string;
	value: number;
	percentage: number;
	dropOff: number | null;
	dropOffPercentage: number | null;
	isHighestDropOff: boolean;
}

/**
 * Sales data structure from API.
 */
export interface SalesMetric {
	title: string;
	value: string;
	exactValue: number | null;
	subtitle: string | null;
	changeStatus: string | null;
	change: string | null;
	currency?: string;
	tooltipText: string;
}

/**
 * Props for FunnelChart component.
 */
export interface FunnelChartProps {
	data: FunnelStage[];
	salesData?: {
		revenue?: SalesMetric;
		'average-order'?: SalesMetric;
		'conversion-rate'?: SalesMetric;
		'abandonment-rate'?: SalesMetric;
	} | null;
}
