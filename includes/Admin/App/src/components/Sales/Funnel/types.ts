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
 * Simplified funnel step for key insights.
 */
export interface FunnelStep {
    name: string;
    sessions: number;
}

/**
 * Information about the biggest drop-off in the funnel.
 */
export interface BiggestDropOff {
    fromStep: string;
    toStep: string;
    dropOffPercentage: number;
}

/**
 * Data structure for the purchased step.
 */
export interface PurchasedStepData {
    totalRevenue: number;
    totalConversions: number;
    averageOrderValue: number;
    funnelConversionRate: number;
    currency?: string;
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

