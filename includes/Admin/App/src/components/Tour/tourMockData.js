import { __ } from '@wordpress/i18n';
import {
	PAGES,
	SOURCES,
	DEVICES,
	COUNTRIES,
	CAMPAIGNS,
	PRODUCTS,
	SUBSCRIPTION_PLANS,
	READING_ENGAGEMENT,
	TOTAL_VISITORS,
	parseMockFilters,
	combinedShare,
	applyMockFilters,
	scaleRow,
	buildDatatable,
	locationRows,
	datasetFilterOptions
} from './tourMockDataset';

const isTourActive = () => {
	if ( 'undefined' === typeof window ) {
		return false;
	}
	if ( 'function' === typeof window.__burst_is_tour_active ) {
		return window.__burst_is_tour_active();
	}
	return new URLSearchParams( window.location.search ).has( 'tour' );
};

const defaultMockGoals = [
	{
		id: 1,
		title: 'Newsletter Signup',
		status: 'active',
		type: 'clicks',
		page_or_website: 'website',
		selector: '.newsletter-submit',
		conversion_metric: 'visitors',
		date_start: 0,
		date_end: 0,
		value: '18'
	},
	{
		id: 2,
		title: 'Contact Form Submission',
		status: 'active',
		type: 'visits',
		page_or_website: 'page',
		specific_page: '/thank-you',
		conversion_metric: 'visitors',
		date_start: 0,
		date_end: 0,
		value: '10'
	}
];

const dynamicMockGoals = [ ...defaultMockGoals ];

// Integrations goals, titled the way Goals::get_predefined_goals() returns them.
const mockPredefinedGoals = [
	{ id: 'woocommerce_add_to_cart', title: 'WooCommerce - Add to cart', type: 'hook', hook: 'woocommerce_add_to_cart', server_side: true },
	{ id: 'woocommerce_payment_complete', title: 'WooCommerce - Payment complete', type: 'hook', hook: 'woocommerce_payment_complete', server_side: true },
	{ id: 'edd_complete_purchase', title: 'Easy Digital Downloads - Complete purchase', type: 'hook', hook: 'edd_complete_purchase', server_side: true },
	{ id: 'wpcf7_submit', title: 'Contact Form 7 - Submit form', type: 'hook', hook: 'wpcf7_submit', server_side: true },
	{ id: 'wpforms_process_complete', title: 'WPForms - Submit form', type: 'hook', hook: 'wpforms_process_complete', server_side: true }
];

/**
 * Live visitors: page, entry referrer, country and seconds since last activity.
 * 18 rows, matching the live-visitors count on the Today block.
 */
const LIVE_VISITORS = [
	[ '/', 'https://www.google.com/', 'US', 4 ],
	[ '/pricing', '', 'NL', 9 ],
	[ '/features', 'https://t.co/', 'GB', 14 ],
	[ '/', '', 'DE', 21 ],
	[ '/blog/how-to-grow-traffic', 'https://www.google.com/', 'US', 27 ],
	[ '/checkout', '', 'US', 33 ],
	[ '/', 'https://chatgpt.com/', 'CA', 41 ],
	[ '/documentation', 'https://github.com/', 'DE', 48 ],
	[ '/pricing', 'https://www.bing.com/', 'FR', 56 ],
	[ '/', '', 'NL', 64 ],
	[ '/features', 'https://www.linkedin.com/', 'GB', 75 ],
	[ '/contact', '', 'AU', 88 ],
	[ '/', 'https://www.google.com/', 'IN', 102 ],
	[ '/blog/how-to-grow-traffic', 'https://mail.google.com/', 'US', 118 ],
	[ '/pricing', '', 'US', 134 ],
	[ '/about-us', '', 'GB', 151 ],
	[ '/', 'https://www.google.nl/', 'NL', 172 ],
	[ '/documentation', '', 'US', 196 ]
];

// Live rows keep their timestamps between refetches (so the list does not
// re-animate every 5 seconds) and are re-anchored every 5 minutes.
let liveAnchor = 0;
const getLiveTrafficRows = ( now ) => {
	if ( 300 < now - liveAnchor ) {
		liveAnchor = now;
	}
	return LIVE_VISITORS.map( ([ pageUrl, referrer, countryCode, age ], index ) => ({
		uid: String( 4100 + index * 37 ),
		page_url: pageUrl,
		page_id: index + 1,
		utm_source: referrer,
		country_code: countryCode,
		time: liveAnchor - age - 20,
		time_on_page: 20000,
		active_time: liveAnchor - age,
		entry: 0 === index % 3,
		exit: 11 === index,
		checkout: '/checkout' === pageUrl,
		live: true
	}) );
};

// Scale a plain value by a share, never below 0.
const scaled = ( value, share ) => Math.max( 0, Math.round( value * share ) );

// Previous-period series: ~88% of current, with a slightly different shape.
const previousSeries = ( data ) => data.map( ( value, i ) =>
	null === value ? null : Math.max( 0, Math.round( value * ( 0.88 + 0.06 * Math.sin( i * 1.7 + 1 ) ) ) )
);

// fallow-ignore-next-line complexity
export const getFrontendTourMockData = ( path, method = 'GET', body = {}) => {
	if ( ! path || 'string' !== typeof path ) {
		return null;
	}

	if ( ! isTourActive() ) {
		return null;
	}

	// Never mock tour management API endpoints
	if ( path.includes( 'tour/' ) || path.includes( 'do_action/tour_' ) || path.includes( 'get_action/tour_' ) ) {
		return null;
	}

	// With plain permalinks the query string is glued on with '&' instead of '?'.
	const queryStart = path.search( /[?&]/ );
	const cleanPath = ( -1 === queryStart ? path : path.slice( 0, queryStart ) ).replace( /^(\/)?(burst\/v1\/)?/, '' ).replace( /\/$/, '' );
	const query = new URLSearchParams( -1 === queryStart ? '' : path.slice( queryStart + 1 ) );

	// getData() prefixes every path with data/, the ecommerce mocks below are keyed without it.
	const dataPath = cleanPath.replace( /^data\//, '' );
	const range = query.get( 'date_range' ) || query.get( 'range' ) || 'last-7-days';
	const now = Math.floor( Date.now() / 1000 );
	const filters = parseMockFilters( query );
	const share = combinedShare( filters );
	const metricsRequested = query.getAll( 'metrics[]' );
	const groupBy = query.getAll( 'group_by[]' );
	const compareMode = query.get( 'compare_mode' ) || '';

	// Goal mutations: keep the mocked goals list in sync, so the refetch after
	// adding a (predefined) goal still shows it.
	if ( 'POST' === method && 'goals/add_predefined' === cleanPath ) {
		const predefined = mockPredefinedGoals.find( ( goal ) => goal.id === body?.id ) || mockPredefinedGoals[ 0 ];
		const goal = {
			id: 9000 + dynamicMockGoals.length,
			title: predefined.title,
			status: 'active',
			type: predefined.type,
			hook: predefined.hook,
			page_or_website: 'website',
			selector: '',
			conversion_metric: 'visitors',
			date_start: 0,
			date_end: 0,
			value: '0'
		};
		dynamicMockGoals.push( goal );
		return { request_success: true, goal };
	}

	if ( 'POST' === method && 'goals/add' === cleanPath ) {
		const goal = {
			id: 9000 + dynamicMockGoals.length,
			title: __( 'New goal', 'burst-statistics' ),
			status: 'active',
			type: 'clicks',
			page_or_website: 'website',
			selector: '',
			conversion_metric: 'visitors',
			date_start: 0,
			date_end: 0,
			value: '0'
		};
		dynamicMockGoals.push( goal );
		return { request_success: true, goal };
	}

	if ( 'POST' === method && 'goals/delete' === cleanPath ) {
		const index = dynamicMockGoals.findIndex( ( goal ) => String( goal.id ) === String( body?.id ) );
		if ( -1 !== index ) {
			dynamicMockGoals.splice( index, 1 );
		}
		return { request_success: true, deleted: true };
	}

	// Handle Reports Data List during tour
	if ( 'data/reports' === cleanPath || 'reports' === cleanPath ) {
		return {
			request_success: true,
			data: {
				reports: [
					{
						id: 1,
						name: __( 'Weekly Traffic & Top Pages Story', 'burst-statistics' ),
						format: 'story',
						frequency: 'weekly',
						dayOfWeek: 'monday',
						sendTime: '09:00',
						scheduled: true,
						enabled: true,
						recipients: [ 'team@example.com' ],
						content: [
							{ id: 'logo', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' },
							{ id: 'insights', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' },
							{ id: 'pages', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' }
						],
						lastSendDate: new Date( Date.now() - 3 * 86400000 ).toISOString(),
						lastSendStatus: 'success'
					}
				]
			}
		};
	}

	// Handle Report Wizard Save/Update during tour
	if (
		cleanPath.includes( 'report/create' ) ||
		cleanPath.includes( 'report/update' ) ||
		cleanPath.includes( 'report-create' ) ||
		cleanPath.includes( 'report-update' ) ||
		cleanPath.includes( 'report/save' )
	) {
		const mockReport = {
			id: 1,
			name: __( 'Weekly Traffic & Top Pages Story', 'burst-statistics' ),
			format: 'story',
			enabled: true,
			scheduled: true,
			frequency: 'weekly',
			dayOfWeek: 'monday',
			sendTime: '09:00',
			reportDateRange: 'last-7-days',
			content: [
				{ id: 'logo', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' },
				{ id: 'insights', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' },
				{ id: 'pages', fixed_end_date: '', date_range_enabled: false, filters: {}, date_range: '', content: '', comment_title: '', comment_text: '' }
			],
			recipients: [ 'team@example.com' ],
			lastEdit: Math.floor( Date.now() / 1000 )
		};

		return {
			request_success: true,
			data: {
				success: true,
				report: mockReport
			}
		};
	}

	// Filter options for datatables and dashboard filtering during tour
	if ( 'get_action/get_filter_options' === cleanPath || 'get_filter_options' === cleanPath ) {
		const dataType = query.get( 'data_type' ) || 'pages';
		const rawSearch = ( query.get( 'search' ) || '' ).toLowerCase().trim();

		// getAction() serializes a missing search as the string "undefined".
		const search = [ 'undefined', 'null' ].includes( rawSearch ) ? '' : rawSearch;

		const mockFilterOptions = {
			pages: [
				{ ID: '/', name: '/' },
				{ ID: '/pricing', name: '/pricing' },
				{ ID: '/features', name: '/features' },
				{ ID: '/blog/how-to-grow-traffic', name: '/blog/how-to-grow-traffic' },
				{ ID: '/contact', name: '/contact' },
				{ ID: '/documentation', name: '/documentation' },
				{ ID: '/about-us', name: '/about-us' }
			],
			referrers: [
				{ ID: 'google.com', name: 'google.com' },
				{ ID: 'github.com', name: 'github.com' },
				{ ID: 'twitter.com', name: 'twitter.com' },
				{ ID: 'linkedin.com', name: 'linkedin.com' },
				{ ID: 'facebook.com', name: 'facebook.com' },
				{ ID: 'youtube.com', name: 'youtube.com' },
				{ ID: 'bing.com', name: 'bing.com' }
			],
			campaigns: [
				{ ID: 'Summer Sale - variation-a', name: 'Summer Sale - variation-a' },
				{ ID: 'Summer Sale - variation-b (15% Off)', name: 'Summer Sale - variation-b (15% Off)' },
				{ ID: 'Product Launch Email', name: 'Product Launch Email' },
				{ ID: 'Influencer Referral Sprint', name: 'Influencer Referral Sprint' },
				{ ID: 'Black Friday Preview', name: 'Black Friday Preview' }
			],
			devices: [
				{ ID: 'desktop', name: __( 'Desktop', 'burst-statistics' ), key: 'desktop' },
				{ ID: 'mobile', name: __( 'Mobile', 'burst-statistics' ), key: 'mobile' },
				{ ID: 'tablet', name: __( 'Tablet', 'burst-statistics' ), key: 'tablet' }
			],
			browsers: [
				{ ID: 'Chrome', name: 'Chrome' },
				{ ID: 'Safari', name: 'Safari' },
				{ ID: 'Firefox', name: 'Firefox' },
				{ ID: 'Edge', name: 'Edge' }
			],
			platforms: [
				{ ID: 'macOS', name: 'macOS' },
				{ ID: 'Windows', name: 'Windows' },
				{ ID: 'iOS', name: 'iOS' },
				{ ID: 'Android', name: 'Android' },
				{ ID: 'Linux', name: 'Linux' }
			],
			countries: [
				{ ID: 'US', name: 'United States' },
				{ ID: 'GB', name: 'United Kingdom' },
				{ ID: 'DE', name: 'Germany' },
				{ ID: 'NL', name: 'Netherlands' },
				{ ID: 'FR', name: 'France' },
				{ ID: 'CA', name: 'Canada' },
				{ ID: 'AU', name: 'Australia' },
				{ ID: 'IN', name: 'India' }
			],
			states: [
				{ ID: 'California', name: 'California' },
				{ ID: 'New York', name: 'New York' },
				{ ID: 'Texas', name: 'Texas' }
			],
			cities: [
				{ ID: 'San Francisco', name: 'San Francisco' },
				{ ID: 'London', name: 'London' },
				{ ID: 'Amsterdam', name: 'Amsterdam' },
				{ ID: 'Berlin', name: 'Berlin' }
			],
			continents: [
				{ ID: 'NA', name: 'North America' },
				{ ID: 'EU', name: 'Europe' },
				{ ID: 'AS', name: 'Asia' },
				{ ID: 'OC', name: 'Oceania' }
			],
			hosts: [
				{ ID: 'example.com', name: 'example.com' },
				{ ID: 'shop.example.com', name: 'shop.example.com' }
			],
			mediums: [
				{ ID: 'email', name: 'email' },
				{ ID: 'social', name: 'social' },
				{ ID: 'cpc', name: 'cpc' }
			],
			terms: [
				{ ID: 'wordpress analytics', name: 'wordpress analytics' },
				{ ID: 'privacy friendly analytics', name: 'privacy friendly analytics' }
			],
			contents: [
				{ ID: 'hero-button', name: 'hero-button' },
				{ ID: 'footer-link', name: 'footer-link' }
			],
			sources: [
				{ ID: 'google', name: 'google' },
				{ ID: 'direct', name: 'direct' },
				{ ID: 'newsletter', name: 'newsletter' },
				{ ID: 'twitter', name: 'twitter' },
				{ ID: 'linkedin', name: 'linkedin' }
			],
			traffic_sources: [
				{ ID: 'Search Engines', name: 'Search Engines' },
				{ ID: 'Direct', name: 'Direct' },
				{ ID: 'Social Media', name: 'Social Media' },
				{ ID: 'Email', name: 'Email' },
				{ ID: 'Referral', name: 'Referral' }
			],
			source_categories: [
				{ ID: 'search', name: 'search' },
				{ ID: 'direct', name: 'direct' },
				{ ID: 'social', name: 'social' },
				{ ID: 'email', name: 'email' },
				{ ID: 'referral', name: 'referral' }
			]
		};

		let items = datasetFilterOptions()[ dataType ] || mockFilterOptions[ dataType ] || [];
		if ( search ) {
			items = items.filter( ( item ) =>
				item.name.toLowerCase().includes( search ) ||
				( item.ID && String( item.ID ).toLowerCase().includes( search ) )
			);
		}

		return {
			request_success: true,
			data: {
				success: true,
				data: {
					[ dataType ]: items
				},
				[ dataType ]: items
			}
		};
	}

	// 1. Insights Graph (Overview line charts)
	if ( 'data/insights' === cleanPath || 'insights' === cleanPath ) {
		const timestamps = [];
		let interval = 'day';
		let pointCount = 7;

		if ( 'all-time' === range ) {
			interval = 'month';
			pointCount = 12;
			for ( let i = 11; 0 <= i; i-- ) {
				const d = new Date();
				d.setMonth( d.getMonth() - i );
				timestamps.push( Math.floor( d.getTime() / 1000 ) );
			}
		} else if ( 'month-to-date' === range || 'this-month' === range || 'last-30-days' === range ) {
			interval = 'day';
			pointCount = 15;
			for ( let i = 14; 0 <= i; i-- ) {
				timestamps.push( now - i * 86400 );
			}
		} else {
			interval = 'day';
			pointCount = 7;
			for ( let i = 6; 0 <= i; i-- ) {
				timestamps.push( now - i * 86400 );
			}
		}

		// Detect active metrics from query parameters
		let metricsParam = [ 'pageviews', 'visitors' ];
		if ( 0 < query.getAll( 'metrics[]' ).length ) {
			metricsParam = query.getAll( 'metrics[]' );
		} else if ( query.get( 'metrics' ) ) {
			metricsParam = query.get( 'metrics' ).split( ',' );
		}

		const scale = share;

		const metricConfig = {
			pageviews: { label: __( 'Pageviews', 'burst-statistics' ), color: '#2A5B8C', base: 160, var1: 30, var2: 5 },
			visitors: { label: __( 'Visitors', 'burst-statistics' ), color: '#F59E0B', base: 110, var1: 20, var2: 4 },
			sessions: { label: __( 'Sessions', 'burst-statistics' ), color: '#10B981', base: 130, var1: 25, var2: 3 },
			bounces: { label: __( 'Bounces', 'burst-statistics' ), color: '#EF4444', base: 45, var1: 12, var2: 2 },
			conversions: { label: __( 'Conversions', 'burst-statistics' ), color: '#8B5CF6', base: 22, var1: 8, var2: 1 },
			bounce_rate: { label: __( 'Bounce rate', 'burst-statistics' ), color: '#EC4899', base: 34, var1: 5, var2: 1 },
			avg_time_on_page: { label: __( 'Avg. time on page', 'burst-statistics' ), color: '#6366F1', base: 85, var1: 15, var2: 2 }
		};

		const datasets = metricsParam.map( ( key ) => {
			const cfg = metricConfig[ key ] || { label: key, color: '#64748B', base: 75, var1: 15, var2: 2 };
			const data = [];
			for ( let i = 0; i < pointCount; i++ ) {
				if ( 'all-time' === range ) {
					data.push( Math.round( ( cfg.base * 8 + i * cfg.base * 1.5 + Math.sin( i ) * cfg.var1 * 5 ) * scale ) );
				} else {
					data.push( Math.max( 2, Math.round( ( cfg.base + Math.sin( i * 0.8 ) * cfg.var1 + ( ( i * 3 ) % cfg.var2 ) ) * scale ) ) );
				}
			}
			return {
				data,
				backgroundColor: cfg.color,
				borderColor: cfg.color,
				label: cfg.label,
				metric_key: key,
				is_comparison: false,
				fill: 'false'
			};
		});

		// InsightsBlock sends compare_mode only when a single metric is selected.
		if ( compareMode && 1 === datasets.length ) {
			const period = 'year_over_year' === compareMode ? 365 * 86400 : timestamps.length * 86400;
			datasets.push({
				...datasets[ 0 ],
				data: previousSeries( datasets[ 0 ].data ),
				is_comparison: true,
				comparison_timestamps: timestamps.map( ( ts ) => ts - period ),
				compare_mode: compareMode
			});
		}

		return {
			request_success: true,
			data: {
				timestamps,
				interval,
				spans_multiple_years: 'all-time' === range,
				datasets: 0 < datasets.length ? datasets : [
					{
						data: [ 160, 180, 150, 190, 175, 210, 200 ],
						backgroundColor: '#2A5B8C',
						borderColor: '#2A5B8C',
						label: __( 'Pageviews', 'burst-statistics' ),
						metric_key: 'pageviews',
						is_comparison: false,
						fill: 'false'
					}
				]
			}
		};
	}

	// 2. Today Summary Block
	if ( 'data/today' === cleanPath || 'today' === cleanPath ) {
		return {
			request_success: true,
			data: {
				live: { value: '8' },
				today: { value: '142' },
				mostViewed: { title: '/features', value: '46' },
				referrer: { title: 'google.com', value: '39' },
				pageviews: { title: __( 'Total pageviews', 'burst-statistics' ), value: '385' },
				timeOnPage: { title: __( 'Average time on page', 'burst-statistics' ), value: '154000' }
			}
		};
	}

	// 3. Live Visitors
	if ( 'live-visitors' === cleanPath || 'data/live-visitors' === cleanPath ) {
		return {
			request_success: true,
			data: {
				visitors: 18,
				pages: [
					{ page_url: '/', count: 9 },
					{ page_url: '/features', count: 5 },
					{ page_url: '/pricing', count: 4 }
				]
			}
		};
	}

	// 3b. Live traffic list (Overview → Live visitors)
	if ( 'data/live-traffic' === cleanPath || 'live-traffic' === cleanPath ) {
		return {
			request_success: true,
			data: getLiveTrafficRows( now )
		};
	}

	// 4. Goals Definitions (/burst/v1/goals/get)
	if ( 'goals/get' === cleanPath ) {
		return {
			request_success: true,
			goals: dynamicMockGoals,
			predefinedGoals: mockPredefinedGoals,
			goal_limit: -1,
			active_goals_count: dynamicMockGoals.length
		};
	}

	// 5. Goals Analytics Data (/burst/v1/data/goals)
	if ( 'data/goals' === cleanPath || 'goals' === cleanPath ) {
		return {
			request_success: true,
			data: {
				today: { value: 6, tooltip: 'Goals completed today: ', title: 'Today' },
				total: { value: 28, title: 'Total', icon: 'goals' },
				topPerformer: { title: 'Newsletter Signup', value: '18' },
				conversionMetric: { title: __( 'Visitors', 'burst-statistics' ), value: '583', icon: 'visitors' },
				conversionPercentage: { title: __( 'Conversion rate', 'burst-statistics' ), value: '4.8%' },
				bestDevice: { title: __( 'Desktop', 'burst-statistics' ), value: 5.6, icon: 'desktop' },
				status: 'active',
				goalId: 1
			}
		};
	}

	// 6. Live Goals
	if ( 'live-goals' === cleanPath || 'data/live-goals' === cleanPath ) {
		return {
			request_success: true,
			data: { count: 6, goals_count: 6 }
		};
	}

	// 7. Devices
	if ([ 'data/devices', 'devices', 'data/devicesTitleAndValue', 'data/devicesSubtitle' ].includes( cleanPath ) ) {
		const deviceRows = applyMockFilters(
			DEVICES.map( ( device ) => ({ device_id: device.id, count: Math.round( 1000 * device.share ), top_count: Math.round( 650 * device.share ), os: device.os, browser: device.browser }) ),
			filters,
			{ device_id: 'device_id' }
		);
		const data = { other: { count: 0, device_id: 'other', os: '', browser: '', top_count: 0 } };
		DEVICES.forEach( ( device ) => {
			data[ device.id ] = deviceRows.find( ( row ) => row.device_id === device.id ) || { count: 0, device_id: device.id, os: '', browser: '', top_count: 0 };
		});
		data.all = { count: deviceRows.reduce( ( sum, row ) => sum + row.count, 0 ) };
		return { request_success: true, data };
	}

	// 8. Sources Over Time
	if ( 'data/sources-over-time' === cleanPath || 'sources-over-time' === cleanPath ) {
		const timestamps = [];
		for ( let i = 6; 0 <= i; i-- ) {
			timestamps.push( now - i * 86400 );
		}
		return {
			request_success: true,
			data: {
				timestamps,
				search: [ 120, 145, 160, 130, 175, 190, 185 ].map( ( v ) => scaled( v, share ) ),
				direct: [ 80, 95, 88, 102, 110, 115, 120 ].map( ( v ) => scaled( v, share ) ),
				social: [ 45, 60, 52, 70, 65, 80, 75 ].map( ( v ) => scaled( v, share ) ),
				referral: [ 30, 40, 35, 48, 42, 50, 45 ].map( ( v ) => scaled( v, share ) ),
				aiReferral: [ 12, 18, 15, 22, 25, 28, 30 ].map( ( v ) => scaled( v, share ) ),
				paid: [ 5, 10, 8, 12, 15, 10, 8 ].map( ( v ) => scaled( v, share ) ),
				email: [ 15, 20, 18, 25, 22, 28, 24 ].map( ( v ) => scaled( v, share ) )
			}
		};
	}

	// 9. Sources List
	if ( 'data/sources-list' === cleanPath || 'sources-list' === cleanPath ) {
		return {
			request_success: true,
			data: applyMockFilters(
				SOURCES.map( ({ source_category, source, visitors }) => ({ category: source_category, source, visitors }) ),
				filters,
				{ source: 'source', source_category: 'category' }
			)
		};
	}

	// 10. Reading Engagement: top 5 by score, or the lowest 5 when least_engagement is on.
	if (
		'data/reading' === cleanPath ||
		'reading' === cleanPath ||
		'data/reading_engagement' === cleanPath ||
		'reading_engagement' === cleanPath
	) {
		const least = [ 'true', '1' ].includes( query.get( 'least_engagement' ) || '' );
		const rows = applyMockFilters( READING_ENGAGEMENT, filters, { page_url: 'page_url' })
			.map( ( row ) => ({ ...row, score: row.reading_engagement_score }) )
			.sort( ( a, b ) => least ?
				a.reading_engagement_score - b.reading_engagement_score :
				b.reading_engagement_score - a.reading_engagement_score
			)
			.slice( 0, 5 );
		return { request_success: true, data: rows };
	}

	// 11. Search Terms
	if ( 'data/search_terms' === cleanPath || 'search_terms' === cleanPath ) {
		return {
			request_success: true,
			data: [
				{ term: 'analytics dashboard', volume: 142, results: 8 },
				{ term: 'conversion tracking', volume: 98, results: 5 },
				{ term: 'privacy compliance', volume: 74, results: 12 },
				{ term: 'woocommerce reports', volume: 46, results: 3 },
				{ term: 'custom webhook', volume: 19, results: 0 }
			]
		};
	}

	// 12. 404 Pages
	if ( 'data/not_found_pages' === cleanPath || 'not_found_pages' === cleanPath ) {
		return {
			request_success: true,
			data: [
				{ page_url: '/old-pricing-2024', hits: 34 },
				{ page_url: '/docs/v1/setup', hits: 21 },
				{ page_url: '/features/beta', hits: 12 }
			]
		};
	}

	// 12b. 404 referrers (404 Pages → Show referrers). Hits add up to the row's hits.
	if ( 'data/not_found_page_referrers' === cleanPath || 'not_found_page_referrers' === cleanPath ) {
		const pageUrl = query.get( 'page_url' ) || '';
		const referrersByPage = {
			'/old-pricing-2024': [
				{ referrer: 'https://www.google.com/', hits: 14, is_internal: false },
				{ referrer: '/blog/how-to-grow-traffic', hits: 9, is_internal: true },
				{ referrer: 'https://www.reddit.com/r/wordpress/', hits: 5, is_internal: false }
			],
			'/docs/v1/setup': [
				{ referrer: '/documentation', hits: 11, is_internal: true },
				{ referrer: 'https://github.com/', hits: 6, is_internal: false }
			],
			'/features/beta': [
				{ referrer: 'https://t.co/', hits: 5, is_internal: false },
				{ referrer: '/features', hits: 4, is_internal: true }
			]
		};
		const totals = { '/old-pricing-2024': 34, '/docs/v1/setup': 21, '/features/beta': 12 };
		const referrers = ( referrersByPage[ pageUrl ] || referrersByPage[ '/old-pricing-2024' ]).map( ( row ) => ({
			...row,
			url: row.referrer,
			display_url: row.referrer.replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' ) || row.referrer,
			...( row.is_internal ? { edit_url: '' } : {})
		}) );
		const referred = referrers.reduce( ( sum, row ) => sum + row.hits, 0 );
		const totalHits = totals[ pageUrl ] ?? referred + 6;
		return {
			request_success: true,
			data: {
				total_hits: totalHits,
				no_referrer_hits: totalHits - referred,
				counts: {
					all: referrers.length,
					internal: referrers.filter( ( row ) => row.is_internal ).length,
					external: referrers.filter( ( row ) => ! row.is_internal ).length
				},
				referrers
			}
		};
	}

	// 13. Outgoing Links
	if (
		'data/outgoing-links' === cleanPath ||
		'outgoing-links' === cleanPath ||
		'data/datatable/outgoing-links' === cleanPath ||
		cleanPath.includes( 'outgoing' ) ||
		'outgoing_links' === query.get( 'type' ) ||
		'outgoing_links' === query.get( 'config' ) ||
		'outgoing-links' === query.get( 'type' ) ||
		'outgoing-links' === query.get( 'config' )
	) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'url', name: __( 'URL', 'burst-statistics' ), format: 'url', sortable: true, align: 'left' },
					{ id: 'clicks', name: __( 'Clicks', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'previous_clicks', name: __( 'Previous', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' }
				],
				data: [
					{ url: 'https://wordpress.org/plugins/burst-statistics', clicks: 145, previous_clicks: 120, previous_clicks_yoy: 95 },
					{ url: 'https://github.com/burst-statistics', clicks: 89, previous_clicks: 72, previous_clicks_yoy: 50 },
					{ url: 'https://twitter.com/burststats', clicks: 64, previous_clicks: 55, previous_clicks_yoy: 40 },
					{ url: 'https://docs.burst-statistics.com', clicks: 42, previous_clicks: 35, previous_clicks_yoy: 28 }
				],
				total_rows: 4,
				scraping_progress: 100
			}
		};
	}

	// 14. Forms
	if (
		'data/forms' === cleanPath ||
		'forms' === cleanPath ||
		'data/datatable/forms' === cleanPath ||
		cleanPath.includes( 'forms' ) ||
		'forms' === query.get( 'type' ) ||
		'forms' === query.get( 'config' )
	) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'form_title', name: __( 'Form', 'burst-statistics' ), format: 'text', sortable: true, align: 'left' },
					{ id: 'submissions', name: __( 'Submissions', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'pageviews', name: __( 'Pageviews', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'conversion_rate', name: __( 'Conversion rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' }
				],
				data: [
					{
						form_id: '1',
						form_title: 'Contact Form',
						form_provider: 'wpforms',
						form_provider_label: 'WPForms',
						submissions: 42,
						pageviews: 850,
						conversion_rate: 4.9,
						previous_submissions: 35,
						previous_pageviews: 780,
						previous_conversion_rate: 4.5,
						submissions_url: ''
					},
					{
						form_id: '2',
						form_title: 'Newsletter Subscription',
						form_provider: 'cf7',
						form_provider_label: 'Contact Form 7',
						submissions: 78,
						pageviews: 1200,
						conversion_rate: 6.5,
						previous_submissions: 62,
						previous_pageviews: 1050,
						previous_conversion_rate: 5.9,
						submissions_url: ''
					},
					{
						form_id: '3',
						form_title: 'Support Request',
						form_provider: 'gravityforms',
						form_provider_label: 'Gravity Forms',
						submissions: 29,
						pageviews: 410,
						conversion_rate: 7.1,
						previous_submissions: 21,
						previous_pageviews: 340,
						previous_conversion_rate: 6.2,
						submissions_url: ''
					}
				],
				total_rows: 3
			}
		};
	}

	// 15. Ecommerce Sales (same shape as Sales::get_data()).
	if ( 'data/ecommerce/sales' === cleanPath || 'data/sales' === cleanPath ) {
		return {
			request_success: true,
			data: {
				'conversion-rate': {
					label: __( 'Conversion Rate', 'burst-statistics' ),
					current: { conversion_rate: 3.6, visitors: 5050, total_converted: 182 },
					previous: { conversion_rate: 3.1, visitors: 5290, total_converted: 164 },
					rate_change: 16.1
				},
				'abandonment-rate': {
					label: __( 'Abandoned Carts', 'burst-statistics' ),
					current: { abandoned_rate: 22.4, total_abandoned: 53 },
					previous: { abandoned_rate: 25.0, total_abandoned: 55 },
					rate_change: -10.4
				},
				'average-order': {
					label: __( 'Average Order Value', 'burst-statistics' ),
					current: { average_order_value: 78.5, currency: 'USD' },
					previous: { average_order_value: 72.0, currency: 'USD' },
					rate_change: 9.0
				},
				revenue: {
					label: __( 'Revenue', 'burst-statistics' ),
					current: { total_revenue: 14250, total_orders: 182, currency: 'USD' },
					previous: { total_revenue: 11800, total_orders: 164, currency: 'USD' },
					rate_change: 20.8
				}
			}
		};
	}

	// 16. Ecommerce Subscriptions (same shape as Subscriptions::get_data()).
	if ( 'data/ecommerce/subscriptions' === cleanPath || 'data/subscriptions' === cleanPath ) {
		return {
			request_success: true,
			data: {
				monthly_recurring_revenue: {
					label: __( 'Monthly Recurring Revenue', 'burst-statistics' ),
					currency: 'USD',
					current: { mrr: 4850, count: 148 },
					previous: { mrr: 4315, count: 137 },
					rate_change: 12.4
				},
				active_subscriptions: {
					label: __( 'Active Subscriptions', 'burst-statistics' ),
					current: 148,
					previous: { count: 137 },
					rate_change: 8.0
				},
				canceled_subscriptions: {
					label: __( 'Canceled Subscriptions', 'burst-statistics' ),
					current: 3,
					previous: { count: 4 },
					rate_change: -25.0
				},
				revenue_churn: {
					label: __( 'Revenue Churn', 'burst-statistics' ),
					current: { churned_percentage: 1.8, previously_active_count: 140 },
					previous: { churned_percentage: 2.2, previously_active_count: 131 },
					rate_change: -18.2
				},
				average_lifetime_value: {
					label: __( 'Average Lifetime Value', 'burst-statistics' ),
					currency: 'USD',
					current: { value: 340, active_subscription_count: 148 },
					previous: { value: 323, active_subscription_count: 137 },
					rate_change: 5.3
				}
			}
		};
	}

	// 17. Data Tables (DataTableBlock). Like get_datatables_data(), the columns
	// follow the requested metrics[], so every config and column toggle works.
	if (
		cleanPath.startsWith( 'data/datatable' ) ||
		cleanPath.startsWith( 'data-table' ) ||
		cleanPath.startsWith( 'data/ecommerce/datatable' )
	) {
		const tableId = cleanPath.split( '/' ).pop();
		const has = ( needle ) => tableId.includes( needle ) || needle === query.get( 'type' ) || needle === query.get( 'config' );

		if ( has( 'search_console' ) ) {
			return buildDatatable([
				{ query: 'privacy friendly wordpress analytics', clicks: 420, impressions: 4800, click_through_rate: 8.75, ctr: 8.75, position: 2.1 },
				{ query: 'burst statistics setup guide', clicks: 310, impressions: 2900, click_through_rate: 10.69, ctr: 10.69, position: 1.4 },
				{ query: 'cookieless web tracking', clicks: 185, impressions: 3200, click_through_rate: 5.78, ctr: 5.78, position: 3.8 },
				{ query: 'woocommerce conversion tracking plugin', clicks: 142, impressions: 2100, click_through_rate: 6.76, ctr: 6.76, position: 4.2 }
			], metricsRequested );
		}

		if ( has( 'subscription_products' ) ) {
			return buildDatatable( SUBSCRIPTION_PLANS, metricsRequested );
		}

		// Products (Sales): add up to the Sales block totals.
		if ( has( 'products' ) ) {
			return buildDatatable( PRODUCTS, metricsRequested );
		}

		if ( has( 'campaigns' ) ) {
			return buildDatatable(
				applyMockFilters( CAMPAIGNS, filters, { utm_campaign: 'campaign' }),
				metricsRequested
			);
		}

		if ( has( 'countries' ) || groupBy.some( ( key ) => [ 'country_code', 'state', 'city', 'continent' ].includes( key ) ) ) {
			return buildDatatable(
				applyMockFilters( locationRows( groupBy ), filters, { country_code: 'country_code', state: 'state', city: 'city', continent_code: 'continent' }),
				metricsRequested
			);
		}

		// Referrers: Pro groups by source (expandable rows), free by referrer domain.
		if ( has( 'referrers' ) ) {
			const bySource = groupBy.includes( 'source' ) || groupBy.includes( 'source_category' );
			const rows = SOURCES
				.filter( ( source ) => bySource || source.referrer )
				.map( ( source ) => ({ ...source, children: undefined, referrer: source.referrer || __( 'Direct', 'burst-statistics' ), sessions: Math.round( source.visitors * 1.08 ) }) );
			return buildDatatable(
				applyMockFilters( rows, filters, { source: 'source', source_category: 'source_category', referrer: 'referrer' }),
				metricsRequested
			);
		}

		// Pages (default).
		const pageRows = PAGES.map( ( page ) => ({
			...page,
			avg_time: page.avg_time_on_page,
			conversion_rate: Math.round( page.conversions / page.visitors * 1000 ) / 10,
			sales: Math.round( page.conversions * 0.95 ),
			revenue: Math.round( page.conversions * 74 ),
			page_value: Math.round( page.conversions * 74 / page.visitors * 100 ) / 100,
			sales_conversion_rate: Math.round( page.conversions * 0.95 / page.visitors * 1000 ) / 10,
			exits: Math.round( page.visitors * page.exit_rate / 100 )
		}) );
		return buildDatatable(
			applyMockFilters( pageRows, filters, { page_url: 'page_url' }),
			metricsRequested
		);
	}

	// 18. Compare Block
	if ( 'data/compare' === cleanPath || 'compare' === cleanPath ) {
		return {
			request_success: true,
			data: {
				current: scaleRow({
					pageviews: 5420,
					sessions: 4120,
					visitors: TOTAL_VISITORS,
					bounce_rate: 32.4,
					avg_time_on_page: 154000,
					bounced_sessions: 1335,
					first_time_visitors: 2450
				}, share ),
				previous: scaleRow({
					pageviews: 4680,
					sessions: 3580,
					visitors: 3340,
					bounce_rate: 36.8,
					avg_time_on_page: 142000,
					bounced_sessions: 1318,
					first_time_visitors: 2100
				}, share ),
				view: 'default'
			}
		};
	}

	// 19. Geo / World Map Data: countries, or states after clicking a country.
	if ( 'data/geo' === cleanPath || 'geo' === cleanPath ) {
		let view = { level: 'world', id: null };
		try {
			view = { ...view, ...JSON.parse( query.get( 'currentView' ) || '{}' ) };
		} catch {

			// Keep the world view.
		}

		if ( 'country' === view.level ) {
			const country = COUNTRIES.find( ( item ) => item.country_code === view.id );
			const states = country?.states || [];
			return {
				request_success: true,
				data: applyMockFilters(
					states.map( ( state ) => ({
						country_code: country.country_code,
						state_code: state.state_code,
						visitors: state.visitors,
						pageviews: Math.round( state.visitors * country.pageviews / country.visitors ),
						bounce_rate: country.bounce_rate
					}) ),
					filters.filter( ( item ) => 'country_code' !== item.key )
				)
			};
		}

		return {
			request_success: true,
			data: applyMockFilters(
				COUNTRIES.map( ({ country_code, country, visitors, pageviews, bounce_rate }) => ({ country_code, country, visitors, pageviews, bounce_rate }) ),
				filters,
				{ country_code: 'country_code' }
			)
		};
	}

	// 20. Ecommerce Sales Chart & Subscriptions Revenue Chart
	if ( 'ecommerce/subscriptions-revenue-chart' === dataPath ) {
		const rows = [];
		for ( let i = 6; 0 <= i; i-- ) {
			const timestamp = now - i * 86400;
			rows.push({
				timestamp,
				label: new Date( timestamp * 1000 ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' }),
				newValue: 320 + ( ( 6 - i ) * 45 ) % 160,
				renewalValue: 980 + ( 6 - i ) * 55
			});
		}
		return {
			request_success: true,
			data: {
				interval: 'day',
				spans_multiple_years: false,
				mode: 'revenue',
				currency: 'USD',
				rows
			}
		};
	}

	if ( 'ecommerce/sales-chart' === dataPath ) {
		const timestamps = [];
		const salesData = [];
		const revenueData = [];
		for ( let i = 6; 0 <= i; i-- ) {
			timestamps.push( now - i * 86400 );
			salesData.push( 18 + Math.round( Math.sin( i ) * 6 ) + ( i % 4 ) );
			revenueData.push( 1450 + Math.round( Math.sin( i ) * 400 ) + ( ( i * 50 ) % 200 ) );
		}
		const isSalesMode = 'sales' === query.get( 'chart_mode' );
		const current = isSalesMode ? salesData : revenueData;
		const datasets = [
			{
				data: current,
				label: isSalesMode ? __( 'Sales', 'burst-statistics' ) : __( 'Revenue', 'burst-statistics' ),
				metric_key: 'sales_total',
				is_comparison: false
			}
		];
		if ( compareMode ) {
			const period = 'year_over_year' === compareMode ? 365 * 86400 : timestamps.length * 86400;
			datasets.push({
				data: previousSeries( current ),
				label: 'year_over_year' === compareMode ? __( 'Previous year', 'burst-statistics' ) : __( 'Previous period', 'burst-statistics' ),
				metric_key: 'sales_total',
				is_comparison: true,
				comparison_timestamps: timestamps.map( ( ts ) => ts - period ),
				compare_mode: compareMode
			});
		}

		return {
			request_success: true,
			data: {
				timestamps,
				interval: 'day',
				spans_multiple_years: false,
				mode: isSalesMode ? 'sales' : 'revenue',
				currency: 'USD',
				datasets,
				rows: timestamps.map( ( ts, idx ) => ({
					timestamp: ts,
					new_subscriptions: 4 + ( idx % 3 ),
					recurring_subscriptions: 18 + idx * 2,
					new_revenue: 350 + ( ( idx * 50 ) % 150 ),
					recurring_revenue: 1100 + idx * 60
				}) )
			}
		};
	}

	// 21. Forecasts (Sales & Subscriptions)
	if ( 'ecommerce/sales-forecast' === dataPath || 'ecommerce/subscriptions-forecast' === dataPath ) {
		const rows = [];
		for ( let i = 0; 7 > i; i++ ) {
			rows.push({
				timestamp: now + ( i + 1 ) * 86400,
				value: 1550 + i * 45
			});
		}
		return {
			request_success: true,
			data: {
				interval: 'day',
				spans_multiple_years: false,
				mode: 'revenue',
				currency: 'USD',
				rows,
				metadata: {
					growth_rate: 8.4,
					limited_data: false,
					churn_rate: 1.8
				}
			}
		};
	}

	// 22. Ecommerce Top Performers
	if ( 'ecommerce/top-performers' === dataPath ) {
		return {
			request_success: true,
			data: {
				'top-product': {
					label: __( 'Top product', 'burst-statistics' ),
					current: { product_name: 'Pro License (Annual)', total_revenue: 6450, total_quantity_sold: 45 },
					previous: { total_revenue: 5200, total_quantity_sold: 38 },
					revenue_change: 24.0
				},
				'top-device': {
					label: __( 'Top device', 'burst-statistics' ),
					current: { device_name: __( 'Desktop', 'burst-statistics' ), total_revenue: 9800, total_quantity_sold: 120 },
					previous: { total_revenue: 8100, total_quantity_sold: 104 },
					revenue_change: 21.0
				},
				'top-country': {
					label: __( 'Top country', 'burst-statistics' ),
					current: { country_code: 'US', total_revenue: 7200, total_quantity_sold: 84 },
					previous: { total_revenue: 6100, total_quantity_sold: 72 },
					revenue_change: 18.0
				},
				'top-campaign': {
					label: __( 'Top campaign', 'burst-statistics' ),
					current: { campaign_name: 'Summer Sale', total_revenue: 3800, total_quantity_sold: 42 },
					previous: { total_revenue: 2900, total_quantity_sold: 31 },
					revenue_change: 31.0
				}
			}
		};
	}

	// 23. Ecommerce Quick Wins
	if ( 'ecommerce/quick-wins' === dataPath ) {
		return {
			request_success: true,
			data: {
				quickWins: [
					{
						type: 'critical',
						key: 'abandoned-cart-recovery',
						title: __( 'Recover abandoned carts', 'burst-statistics' ),
						message: __( '22% of carts were abandoned this week.', 'burst-statistics' ),
						recommendation: __( 'A recovery email could win back part of that revenue.', 'burst-statistics' ),
						url: null
					},
					{
						type: 'opportunity',
						key: 'mobile-checkout',
						title: __( 'Optimize mobile checkout', 'burst-statistics' ),
						message: __( 'Mobile converts at 1.8% against 4.2% on desktop.', 'burst-statistics' ),
						recommendation: __( 'Fewer checkout fields on mobile can close that gap.', 'burst-statistics' ),
						url: null
					}
				],
				dateRange: { date_start: now - 7 * 86400, date_end: now }
			}
		};
	}

	// 23b. Ecommerce Growth (forecast rows keyed as in GrowthBlock.tsx)
	if ( 'ecommerce/growth' === dataPath ) {
		const year = new Date( now * 1000 ).getFullYear();
		const month = new Date( now * 1000 ).toLocaleDateString( undefined, { month: 'long' });
		return {
			request_success: true,
			data: {
				currency: 'USD',
				rows: {
					'forecast-this-year': { label: __( 'Forecasted revenue this year', 'burst-statistics' ), subtitle: String( year ), value: 168400, rate_change: 18.2, is_forecast: true },
					'forecast-this-month': { label: __( 'Forecasted revenue this month', 'burst-statistics' ), subtitle: month, value: 15200, rate_change: 9.4, is_forecast: true },
					'forecast-next-year': { label: __( 'Forecasted revenue next year', 'burst-statistics' ), subtitle: String( year + 1 ), value: 199100, rate_change: 18.2, is_forecast: true }
				},
				metadata: { growth_rate: 8.4, limited_data: false }
			}
		};
	}

	// 24. Ecommerce Sales Funnel
	if ( 'ecommerce/sales-funnel' === dataPath ) {
		return {
			request_success: true,
			data: [
				{ id: 'view_product', stage: __( 'Product Views', 'burst-statistics' ), label: __( 'Product Views', 'burst-statistics' ), value: 3200, count: 3200, percentage: 100 },
				{ id: 'add_to_cart', stage: __( 'Add to Cart', 'burst-statistics' ), label: __( 'Add to Cart', 'burst-statistics' ), value: 680, count: 680, percentage: 21.25 },
				{ id: 'checkout', stage: __( 'Checkout Initiated', 'burst-statistics' ), label: __( 'Checkout Initiated', 'burst-statistics' ), value: 310, count: 310, percentage: 9.68 },
				{ id: 'purchase', stage: __( 'Completed Purchase', 'burst-statistics' ), label: __( 'Completed Purchase', 'burst-statistics' ), value: 182, count: 182, percentage: 5.68 }
			]
		};
	}

	// 25. Subscriptions Distribution (Gateways, Currencies, Countries)
	if ( 'ecommerce/subscriptions-distribution' === dataPath ) {
		return {
			request_success: true,
			data: [
				{ id: 'stripe', label: 'Stripe', value: 102 },
				{ id: 'paypal', label: 'PayPal', value: 38 },
				{ id: 'mollie', label: 'Mollie', value: 8 }
			]
		};
	}

	// 26. Subscriptions Retention / Cohorts
	if ( 'ecommerce/subscriptions-retention' === dataPath ) {
		return {
			request_success: true,
			data: {
				rows: [
					{ cohort: 'Jan 2026', subscribers: 40, retention: [ 100, 92, 88, 85, 82 ] },
					{ cohort: 'Feb 2026', subscribers: 45, retention: [ 100, 94, 89, 87 ] },
					{ cohort: 'Mar 2026', subscribers: 52, retention: [ 100, 96, 91 ] },
					{ cohort: 'Apr 2026', subscribers: 60, retention: [ 100, 95 ] }
				],
				products: [
					{ id: 'all', name: __( 'All Products', 'burst-statistics' ) },
					{ id: 'pro-annual', name: 'Burst Pro Annual' }
				],
				max_offset: 4
			}
		};
	}

	// 27. Page Parameters & Parameter Counts
	if ( 'data/page-parameter-counts' === cleanPath || 'page-parameter-counts' === cleanPath ) {
		return {
			request_success: true,
			data: {
				'/': 3,
				'/pricing': 2,
				'/features': 1
			}
		};
	}

	if ( 'data/page-parameter-keys' === cleanPath || 'page-parameter-keys' === cleanPath ) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'parameter', name: __( 'Parameter', 'burst-statistics' ), align: 'left' },
					{ id: 'pageviews', name: __( 'Views', 'burst-statistics' ), align: 'right' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), align: 'right' },
					{ id: 'share', name: __( 'Share of page views', 'burst-statistics' ), align: 'right' }
				],
				data: [
					{
						parameter: 'utm_source',
						pageviews: 7841,
						visitors: 5302,
						value_count: 9,
						high_cardinality: false
					},
					{
						parameter: 'utm_campaign',
						pageviews: 6204,
						visitors: 4118,
						value_count: 18,
						high_cardinality: false
					},
					{
						parameter: 'utm_medium',
						pageviews: 2930,
						visitors: 1904,
						value_count: 5,
						high_cardinality: false
					}
				],
				total_pageviews: 20573,
				total_visitors: 13704,
				tagged_pageviews: 12480,
				untagged_pageviews: 8093,
				untagged_visitors: 5611
			}
		};
	}

	if ( 'data/page-parameters' === cleanPath || 'page-parameters' === cleanPath ) {
		const searchParam = ( query.get( 'search' ) || '' ).toLowerCase().trim();
		const allData = [
			{
				value: 'burst-free-3.*',
				pageviews: 4209,
				visitors: 2812,
				group: true,
				member_count: 11,
				min_version: '3.1.4',
				max_version: '3.6.3',
				newest_value: '3.6.3',
				newest_views: 571,
				members: [
					{ value: 'burst-free-3.6.3', pageviews: 571, visitors: 390 },
					{ value: 'burst-free-3.6.2', pageviews: 480, visitors: 320 }
				]
			},
			{ value: 'burstpricing', pageviews: 812, visitors: 601, group: false },
			{ value: 'burst-readme', pageviews: 604, visitors: 448, group: false },
			{ value: 'paac', pageviews: 379, visitors: 291, group: false }
		];

		const filteredData = searchParam ?
			allData.filter( ( item ) => {
				if ( item.value.toLowerCase().includes( searchParam ) ) {
					return true;
				}
				if ( item.members && item.members.some( ( m ) => m.value.toLowerCase().includes( searchParam ) ) ) {
					return true;
				}
				return false;
			}) :
			allData;

		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'value', name: __( 'Value', 'burst-statistics' ), align: 'left' },
					{ id: 'pageviews', name: __( 'Views', 'burst-statistics' ), align: 'right' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), align: 'right' },
					{ id: 'share', name: __( 'Share', 'burst-statistics' ), align: 'right' }
				],
				data: filteredData,
				has_more: false,
				total_values: filteredData.length
			}
		};
	}

	// 28. Source Referrers (expanded row in the Pro referrers table)
	if ( 'data/source-referrers' === cleanPath || 'source-referrers' === cleanPath ) {
		const sourceName = query.get( 'source' ) || '';
		const source = SOURCES.find( ( item ) => item.source === sourceName || item.referrer === sourceName );
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'referrer', name: __( 'Referrer', 'burst-statistics' ), sortable: 'true', right: 'false' },
					{ id: 'pageviews', name: __( 'Pageviews', 'burst-statistics' ), sortable: 'true', right: 'true' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), sortable: 'true', right: 'true' }
				],
				data: ( source?.children || []).map( ( row ) => ({ ...scaleRow( row, share ), source_mapped: source.source }) )
			}
		};
	}

	// 29. Visitor Flow (Per-Page Overlay)
	if ( 'data/visitor-flow' === cleanPath || 'visitor-flow' === cleanPath ) {
		return {
			request_success: true,
			data: {
				target: {
					id: '1',
					title: 'Homepage & Product Features',
					url: '/',
					total_visitors: 1240,
					total_pageviews: 2850
				},
				entries: [
					{ name: 'Google Organic', type: 'search', url: 'https://google.com', count: 520, percentage: 42 },
					{ name: 'Direct Traffic', type: 'direct', count: 310, percentage: 25 },
					{ name: 'Twitter / X', type: 'referrer', url: 'https://t.co', count: 230, percentage: 18 },
					{ name: 'Summer Campaign', type: 'campaign', count: 180, percentage: 15 }
				],
				exits: [
					{ name: '/pricing', type: 'page', url: '/pricing', count: 480, percentage: 39 },
					{ name: '/docs', type: 'page', url: '/docs', count: 310, percentage: 25 },
					{ name: '/contact', type: 'page', url: '/contact', count: 190, percentage: 15 },
					{ name: 'Drop-off / Exit', type: 'exit', count: 260, percentage: 21 }
				]
			}
		};
	}

	// 30. Page Summary (Per-Page Overlay)
	if ( 'data/page-summary' === cleanPath || 'page-summary' === cleanPath ) {
		return {
			request_success: true,
			data: {
				title: 'Homepage & Product Features',
				fallbackPath: '/',
				postType: 'Page',
				status: 'Published',
				author: 'Editorial Team',
				publishedAt: new Date( Date.now() - 30 * 86400000 ).toISOString(),
				editedAt: new Date( Date.now() - 2 * 86400000 ).toISOString(),
				wordCount: 1420,
				readingMinutes: 4
			}
		};
	}

	// 31. Page Revisions (Per-Page Overlay)
	if ( 'data/page-revisions' === cleanPath || 'page-revisions' === cleanPath ) {
		const revTimestamps = [];
		const engagementSeries = [];
		for ( let i = 14; 0 <= i; i-- ) {
			revTimestamps.push( now - i * 86400 );
			engagementSeries.push( 65 + Math.round( Math.sin( i * 0.5 ) * 12 + ( 7 > i ? 15 : 0 ) ) );
		}
		return {
			request_success: true,
			data: {
				timestamps: revTimestamps,
				engagement_series: engagementSeries,
				revisions: [
					{
						id: 101,
						post_id: 1,
						date: new Date( now * 1000 - 7 * 86400000 ).toISOString(),
						timestamp: now - 7 * 86400,
						author: 'Admin',
						visitors_after: 840,
						score_before: 68,
						score_after: 84,
						change_percent: 23.5,
						confidence: 'high',
						description: 'Redesigned hero section & updated CTA copy'
					},
					{
						id: 102,
						post_id: 1,
						date: new Date( now * 1000 - 3 * 86400000 ).toISOString(),
						timestamp: now - 3 * 86400,
						author: 'Editor',
						visitors_after: 420,
						score_before: 84,
						score_after: 87,
						change_percent: 3.6,
						confidence: 'moderate',
						description: 'Added interactive product preview widget'
					}
				]
			}
		};
	}

	// 32. Scroll Analytics (Per-Page Overlay)
	if ( 'data/scroll-analytics' === cleanPath || 'scroll-analytics' === cleanPath ) {
		return {
			request_success: true,
			data: {
				funnel: {
					total_visitors: 1240,
					avg_scroll: 68,
					stages: [
						{ id: '0-25', value: 1240, label: '0-25%', percentage: 100, dropoff: 12, avgDwell: '18s' },
						{ id: '25-50', value: 1090, label: '25-50%', percentage: 88, dropoff: 15, avgDwell: '35s' },
						{ id: '50-75', value: 926, label: '50-75%', percentage: 75, dropoff: 18, avgDwell: '52s' },
						{ id: '75-100', value: 760, label: '75-100%', percentage: 61, dropoff: 0, avgDwell: '42s' }
					]
				},
				dwell_zones: [
					{ zone: 'Hero & Intro', seconds: 24, label: '0-20%', sharePercent: 28, readingStatus: 'High', color: '#2A5B8C' },
					{ zone: 'Key Features Grid', seconds: 38, label: '20-60%', sharePercent: 44, readingStatus: 'Deep reading', color: '#10B981' },
					{ zone: 'Pricing & FAQ', seconds: 25, label: '60-100%', sharePercent: 28, readingStatus: 'Action zone', color: '#F59E0B' }
				],
				scroll_depth: {
					totalPageviews: 2850,
					meaningfulVisits: 1840,
					totalRawVisits: 2850,
					data: [
						{ range: '0-25%', percentage: 100, visitors: 1240, dwellSeconds: 18 },
						{ range: '25-50%', percentage: 88, visitors: 1090, dwellSeconds: 35 },
						{ range: '50-75%', percentage: 75, visitors: 926, dwellSeconds: 52 },
						{ range: '75-100%', percentage: 61, visitors: 760, dwellSeconds: 42 }
					],
					insight: {
						range: '50-75%',
						dwellSeconds: 52
					}
				}
			}
		};
	}

	return null;
};
