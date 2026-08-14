import { getData } from '@/utils/api';
import {
	formatNumber,
	formatTime,
	getAbsoluteChangePercentage,
	getChangePercentage,
	getPercentage
} from '@/utils/formatting';
import { __ } from '@wordpress/i18n';

const metrics = {
	pageviews: __( 'Pageviews', 'burst-statistics' ),
	sessions: __( 'Sessions', 'burst-statistics' ),
	visitors: __( 'Visitors', 'burst-statistics' ),
	bounce_rate: __( 'Bounce Rate', 'burst-statistics' ),
	avg_time_on_page: __( 'Avg. time on page', 'burst-statistics' )
};

const goalMetrics = {
	conversions: __( 'Conversions', 'burst-statistics' ),
	pageviews: __( 'Pageviews', 'burst-statistics' ),
	sessions: __( 'Sessions', 'burst-statistics' ),
	visitors: __( 'Visitors', 'burst-statistics' ),
	avg_time_on_page: __( 'Avg. time on page', 'burst-statistics' )
};

const divide = ( value, total ) => 0 < total ? value / total : 0;

const getPageviewsPerSession = ( data ) =>
	divide( data.pageviews, data.sessions );

const getTimePerSession = ( data ) =>
	getPageviewsPerSession( data ) * data.avg_time_on_page;

const getNewVisitorsPercentage = ( data ) =>
	divide( data.first_time_visitors, data.visitors ) * 100;

const templates = {
	default: {
		pageviews: ( curr ) => ({
			title: __( 'Pageviews', 'burst-statistics' ),
			subtitle: __(
				'%s pageviews per session',
				'burst-statistics'
			).replace( '%s', formatNumber( getPageviewsPerSession( curr ) ) ),
			value: formatNumber( curr.pageviews ),
			exactValue: curr.pageviews,
			communityMetricKey: 'pageviews_per_session',
			communityMetricValue: getPageviewsPerSession( curr )
		}),
		sessions: ( curr ) => ({
			title: __( 'Sessions', 'burst-statistics' ),
			subtitle: __( '%s per session', 'burst-statistics' ).replace(
				'%s',
				formatTime( getTimePerSession( curr ) )
			),
			value: formatNumber( curr.sessions ),
			exactValue: curr.sessions,
			communityMetricKey: 'time_per_session',
			communityMetricValue: getTimePerSession( curr )
		}),
		visitors: ( curr ) => ({
			title: __( 'Visitors', 'burst-statistics' ),
			subtitle: __( '%s are new visitors', 'burst-statistics' ).replace(
				'%s',
				getPercentage( curr.first_time_visitors, curr.visitors )
			),
			value: formatNumber( curr.visitors ),
			exactValue: curr.visitors,
			communityMetricKey: 'new_visitors_percentage',
			communityMetricValue: getNewVisitorsPercentage( curr )
		}),
		bounce_rate: ( curr ) => ({
			title: __( 'Bounce Rate', 'burst-statistics' ),
			subtitle: __( '%s visitors bounced', 'burst-statistics' ).replace(
				'%s',
				curr.bounced_sessions
			),
			value: formatNumber( curr.bounce_rate ) + '%',
			exactValue: curr.bounce_rate,
			communityMetricKey: 'bounce_rate',
			communityMetricValue: curr.bounce_rate
		}),
		avg_time_on_page: ( curr ) => ({
			title: __( 'Avg. time on page', 'burst-statistics' ),
			subtitle: __( 'Across %s pageviews', 'burst-statistics' ).replace(
				'%s',
				formatNumber( curr.pageviews )
			),
			value: formatTime( curr.avg_time_on_page ),
			exactValue: null,
			communityMetricKey: 'average_time_on_page',
			communityMetricValue: curr.avg_time_on_page
		})
	},
	goalSelected: {
		conversions: ( curr ) => ({
			title: __( 'Conversions', 'burst-statistics' ),
			subtitle: __(
				'%s of pageviews converted',
				'burst-statistics'
			).replace( '%s', getPercentage( curr.conversion_rate, 100 ) ),
			value: formatNumber( curr.conversions ),
			exactValue: curr.conversions,
			communityMetricKey: 'conversion_rate',
			communityMetricValue: curr.conversion_rate
		}),
		pageviews: ( curr ) => ({
			title: __( 'Pageviews', 'burst-statistics' ),
			subtitle: __(
				'%s pageviews per conversion',
				'burst-statistics'
			).replace( '%s', formatNumber( curr.pageviews / curr.conversions ) ),
			value: formatNumber( curr.pageviews ),
			exactValue: curr.pageviews
		}),
		sessions: ( curr ) => ({
			title: __( 'Sessions', 'burst-statistics' ),
			subtitle: __(
				'%s sessions per conversion',
				'burst-statistics'
			).replace( '%s', formatNumber( curr.sessions / curr.conversions ) ),
			value: formatNumber( curr.sessions ),
			exactValue: curr.sessions
		}),
		visitors: ( curr ) => ({
			title: __( 'Visitors', 'burst-statistics' ),
			subtitle: __(
				'%s visitors per conversion',
				'burst-statistics'
			).replace( '%s', formatNumber( curr.visitors / curr.conversions ) ),
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

	Object.entries( selectedMetrics ).forEach( ([ key ]) => {
		const templateFunction =
			selectedTemplate[key] || templates.default[key];

		let change = {};
		if ( 'bounce_rate' === key ) {
			change = getAbsoluteChangePercentage( curr[key], prev[key]);

			change.status =
				'positive' === change.status ? 'negative' : 'positive';
		} else {
			change = getChangePercentage( curr[key], prev[key]);
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
 * @param          args.args
 * @return {Promise<*>}
 */
const getCompareData = async({ startDate, endDate, range, args }) => {
	const { data } = await getData( 'compare', startDate, endDate, range, args );
	return transformCompareData( data );
};

export default getCompareData;
