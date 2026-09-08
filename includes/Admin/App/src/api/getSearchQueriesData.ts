import { doAction, getData } from '@/utils/api';

export interface SearchQueryRow {
	query: string;
	clicks: number;
	impressions: number;
	position: number;
}

export interface SearchQueriesData {
	status: 'ready' | 'pending' | 'failed' | 'unavailable';
	syncRequired: boolean;
	dataUntil: string;
	readyDays: number;
	totalDays: number;
	totals: {
		clicks: number;
		impressions: number;
		avgPosition: number;
	};
	rows: SearchQueryRow[];
}

interface GetSearchQueriesArgs {
	id?: string;
	pageUrl?: string;
	startDate?: string;
	endDate?: string;
	range?: string;
}

interface NormalizedSearchQueriesArgs {
	id?: string;
	pageUrl?: string;
	startDate: string;
	endDate: string;
	range: string;
}

const emptySearchQueriesData = (): SearchQueriesData => ({
	status: 'ready',
	syncRequired: false,
	dataUntil: '',
	readyDays: 0,
	totalDays: 0,
	totals: {
		clicks: 0,
		impressions: 0,
		avgPosition: 0
	},
	rows: []
});

/**
 * Normalize optional dashboard arguments once before making API requests.
 */
const normalizeSearchQueriesArgs = (
	args: GetSearchQueriesArgs
): NormalizedSearchQueriesArgs => ({
	id: args.id,
	pageUrl: args.pageUrl,
	startDate: args.startDate || '',
	endDate: args.endDate || '',
	range: args.range || ''
});

/**
 * Whether the current dashboard user may start the background sync.
 */
const canManageSearchQueries = (): boolean =>
	Boolean( window.burst_settings?.manage_burst_statistics );

/**
 * Request the first missing Search Console chunk while preserving stored data
 * when the background request fails before returning a usable response.
 */
const syncSearchQueriesData = async(
	args: NormalizedSearchQueriesArgs,
	currentData: SearchQueriesData
): Promise<SearchQueriesData> => {
	try {
		const syncedData = await doAction( 'search-queries-sync', {
			date_start: args.startDate,
			date_end: args.endDate,
			page_id: args.id,
			page_url: args.pageUrl
		}) as SearchQueriesData;

		return syncedData?.status ? syncedData : currentData;
	} catch {
		return {
			...currentData,
			status: 'failed',
			syncRequired: false
		};
	}
};

/**
 * Fetch locally stored Search Console queries for one page.
 */
export async function getSearchQueriesData(
	args: GetSearchQueriesArgs
): Promise<SearchQueriesData> {
	const normalizedArgs = normalizeSearchQueriesArgs( args );
	const { data } = await getData(
		'search-queries',
		normalizedArgs.startDate,
		normalizedArgs.endDate,
		normalizedArgs.range,
		{
			page_id: normalizedArgs.id,
			page_url: normalizedArgs.pageUrl
		}
	);
	const currentData = data || emptySearchQueriesData();
	if ( ! currentData.syncRequired ) {
		return currentData;
	}
	if ( ! canManageSearchQueries() ) {
		return currentData;
	}

	return syncSearchQueriesData( normalizedArgs, currentData );
}
