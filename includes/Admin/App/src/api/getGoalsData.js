import {
  formatNumber,
  formatPercentage,
  getPercentage
} from '@/utils/formatting';
import { __ } from '@wordpress/i18n';

const transformTotalGoalsData = ( response ) => {

  // Return early with placeholder data if response is invalid
  if ( ! response || 'object' !== typeof response ) {
    return placeholderData;
  }

  // Ensure all required objects and properties exist
  const safeResponse = {
    ...placeholderData,
    ...response,

    // Ensure all required nested objects exist with default values
    conversionPercentage: {
      title: response?.conversionPercentage?.title || '-',
      value: response?.conversionPercentage?.value || '-',
      ...( response?.conversionPercentage || {})
    },
    conversionMetric: {
      title: response?.conversionMetric?.title || '-',
      value: response?.conversionMetric?.value || '-',
      icon: response?.conversionMetric?.icon || 'visitors',
      ...( response?.conversionMetric || {})
    },
    total: {
      title: response?.total?.title || __( 'Total', 'burst-statistics' ),
      value: response?.total?.value || '-',
      icon: response?.total?.icon || 'goals',
      ...( response?.total || {})
    },
    bestDevice: {
      title: response?.bestDevice?.title || '-',
      value: response?.bestDevice?.value || '-',
      icon: response?.bestDevice?.icon || 'desktop',
      ...( response?.bestDevice || {})
    }
  };

  // Only try to calculate percentages if we have valid values
  if ( safeResponse.total.value &&
      '-' !== safeResponse.total.value &&
      safeResponse.conversionMetric.value &&
      '-' !== safeResponse.conversionMetric.value ) {
    safeResponse.conversionPercentage.value = getPercentage(
      safeResponse.total.value,
      safeResponse.conversionMetric.value
    );
  }

  // Only format bestDevice percentage if it's a valid value
  if ( safeResponse.bestDevice.value && '-' !== safeResponse.bestDevice.value ) {
    safeResponse.bestDevice.value = formatPercentage( safeResponse.bestDevice.value );
  }

  // Format number values for each property
  for ( let key in safeResponse ) {
    if ( Object.prototype.hasOwnProperty.call( safeResponse, key ) ) {
      if ( 'conversionPercentage' !== key && 'bestDevice' !== key ) {
        if ( 'object' === typeof safeResponse[key] && null !== safeResponse[key]) {

          // Only format if value exists and is not a placeholder
          if ( safeResponse[key].value &&
              '-' !== safeResponse[key].value &&
              ! isNaN( Number( safeResponse[key].value ) ) ) {
            safeResponse[key].value = formatNumber( safeResponse[key].value );
          }
        }
      }
    }
  }

  // Add tooltip only if we have valid values
  if ( safeResponse.total.value &&
      safeResponse.conversionMetric.value &&
      safeResponse.conversionMetric.title ) {
    safeResponse.conversionPercentage.tooltip =
      __( 'Calculated by:', 'burst-statistics' ) +
      ' ' +
      __( 'Total amount of goals reached ', 'burst-statistics' ) +
      ' / ' +
      __( 'Total amount of', 'burst-statistics' ) +
      ' ' +
      safeResponse.conversionMetric.title +
      ' (' +
      safeResponse.total.value +
      ' / ' +
      safeResponse.conversionMetric.value +
      ')';
  } else {
    safeResponse.conversionPercentage.tooltip =
      __( 'No data available yet', 'burst-statistics' );
  }

  return safeResponse;
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

import { getData } from '@/utils/api';

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
  try {
    const { data } = await getData( 'goals', startDate, endDate, range, {
      goal_id: goal_id
    });
    return transformTotalGoalsData( data );
  } catch ( error ) {
    console.error( 'Error fetching goals data:', error );
    return placeholderData;
  }
};
export default getGoalsData;
