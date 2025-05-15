import {
  formatNumber,
  formatPercentage,
  getPercentage
} from '../utils/formatting';
import {__} from '@wordpress/i18n';

export const transformTotalGoalsData = ( response ) => {
  response.conversionPercentage.value = getPercentage(
      response.total.value, response.conversionMetric.value );
  response.bestDevice.value = formatPercentage( response.bestDevice.value );
  for ( let key in response ) {
    if ( response.hasOwnProperty( key ) ) {
      if ( 'conversionPercentage' !== key && 'bestDevice' !== key ) {
        if ( 'object' === typeof response[key]) {

          // if .value exists, format it
          if ( response[key].value ) {
            response[key].value = formatNumber( response[key].value );
          }
        }
      }
    }
  }

  // explain how it is calculated
  response.conversionPercentage.tooltip = __( 'Calculated by:',
          'burst-statistics' ) + ' ' +
      __( 'Total amount of goals reached ', 'burst-statistics' ) + ' / ' +
      __( 'Total amount of', 'burst-statistics' ) + ' ' +  response.conversionMetric.title + ' (' +
      response.total.value + ' / ' + response.conversionMetric.value + ')';
  return response;
};


const placeholderData = {
  today: {
    title: __( 'Today', 'burst-statistics' ),
    icon: 'goals'
  },
  total: {
    title: __( 'Total', 'burst-statistics' ),
    value: '-',
    icon: 'goals'
  },
  topPerformer: {
    title: '-',
    value: '-'
  },
  conversionMetric: {
    title: '-',
    value: '-',
    icon: 'visitors'
  },
  conversionPercentage: {
    title: '-',
    value: '-'
  },
  bestDevice: {
    title: '-',
    value: '-',
    icon: 'desktop'
  },
  dateCreated: 0,
  dateStart: 0,
  dateEnd: 0,
  status: 'inactive'
};

import {getData} from '../utils/api';

/**
 * Get live goals
 * @param {Object} args
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {string} args.range
 * @param {Object} args.filters
 * @returns {Promise<*>}
 */
const getGoalsData = async( args ) => {
  const { startDate, endDate, range, filters, goal_id } = args;
  if ( ! goal_id ) {
    return placeholderData;
  }
  const { data } = await getData(
      'goals',
      startDate,
      endDate,
      range,
      { goal_id: goal_id }
  );
  return transformTotalGoalsData( data );

};
export default getGoalsData;
