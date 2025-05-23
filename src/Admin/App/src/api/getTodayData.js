import {getData} from '../utils/api';
import {formatNumber, formatTime} from '../utils/formatting';

const transformTodayData = ( response ) => {
  for ( let key in response ) {
    if ( Object.prototype.hasOwnProperty.call( response, key ) ) {
      if ( 'timeOnPage' === key ) {
        response[key].value = formatTime( response[key].value );
      } else {
        response[key].value = formatNumber( response[key].value );
      }
    }
  }
  return response;
};

/**
 * Get live visitors
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @returns {Promise<*>}
 */
const getTodayData = async( args ) => {
  const {startDate, endDate, range, filters} = args;
  const {data} = await getData( 'today', startDate, endDate, range, {
    filters
  });
  return transformTodayData( data );
};
export default getTodayData;
