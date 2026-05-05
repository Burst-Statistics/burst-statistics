import { getData } from '@/utils/api';

const QUERY_CONFIG = {
	STALE_TIME: 5 * 60 * 1000,
	GC_TIME: 10 * 60 * 1000
};

export { QUERY_CONFIG };

/**
 * Fetch monthly cohort retention data.
 *
 * @param {Object} args Request args.
 * @param {string} args.startDate Start date.
 * @param {string} args.endDate End date.
 * @param {string} args.range Selected date range.
 * @param {string} args.productId Selected product filter.
 * @return {Promise<Object>} Normalized retention response.
 */
export async function fetchRetentionData({ startDate, endDate, range, productId }) {
	const queryArgs = {};

	if ( productId && 'all' !== productId ) {
		queryArgs.product_id = productId;
	}

	const { data } = await getData(
		'subscriptions-retention',
		startDate,
		endDate,
		range,
		queryArgs
	);

	if ( ! data || 'object' !== typeof data ) {
		return {
			rows: [],
			products: [],
			max_offset: 0
		};
	}

	return {
		rows: Array.isArray( data.rows ) ? data.rows : [],
		products: Array.isArray( data.products ) ? data.products : [],
		max_offset: Number.isFinite( Number( data.max_offset ) ) ? Number( data.max_offset ) : 0
	};
}
