import { getData } from '@/utils/api';

/**
 * Fetch the parameter variations for a single page URL.
 *
 * Returns the list of parameter=value combinations recorded for the given page
 * within the date range, with pageview and visitor counts. The request is only
 * fired when an expandable row is opened, so this enables progressive loading
 * of variation data per page.
 *
 * @param {Object} params           Request parameters.
 * @param {string} params.pageUrl   The page URL to fetch parameter variations for.
 * @param {string} params.startDate Start date for the query.
 * @param {string} params.endDate   End date for the query.
 * @param {string} params.range     Date range identifier.
 *
 * @returns {Promise<{columns: Array, data: Array}>} Datatable-shaped response.
 */
export const getPageParameters = async({ pageUrl, startDate, endDate, range }) => {
	if ( ! pageUrl ) {
		return { columns: [], data: [] };
	}

	const response = await getData( 'page-parameters', startDate, endDate, range, {
		page_url: pageUrl
	});

	const payload = response?.data || {};
	return {
		columns: payload.columns || [],
		data: payload.data || []
	};
};

/**
 * Fetch the variation counts for all page URLs in the current date range.
 *
 * Returns a flat map of `{ [pageUrl]: parameterCount }` so the pages datatable
 * can render the "n variations" badge and only mark rows with parameter data
 * as expandable. Fired in parallel with the main pages query when the toggle
 * is enabled, so the main pages query is not slowed down.
 *
 * @param {Object} params           Request parameters.
 * @param {string} params.startDate Start date for the query.
 * @param {string} params.endDate   End date for the query.
 * @param {string} params.range     Date range identifier.
 *
 * @returns {Promise<Object<string, number>>} Map of page_url to parameter count.
 */
export const getPageParameterCounts = async({ startDate, endDate, range }) => {
	const response = await getData( 'page-parameter-counts', startDate, endDate, range, {});

	const payload = response?.data;
	if ( ! payload || 'object' !== typeof payload ) {
		return {};
	}
	return payload;
};

export default getPageParameters;
