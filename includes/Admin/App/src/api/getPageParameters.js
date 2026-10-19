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
 * @param {string} [params.parameter] Parameter key to fetch values for.
 * @param {string} [params.search]    Search query to filter parameter values.
 * @param {string} params.startDate Start date for the query.
 * @param {string} params.endDate   End date for the query.
 * @param {string} params.range     Date range identifier.
 *
 * @returns {Promise<{columns: Array, data: Array, has_more?: boolean, total_values?: number}>} Datatable-shaped response.
 */
/**
 * Extract normalized payload object and row array from an API response.
 *
 * @param {*} response Raw API response.
 * @return {{ payload: Object, rows: Array }} Extracted payload and row array.
 */
// fallow-ignore-next-line complexity
const extractPayloadAndRows = ( response ) => {
	const payload = response?.data || response || {};
	const rows = Array.isArray( payload.data ) ?
		payload.data :
		Array.isArray( payload ) ?
			payload :
			[];
	return { payload, rows };
};

// fallow-ignore-next-line complexity
export const getPageParameters = async({ pageUrl, parameter = '', search = '', startDate, endDate, range }) => {
	if ( ! pageUrl ) {
		return { columns: [], data: [], has_more: false, total_values: 0 };
	}

	const response = await getData( 'page-parameters', startDate, endDate, range, {
		page_url: pageUrl,
		...( parameter ? { parameter } : {}),
		...( search ? { search } : {})
	});

	const { payload, rows } = extractPayloadAndRows( response );
	return {
		columns: payload.columns || [],
		data: rows,
		has_more: payload.has_more ?? false,
		total_values: payload.total_values ?? rows.length
	};
};

/**
 * Fetch the parameter keys breakdown for a single page URL.
 *
 * Aggregates over p.parameter only. Returns per key: parameter, pageviews,
 * visitors, value_count, and high_cardinality.
 *
 * @param {Object} params           Request parameters.
 * @param {string} params.pageUrl   The page URL.
 * @param {string} params.startDate Start date.
 * @param {string} params.endDate   End date.
 * @param {string} params.range     Date range identifier.
 *
 * @returns {Promise<Object>} Response with columns, data, and totals.
 */
// fallow-ignore-next-line complexity
export const getPageParameterKeys = async({ pageUrl, startDate, endDate, range }) => {
	if ( ! pageUrl ) {
		return {
			columns: [],
			data: [],
			total_pageviews: 0,
			total_visitors: 0,
			tagged_pageviews: 0,
			untagged_pageviews: 0,
			untagged_visitors: 0
		};
	}

	const response = await getData( 'page-parameter-keys', startDate, endDate, range, {
		page_url: pageUrl
	});

	const { payload, rows } = extractPayloadAndRows( response );
	return {
		columns: payload.columns || [],
		data: rows,
		total_pageviews: payload.total_pageviews ?? 0,
		total_visitors: payload.total_visitors ?? 0,
		tagged_pageviews: payload.tagged_pageviews ?? 0,
		untagged_pageviews: payload.untagged_pageviews ?? 0,
		untagged_visitors: payload.untagged_visitors ?? 0
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
