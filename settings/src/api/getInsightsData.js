
import {getData} from '../utils/api';

/**
 * Get live visitors
 * @param startDate
 * @param endDate
 * @param range
 * @param args
 * @returns {Promise<*>}
 */
const getInsightsData = async({ startDate, endDate, range, args }) => {
  const { data } = await getData(
      'insights',
      startDate,
      endDate,
      range,
      args
  );
  return data;

};
export default getInsightsData;

