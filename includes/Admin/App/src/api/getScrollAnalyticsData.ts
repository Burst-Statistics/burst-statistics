import { getData } from '@/utils/api';
import { isValidObject } from '@/utils/objectUtils';

export interface ScrollFunnelStage {
	[key: string]: string | number;
	id: string;
	value: number;
	label: string;
	percentage: number;
	dropoff: number;
	avgDwell: string;
}

export interface ScrollDwellZone {
	[key: string]: string | number;
	zone: string;
	seconds: number;
	label: string;
	sharePercent: number;
	readingStatus: string;
	color: string;
}

export interface ScrollDepthDatum {
	[key: string]: string | number;
	range: string;
	percentage: number;
	visitors: number;
	dwellSeconds: number;
}

export interface ScrollAnalyticsData {
	funnel: {
		total_visitors: number;
		avg_scroll: number;
		stages: ScrollFunnelStage[];
	};
	dwell_zones: ScrollDwellZone[];
	scroll_depth: {
		totalPageviews: number;
		meaningfulVisits?: number;
		totalRawVisits?: number;
		data: ScrollDepthDatum[];
		insight: {
			range: string;
			dwellSeconds: number;
		};
	};
}

interface GetScrollAnalyticsArgs {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
}

// fallow-ignore-next-line complexity
export async function getScrollAnalyticsData(
	args: GetScrollAnalyticsArgs
): Promise<ScrollAnalyticsData> {
	const { id, pageUrl, startDate, endDate, range, filters } = args;

	const { data } = await getData(
		'scroll-analytics',
		startDate || '',
		endDate || '',
		range || '',
		{
			page_id: id,
			page_url: pageUrl,
			filters
		}
	);

	return ( isValidObject<ScrollAnalyticsData>( data ) ? data : null ) || {
		funnel: {
			total_visitors: 0,
			avg_scroll: 0,
			stages: []
		},
		dwell_zones: [],
		scroll_depth: {
			totalPageviews: 0,
			data: [],
			insight: {
				range: '50–75%',
				dwellSeconds: 0
			}
		}
	};
}
