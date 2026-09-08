import { getData } from '@/utils/api';
import { isValidObject } from '@/utils/objectUtils';

export interface VisitorFlowFlowNode {
	name: string;
	type: 'page' | 'direct' | 'search' | 'referrer' | 'campaign' | 'exit';
	url?: string;
	count: number;
	percentage: number;
}

interface VisitorFlowTargetNode {
	id: string;
	title: string;
	url: string;
	total_visitors: number;
	total_pageviews: number;
}

export interface VisitorFlowData {
	target: VisitorFlowTargetNode;
	entries: VisitorFlowFlowNode[];
	exits: VisitorFlowFlowNode[];
}

interface GetVisitorFlowArgs {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
}

// fallow-ignore-next-line complexity
export async function getVisitorFlowData(
	args: GetVisitorFlowArgs
): Promise<VisitorFlowData> {
	const { id, pageUrl, startDate, endDate, range, filters } = args;

	const { data } = await getData(
		'visitor-flow',
		startDate || '',
		endDate || '',
		range || '',
		{
			page_id: id,
			page_url: pageUrl,
			filters
		}
	);

	return ( isValidObject<VisitorFlowData>( data ) ? data : null ) || {
		target: {
			id: id || '0',
			title: 'Page',
			url: pageUrl || '/',
			total_visitors: 0,
			total_pageviews: 0
		},
		entries: [],
		exits: []
	};
}
