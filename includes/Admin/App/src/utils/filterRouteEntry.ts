import {
	FILTER_KEYS,
	TRAILING_PARAM_KEY,
	normalizeFilterValue,
	resolveEntryFilters
} from '@/config/filterConfig';
import { getPinnedFilters } from '@/hooks/useFilters';
import { getStoredDateParams, hasUrlDateRange } from '@/hooks/useDateRange';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useTourStore } from '@/store/useTourStore';
import type { HistoryState } from '@tanstack/react-router';

declare module '@tanstack/history' {
	interface HistoryState {

		// Filter keys whose URL value beats a pinned value when the filter pages open.
		overridePinned?: string[];
	}
}

type Search = Record<string, unknown>;

/**
 * Picks the filter values out of a search object.
 *
 * @param search - The parsed search of a location.
 *
 * @return The non-empty filter values, as strings.
 */
const pickFilters = ( search: Search ): Record<string, string> => {
	const filters: Record<string, string> = {};
	FILTER_KEYS.forEach( ( key ) => {
		const value = normalizeFilterValue( search[key]);
		if ( '' !== value ) {
			filters[key] = value;
		}
	});
	return filters;
};

/**
 * Checks whether two sets of filters hold the same values.
 *
 * @param a - The first filters.
 * @param b - The second filters.
 *
 * @return True when both have the same keys and values.
 */
const isSameFilters = ( a: Record<string, string>, b: Record<string, string> ): boolean => {
	const keys = Object.keys( a );
	return keys.length === Object.keys( b ).length && keys.every( ( key ) => a[key] === b[key]);
};

/**
 * Gets the filters to show when the filter pages are opened.
 *
 * @param urlFilters - Filters in the URL being opened.
 * @param state      - History state of the navigation.
 *
 * @return The filters to put in the URL.
 */
const getOpeningFilters = ( urlFilters: Record<string, string>, state: HistoryState ): Record<string, string> => {

	// The tour runs on clean, default filters.
	if ( useTourStore.getState().tourActive ) {
		return urlFilters;
	}

	return resolveEntryFilters( urlFilters, useFiltersStore.getState().getSavedFilters(), getPinnedFilters(), state.overridePinned );
};

/**
 * Gets the stored date range when the URL has none.
 *
 * Only a stored range that is itself complete is returned, so a redirect can
 * never land on a URL that asks for the date again.
 *
 * @param search - The parsed search of the page being opened.
 *
 * @return The date range params to add, or null when none are needed.
 */
const getMissingDateParams = ( search: Search ): Search | null => {
	const dateParams = getStoredDateParams();
	return ! hasUrlDateRange( search ) && hasUrlDateRange( dateParams ) ? { ...dateParams } : null;
};

/**
 * Builds the search with the given filters and date range in place.
 *
 * @param search     - The parsed search of the page being opened.
 * @param filters    - The filters to show.
 * @param dateParams - Date range params to add, or null.
 *
 * @return The complete search, with the trailing param last.
 */
const buildSearch = ( search: Search, filters: Record<string, string>, dateParams: Search | null ): Search => {
	const otherParams: Search = {};
	Object.keys( search ).forEach( ( key ) => {
		if ( TRAILING_PARAM_KEY !== key && ! ( FILTER_KEYS as readonly string[]).includes( key ) ) {
			otherParams[key] = search[key];
		}
	});

	return { ...filters, ...otherParams, ...dateParams, [TRAILING_PARAM_KEY]: '' };
};

/**
 * Gets the search a filter or date range page should show. This is the one
 * place where the remembered filters and date range are written into the URL,
 * so components only ever read them from there.
 *
 * Filters are filled in once, when the filter pages are opened (first load, or
 * coming from a page without filters): moving between filter pages or removing
 * a filter leaves them alone. The date range is filled in whenever the URL has
 * none.
 *
 * @param search    - The parsed search of the page being opened.
 * @param isOpening - Whether the filter pages are being opened, or null on a page without filters.
 * @param state     - History state of the navigation.
 *
 * @return The search to redirect to, or null when the URL is already complete.
 */
export const getFilterRouteSearch = ( search: Search, isOpening: boolean | null, state: HistoryState ): Search | null => {
	const urlFilters = pickFilters( search );
	const filters = isOpening ? getOpeningFilters( urlFilters, state ) : urlFilters;
	const dateParams = getMissingDateParams( search );

	if ( ! dateParams && isSameFilters( filters, urlFilters ) ) {
		return null;
	}

	return buildSearch( search, filters, dateParams );
};
