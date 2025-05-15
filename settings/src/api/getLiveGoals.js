import {getData} from '../utils/api';
import {formatNumber} from '../utils/formatting';

/**
 * Get live goals
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @returns {Promise<*>}
 */
const getLiveGoals = async( args ) => {
  const { startDate, endDate, range, filters, goal_id } = args;
  if ( ! goal_id ) {
    return '-';
  }
  const { data } = await getData(
      'live-goals',
      startDate,
      endDate,
      range,
      { goal_id: goal_id }
  );
  return formatNumber( data );

};
export default getLiveGoals;
