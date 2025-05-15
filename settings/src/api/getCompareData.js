import { getData } from '../utils/api';
import {
  formatNumber, formatTime,
  getBouncePercentage,
  getChangePercentage, getPercentage
} from '../utils/formatting';
import { __ } from '@wordpress/i18n';

const metrics = {
  'pageviews': __( 'Pageviews', 'burst-statistics' ),
  'sessions': __( 'Sessions', 'burst-statistics' ),
  'visitors': __( 'Visitors', 'burst-statistics' ),
  'bounced_sessions': __( 'Bounce Rate', 'burst-statistics' )
};

const goalMetrics = {
  'conversions': __( 'Conversions', 'burst-statistics' ),
  'pageviews': __( 'Pageviews', 'burst-statistics' ),
  'sessions': __( 'Sessions', 'burst-statistics' ),
  'visitors': __( 'Visitors', 'burst-statistics' )
};

const templates = {
  default: {
    pageviews: ( curr, prev ) => ({
      title: __( 'Pageviews', 'burst-statistics' ),
      subtitle: __( '%s pageviews per session', 'burst-statistics' ).replace( '%s', formatNumber( curr.pageviews / curr.sessions ) ),
      value: formatNumber( curr.pageviews ),
      exactValue: curr.pageviews
    }),
    sessions: ( curr, prev ) => ({
      title: __( 'Sessions', 'burst-statistics' ),
      subtitle: __( '%s per session', 'burst-statistics' ).replace( '%s', formatTime( curr.pageviews / curr.sessions * curr.avg_time_on_page ) ),
      value: formatNumber( curr.sessions ),
      exactValue: curr.sessions
    }),
    visitors: ( curr, prev ) => ({
      title: __( 'Visitors', 'burst-statistics' ),
      subtitle: __( '%s are new visitors', 'burst-statistics' ).replace( '%s', getPercentage( curr.first_time_visitors, curr.visitors ) ),
      value: formatNumber( curr.visitors ),
      exactValue: curr.visitors
    }),
    bounced_sessions: ( curr, prev ) => ({
      title: __( 'Bounce Rate', 'burst-statistics' ),
      subtitle: __( '%s visitors bounced', 'burst-statistics' ).replace( '%s', curr.bounced_sessions ),
      value: getBouncePercentage( curr.bounced_sessions, curr.sessions )
    })
  },
  goalSelected: {
    conversions: ( curr, prev ) => ({
      title: __( 'Conversions', 'burst-statistics' ),
      subtitle: __( '%s of pageviews converted', 'burst-statistics' ).replace( '%s', getPercentage( curr.conversion_rate, 100 ) ),
      value: formatNumber( curr.conversions ),
      exactValue: curr.conversions
    }),
    pageviews: ( curr, prev ) => ({
      title: __( 'Pageviews', 'burst-statistics' ),
      subtitle: __( '%s pageviews per conversion', 'burst-statistics' ).replace( '%s', formatNumber( curr.pageviews / curr.conversions ) ),
      value: formatNumber( curr.pageviews ),
      exactValue: curr.pageviews
    }),
    sessions: ( curr, prev ) => ({
      title: __( 'Sessions', 'burst-statistics' ),
      subtitle: __( '%s sessions per conversion', 'burst-statistics' ).replace( '%s', formatNumber( curr.sessions / curr.conversions ) ),
      value: formatNumber( curr.sessions ),
      exactValue: curr.sessions
    }),
    visitors: ( curr, prev ) => ({
      title: __( 'Visitors', 'burst-statistics' ),
      subtitle: __( '%s visitors per conversion', 'burst-statistics' ).replace( '%s', formatNumber( curr.visitors / curr.conversions ) ),
      value: formatNumber( curr.visitors ),
      exactValue: curr.visitors
    })
  }
};

const transformCompareData = ( response ) => {
  const data = {};
  const curr = response.current;
  const prev = response.previous;

  let templateType = 'default';
  let selectedMetrics = metrics;

  if ( 'goals' === response.view ) {
    templateType = 'goalSelected';
    selectedMetrics = goalMetrics;
  }
  const selectedTemplate = templates[templateType];

  Object.entries( selectedMetrics ).forEach( ([ key, value ]) => {
    const templateFunction = selectedTemplate[key] || templates.default[key];

    let change = getChangePercentage( curr[key], prev[key]);

    if ( 'bounced_sessions' === key ) {
      const bouncePercentage = getBouncePercentage( curr[key], curr.sessions, false );
      const bouncePercentagePrev = getBouncePercentage( prev[key], prev.sessions, false );
      change = getChangePercentage( bouncePercentage, bouncePercentagePrev );
      change.status = 'positive' === change.status ? 'negative' : 'positive';
    }
    data[key] = {
      ...templateFunction( curr, prev ),
      change: change.val,
      changeStatus: change.status
    };
  });
  return data;
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
const getCompareData = async({ startDate, endDate, range, args }) => {
  const { data } = await getData(
      'compare',
      startDate,
      endDate,
      range,
      args
  );
  return transformCompareData( data );
};

export default getCompareData;
