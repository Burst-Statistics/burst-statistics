import type { SearchQueriesData, SearchQueryRow } from '@/api/getSearchQueriesData';
import { formatDate } from '@/utils/formatting';
import { findSearchOpportunity } from './searchQueriesUtils';

export type SearchQueriesStatus = SearchQueriesData['status'];
export type SearchQueriesAccessState = 'overlay' | 'queries' | 'property';

export interface SearchQueriesViewModel {
	rows: SearchQueryRow[];
	dataStatus: SearchQueriesStatus;
	isPending: boolean;
	isFailed: boolean;
	isUnavailable: boolean;
	isInitialPending: boolean;
	readyDays: number;
	totalDays: number;
	pendingDays: number;
	dataUntil: string;
	opportunity: SearchQueryRow | null;
}

/**
 * Normalize the localized Pro flag before selecting a gated view.
 */
export const isBurstPro = (): boolean => {
	const localizedIsPro = window.burst_settings?.is_pro;
	return true === localizedIsPro || '1' === localizedIsPro;
};

/**
 * Select the top-level Search Console gate without mounting data hooks early.
 */
export const getSearchQueriesAccessState = (
	isPro: boolean,
	status: string,
	propertyStatus: string | null
): SearchQueriesAccessState => {
	if ( ! isPro || 'connected' !== status ) {
		return 'overlay';
	}
	if ( 'matched' === propertyStatus || 'paused' === propertyStatus ) {
		return 'queries';
	}
	return 'property';
};

/**
 * Return runtime rows defensively while the response is still unavailable.
 */
const getSearchQueryRows = (
	data: SearchQueriesData | undefined
): SearchQueryRow[] => {
	if ( ! data || ! Array.isArray( data.rows ) ) {
		return [];
	}
	return data.rows;
};

/**
 * Prefer the request error over a stored response status.
 */
const getSearchQueriesStatus = (
	data: SearchQueriesData | undefined,
	isError: boolean
): SearchQueriesStatus => {
	if ( isError ) {
		return 'failed';
	}
	if ( ! data ) {
		return 'ready';
	}
	return data.status;
};

/**
 * Return bounded progress counters from an optional API response.
 */
const getSearchQueriesDays = (
	data: SearchQueriesData | undefined
): { readyDays: number; totalDays: number } => {
	if ( ! data ) {
		return { readyDays: 0, totalDays: 0 };
	}
	return {
		readyDays: data.readyDays ?? 0,
		totalDays: data.totalDays ?? 0
	};
};

/**
 * Format the most recent covered Search Console day when present.
 */
const getSearchQueriesDataUntil = (
	data: SearchQueriesData | undefined
): string => {
	if ( ! data || ! data.dataUntil ) {
		return '';
	}
	return formatDate( data.dataUntil, true );
};

/**
 * Derive the connected block state once for its render-only children.
 */
export const getSearchQueriesViewModel = (
	data: SearchQueriesData | undefined,
	isError: boolean
): SearchQueriesViewModel => {
	const rows = getSearchQueryRows( data );
	const dataStatus = getSearchQueriesStatus( data, isError );
	const { readyDays, totalDays } = getSearchQueriesDays( data );
	const isPending = 'pending' === dataStatus;

	return {
		rows,
		dataStatus,
		isPending,
		isFailed: 'failed' === dataStatus,
		isUnavailable: 'unavailable' === dataStatus,
		isInitialPending: isPending && 0 === readyDays && 0 === rows.length,
		readyDays,
		totalDays,
		pendingDays: Math.max( 0, totalDays - readyDays ),
		dataUntil: getSearchQueriesDataUntil( data ),
		opportunity: findSearchOpportunity( rows, totalDays )
	};
};
