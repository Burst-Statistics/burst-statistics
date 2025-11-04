import { getData } from '../utils/api';

/**
 * Get top performers
 *
 * @param { Object } args - The arguments object.
 * @param { string } args.startDate - The start date for the data range.
 * @param { string } args.endDate - The end date for the data range.
 * @param { string } args.range - The range of data to retrieve.
 * @param { Object } args.filters - Additional filters to apply to the data.
 *
 * @returns {Promise<*>} The formatted number of live visitors.
 */
const getQuickWins = async ( args ) => {
	const { startDate, endDate, range, filters } = args;
	const { data } = await getData( 'ecommerce/quick-wins', startDate, endDate, range, {
		filters
	} );
	return data;
};

export default getQuickWins;