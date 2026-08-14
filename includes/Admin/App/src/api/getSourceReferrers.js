import { getData } from '@/utils/api';

/**
 * Fetch raw referrers details for a normalized source.
 *
 * @param {Object} params           Request parameters.
 * @param {string} params.source    The normalized source name.
 * @param {string} params.startDate Start date for the query.
 * @param {string} params.endDate   End date for the query.
 * @param {string} params.range     Date range identifier.
 *
 * @returns {Promise<{columns: Array, data: Array}>} Datatable-shaped response.
 */
// fallow-ignore-next-line complexity -- Cyclomatic score of 6 comes from guard clause + optional chaining fallbacks, not algorithmic branching.
export const getSourceReferrers = async({ source, startDate, endDate, range }) => {
	if ( ! source ) {
		return { columns: [], data: [] };
	}

	const response = await getData( 'source-referrers', startDate, endDate, range, {
		source
	});

	const payload = response?.data || {};
	return {
		columns: payload.columns || [],
		data: payload.data || []
	};
};
