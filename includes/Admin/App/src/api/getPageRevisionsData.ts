import { getData } from '@/utils/api';

export interface RevisionMarker {
	id: number;
	postId: number;
	date: string;
	timestamp: number;
	author: string;
	visitorsAfter: number;
	scoreBefore: number;
	scoreAfter: number;
	changePercent: number;
	confidence: 'high' | 'moderate' | 'low';
	description: string;
}

export interface PageRevisionsData {
	timestamps: number[];
	engagementSeries: number[];
	revisions: RevisionMarker[];
}

interface RawRevisionMarker {
	id?: number;
	post_id?: number;
	date?: string;
	timestamp?: number;
	author?: string;
	visitors_after?: number;
	score_before?: number;
	score_after?: number;
	change_percent?: number;
	confidence?: 'high' | 'moderate' | 'low';
	description?: string;
}

interface RawPageRevisionsResponse {
	timestamps?: number[];
	engagement_series?: number[];
	revisions?: RawRevisionMarker[];
}

interface GetPageRevisionsArgs {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
	filters?: Record<string, unknown>;
}

/**
 * Fetch page revision impact data from the Burst REST API.
 * Maps snake_case backend keys to frontend camelCase interface properties.
 *
 * @param {GetPageRevisionsArgs} args - Query arguments including page URL/ID and date range.
 * @return {Promise<PageRevisionsData>} Structured revision impact data.
 */
// fallow-ignore-next-line complexity
export async function getPageRevisionsData(
	args: GetPageRevisionsArgs
): Promise<PageRevisionsData> {
	const { id, pageUrl, startDate, endDate, range, filters } = args;

	const { data } = await getData(
		'page-revisions',
		startDate || '',
		endDate || '',
		range || '',
		{
			page_id: id,
			page_url: pageUrl,
			filters
		}
	);

	const raw = ( data || {}) as RawPageRevisionsResponse;

	const timestamps = Array.isArray( raw.timestamps ) ? raw.timestamps : [];
	const engagementSeries = Array.isArray( raw.engagement_series ) ?
		raw.engagement_series :
		[];
	const rawRevisions = Array.isArray( raw.revisions ) ? raw.revisions : [];

	// fallow-ignore-next-line complexity
	const revisions: RevisionMarker[] = rawRevisions.map( ( rev ) => ({
		id: rev.id ?? 0,
		postId: rev.post_id ?? 0,
		date: rev.date ?? '',
		timestamp: rev.timestamp ?? 0,
		author: rev.author ?? '',
		visitorsAfter: rev.visitors_after ?? 0,
		scoreBefore: rev.score_before ?? 0,
		scoreAfter: rev.score_after ?? 0,
		changePercent: rev.change_percent ?? 0,
		confidence: rev.confidence ?? 'low',
		description: rev.description ?? ''
	}) );

	return {
		timestamps,
		engagementSeries,
		revisions
	};
}

