import { getData } from '@/utils/api';

/**
 * Fetch property key/value combinations recorded for an event, with counts,
 * within the date range. Fired only when an expandable row is opened.
 *
 * @param {Object} params           Request parameters.
 * @param {string} params.eventName The event name to fetch property variations for.
 * @param {string} params.startDate Start date for the query.
 * @param {string} params.endDate   End date for the query.
 * @param {string} params.range     Date range identifier.
 * @param {Object} [params.filters] Active dashboard filters to apply.
 *
 * @returns {Promise<{columns: Array, data: Array}>} Datatable-shaped response.
 */
// fallow-ignore-next-line complexity
export const getEventProperties = async({ eventName, startDate, endDate, range, filters }) => {
	if ( ! eventName ) {
		return { columns: [], data: [] };
	}

	const response = await getData( 'event-properties', startDate, endDate, range, {
		name: eventName,
		filters
	});

	const payload = response?.data || {};
	return {
		columns: payload.columns || [],
		data: payload.data || []
	};
};
