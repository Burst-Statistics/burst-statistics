import { getData } from '@/utils/api';

const normalizeSourceLabel = ( rawSource ) => {
	let source = rawSource || 'Unknown';
	if ( 'direct' === source ) {
		return 'Direct / unknown';
	}
	if ( 'Direct / unknown' !== source && 'Email client' !== source ) {
		return source.charAt( 0 ).toUpperCase() + source.slice( 1 );
	}
	return source;
};

/**
 * Fetch time-bucketed traffic sources data.
 */
// fallow-ignore-next-line complexity
export const getSourcesOverTimeData = async({ startDate, endDate, range, args }) => {
	const response = await getData( 'sources-over-time', startDate, endDate, range, args );
	const finalData = response?.data || {};

	const timestamps = finalData.timestamps || [];
	const emptyArray = new Array( timestamps.length ).fill( 0 );

	return {
		timestamps,
		search: finalData.search || emptyArray,
		social: finalData.social || emptyArray,
		referral: finalData.referral || emptyArray,
		aiReferral: finalData.aiReferral || emptyArray,
		paid: finalData.paid || emptyArray,
		email: finalData.email || emptyArray,
		direct: finalData.direct || emptyArray
	};
};

/**
 * Fetch flat list of traffic sources from server.
 */
export const getSourcesListData = async({ startDate, endDate, range, args }) => {
	const response = await getData( 'sources-list', startDate, endDate, range, args );
	return response?.data || [];
};

/**
 * Get source breakdown for a category from the pre-fetched sourcesList.
 *
 * @param {Object} args            - Request arguments.
 * @param {Array}  args.sourcesList - The complete sources list from the server.
 * @param {string} args.category   - Selected traffic category.
 * @return {Array} Source rows for drill-down display.
 */
export const getSourcesDrilldownData = ({ sourcesList, category }) => {
	if ( ! Array.isArray( sourcesList ) ) {
		return [];
	}


	const filtered = sourcesList.filter( ( item ) => item.category === category );

	const total = filtered.reduce( ( sum, item ) => sum + parseInt( item.visitors || 0 ), 0 );

	return filtered.map( ( item ) => {
		const source = normalizeSourceLabel( item.source );

		return {
			source,
			visits: parseInt( item.visitors || 0 ),
			percentage: 0 < total ? ( parseInt( item.visitors || 0 ) / total ) * 100 : 0
		};
	}).sort( ( a, b ) => b.visits - a.visits );
};

/**
 * Get top traffic sources across all categories from the pre-fetched sourcesList.
 *
 * @param {Array} sourcesList - The complete sources list from the server.
 * @return {Array} Top source rows.
 */
export const getTopSourcesData = ( sourcesList ) => {
	if ( ! Array.isArray( sourcesList ) ) {
		return [];
	}

	// 1. Group/sum visitors by source name (in case a source appears in multiple categories)
	const sourceMap = {};
	sourcesList.forEach( ( item ) => {
		const source = normalizeSourceLabel( item.source );

		if ( ! sourceMap[ source ]) {
			sourceMap[ source ] = 0;
		}
		sourceMap[ source ] += parseInt( item.visitors || 0 );
	});

	const list = Object.keys( sourceMap ).map( ( source ) => ({
		id: source,
		source,
		visitors: sourceMap[ source ]
	}) );

	// 2. Sum all unique visitors in the list to calculate the true grandTotal
	// This ensures direct (and other unique sources) are divided by the correct denominator
	const grandTotal = list.reduce( ( sum, item ) => sum + item.visitors, 0 );
	if ( 0 === grandTotal ) {
		return [];
	}

	const sorted = list.sort( ( a, b ) => b.visitors - a.visitors );
	const top5 = sorted.slice( 0, 5 );

	return top5.map( ( item ) => ({
		id: item.id,
		source: item.source,
		percentage: ( item.visitors / grandTotal ) * 100
	}) );
};
