
import {getData} from '../utils/api';
import {formatNumber} from '../utils/formatting';

/**
 * Get live visitors
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @returns {Promise<*>}
 */
const getLiveVisitors = async( args ) => {
  const { startDate, endDate, range, filters } = args;
  const { data } = await getData(
    'live-visitors',
    startDate,
    endDate,
    range,
    { filters }
  );
  return formatNumber( data );

};
export default getLiveVisitors;
