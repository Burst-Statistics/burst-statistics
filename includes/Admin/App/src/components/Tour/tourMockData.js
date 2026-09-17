import { __ } from '@wordpress/i18n';

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
		selector: '/thank-you',
		conversion_metric: 'visitors',
		date_start: 0,
		date_end: 0,
		value: '10'
	}
];

const mockGoalFields = [
	{
		id: 'title',
		type: 'hidden',
		default: false
	},
	{
		id: 'status',
		type: 'hidden',
		default: false
	},
	{
		id: 'type',
		type: 'radio-buttons',
		label: __( 'What type of goal do you want to set?', 'burst-statistics' ),
		options: {
			clicks: {
				label: __( 'Clicks', 'burst-statistics' ),
				description: __( 'Track clicks on element', 'burst-statistics' ),
				type: 'clicks',
				icon: 'mouse'
			},
			views: {
				label: __( 'Views', 'burst-statistics' ),
				description: __( 'Track views of element', 'burst-statistics' ),
				type: 'views',
				icon: 'eye'
			},
			visits: {
				label: __( 'Visits', 'burst-statistics' ),
				description: __( 'Track visits to page', 'burst-statistics' ),
				type: 'visits',
				icon: 'visitors'
			},
			hook: {
				label: __( 'Hook', 'burst-statistics' ),
				description: __( 'Track execution of a WordPress hook', 'burst-statistics' ),
				type: 'hook',
				icon: 'hook',
				server_side: true
			}
		},
		disabled: false,
		default: 'clicks'
	},
	{
		id: 'page_or_website',
		type: 'radio-buttons',
		label: __( 'Do you want to track a specific page or the entire website?', 'burst-statistics' ),
		options: {
			page: {
				label: __( 'Page', 'burst-statistics' ),
				description: __( 'Track page specific', 'burst-statistics' ),
				type: 'page',
				icon: 'page'
			},
			website: {
				label: __( 'Website', 'burst-statistics' ),
				description: __( 'Track on whole site', 'burst-statistics' ),
				type: 'website',
				icon: 'website'
			}
		},
		disabled: false,
		default: 'website',
		react_conditions: {
			type: [ 'clicks', 'views', 'hook' ]
		}
	},
	{
		id: 'selector',
		type: 'selector',
		label: __( 'What element do you want to track?', 'burst-statistics' ),
		disabled: false,
		default: '.checkout-btn, #buy-now',
		react_conditions: {
			type: [ 'clicks', 'views' ]
		}
	},
	{
		id: 'hook',
		type: 'hook',
		label: __( 'What hook do you want to track?', 'burst-statistics' ),
		disabled: false,
		default: '',
		react_conditions: {
			type: [ 'hook' ]
		}
	},
	{
		id: 'conversion_metric',
		type: 'radio-buttons',
		label: __( 'What metric do you want to use to calculate the conversion rate?', 'burst-statistics' ),
		options: {
			visitors: {
				label: __( 'Visitors', 'burst-statistics' ),
				type: 'visitors',
				icon: 'visitors'
			},
			sessions: {
				label: __( 'Sessions', 'burst-statistics' ),
				type: 'sessions',
				icon: 'sessions'
			},
			pageviews: {
				label: __( 'Pageviews', 'burst-statistics' ),
				type: 'pageviews',
				icon: 'pageviews'
			}
		},
		disabled: false,
		default: 'visitors'
	}
];

const dynamicMockGoals = [ ...defaultMockGoals ];

// fallow-ignore-next-line complexity
export const getFrontendTourMockData = ( path ) => {
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

	const cleanPath = path.split( '?' )[0].replace( /^(\/)?(burst\/v1\/)?/, '' ).replace( /\/$/, '' );
	const query = new URLSearchParams( path.includes( '?' ) ? path.split( '?' )[1] : '' );
	const range = query.get( 'date_range' ) || query.get( 'range' ) || 'last-7-days';
	const filter = query.get( 'filter' ) || '';
	const now = Math.floor( Date.now() / 1000 );

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
		const search = ( query.get( 'search' ) || '' ).toLowerCase().trim();

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

		let items = mockFilterOptions[ dataType ] || [];
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

		// Detect active filters (e.g. device=desktop, or page URL)
		const hasDesktop = query.get( 'filters[device]' )?.includes( 'desktop' ) ||
			query.get( 'filter' )?.includes( 'desktop' ) ||
			( 'undefined' !== typeof window && window.location.hash.includes( 'desktop' ) );
		const hasPage = query.get( 'filters[page_url]' ) || ( filter && 'all' !== filter );
		const scale = hasPage ? 0.32 : ( hasDesktop ? 0.65 : 1.0 );

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
				timeOnPage: { title: __( 'Average time on page', 'burst-statistics' ), value: '154' }
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

	// 4. Goals Definitions (/burst/v1/goals/get)
	if ( 'goals/get' === cleanPath ) {
		return {
			request_success: true,
			goals: dynamicMockGoals,
			predefinedGoals: [],
			goalFields: mockGoalFields,
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
				conversionMetric: { title: 'Total conversions', value: '28', icon: 'goals' },
				conversionPercentage: { title: 'Conversion rate', value: '4.8%' },
				goalId: 1
			}
		};
	}

	// 6. Live Goals
	if ( 'live-goals' === cleanPath || 'data/live-goals' === cleanPath ) {
		return {
			request_success: true,
			data: { count: 2 }
		};
	}

	// 7. Devices
	if ( 'data/devices' === cleanPath || 'devices' === cleanPath ) {
		return {
			request_success: true,
			data: {
				desktop: { count: 650, device_id: 'desktop', os: 'macOS', browser: 'Chrome', top_count: 420 },
				mobile: { count: 310, device_id: 'mobile', os: 'iOS', browser: 'Safari', top_count: 210 },
				tablet: { count: 40, device_id: 'tablet', os: 'iPadOS', browser: 'Safari', top_count: 30 },
				other: { count: 0, device_id: 'other', os: '', browser: '', top_count: 0 },
				all: { count: 1000 }
			}
		};
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
				search: [ 120, 145, 160, 130, 175, 190, 185 ],
				direct: [ 80, 95, 88, 102, 110, 115, 120 ],
				social: [ 45, 60, 52, 70, 65, 80, 75 ],
				referral: [ 30, 40, 35, 48, 42, 50, 45 ],
				aiReferral: [ 12, 18, 15, 22, 25, 28, 30 ],
				paid: [ 5, 10, 8, 12, 15, 10, 8 ],
				email: [ 15, 20, 18, 25, 22, 28, 24 ]
			}
		};
	}

	// 9. Sources List
	if ( 'data/sources-list' === cleanPath || 'sources-list' === cleanPath ) {
		return {
			request_success: true,
			data: [
				{ category: 'search', source: 'Google', visitors: 1840 },
				{ category: 'search', source: 'Bing', visitors: 340 },
				{ category: 'direct', source: 'direct', visitors: 1210 },
				{ category: 'social', source: 'Twitter / X', visitors: 420 },
				{ category: 'social', source: 'LinkedIn', visitors: 220 },
				{ category: 'referral', source: 'GitHub', visitors: 310 },
				{ category: 'aiReferral', source: 'ChatGPT', visitors: 185 }
			]
		};
	}

	// 10. Reading Engagement
	if (
		'data/reading' === cleanPath ||
		'reading' === cleanPath ||
		'data/reading_engagement' === cleanPath ||
		'reading_engagement' === cleanPath
	) {
		return {
			request_success: true,
			data: [
				{ page_url: '/', title: 'Home', bounce_rate: 28.5, avg_time_on_page: 165, word_count: 450, reading_engagement_score: 88, score: 88 },
				{ page_url: '/pricing', title: 'Pricing Plans', bounce_rate: 32.1, avg_time_on_page: 192, word_count: 600, reading_engagement_score: 84, score: 84 },
				{ page_url: '/features', title: 'Product Features', bounce_rate: 35.8, avg_time_on_page: 118, word_count: 520, reading_engagement_score: 79, score: 79 },
				{ page_url: '/blog/getting-started', title: 'Getting Started with Burst', bounce_rate: 41.0, avg_time_on_page: 270, word_count: 1200, reading_engagement_score: 92, score: 92 }
			]
		};
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

	// 14b. Internal Links
	if (
		'data/internal-links' === cleanPath ||
		'internal-links' === cleanPath ||
		'data/datatable/internal-links' === cleanPath ||
		cleanPath.includes( 'internal-links' ) ||
		cleanPath.includes( 'internal_links' ) ||
		'internal_links' === query.get( 'type' ) ||
		'internal_links' === query.get( 'config' ) ||
		'internal-links' === query.get( 'type' ) ||
		'internal-links' === query.get( 'config' )
	) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'url', name: __( 'Page URL', 'burst-statistics' ), format: 'url', sortable: true, align: 'left' },
					{ id: 'clicks', name: __( 'Clicks', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'previous_clicks', name: __( 'Previous', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' }
				],
				data: [
					{ url: '/pricing', clicks: 940, previous_clicks: 780 },
					{ url: '/features', clicks: 710, previous_clicks: 620 },
					{ url: '/blog/getting-started-with-analytics', clicks: 520, previous_clicks: 430 },
					{ url: '/documentation', clicks: 380, previous_clicks: 310 },
					{ url: '/contact', clicks: 195, previous_clicks: 160 }
				],
				total_rows: 5
			}
		};
	}

	// 15. Ecommerce Sales
	if ( 'data/ecommerce/sales' === cleanPath || 'data/sales' === cleanPath ) {
		return {
			request_success: true,
			data: {
				current: { conversion_rate: 3.6, abandoned_rate: 22.4, average_order_value: 78.5, total_revenue: 14250, total_orders: 182 },
				previous: { conversion_rate: 3.1, abandoned_rate: 25.0, average_order_value: 72.0, total_revenue: 11800, total_orders: 164 }
			}
		};
	}

	// 16. Ecommerce Subscriptions
	if ( 'data/ecommerce/subscriptions' === cleanPath || 'data/subscriptions' === cleanPath ) {
		return {
			request_success: true,
			data: {
				monthly_recurring_revenue: { value: 4850, change: 12.4, change_status: 'positive' },
				active_subscriptions: { value: 148, change: 8.1, change_status: 'positive' },
				average_lifetime_value: { value: 340, change: 5.2, change_status: 'positive' },
				revenue_churn: { value: 1.8, change: -0.4, change_status: 'positive' },
				canceled_subscriptions: { value: 3, change: -1, change_status: 'positive' }
			}
		};
	}

	// 17. Data Table
	if (
		cleanPath.startsWith( 'data/datatable' ) ||
		cleanPath.startsWith( 'data-table' ) ||
		cleanPath.startsWith( 'data/ecommerce/datatable' ) ||
		'data-table' === cleanPath ||
		'data/datatable' === cleanPath
	) {
		const isFiltered = Boolean( filter && 'all' !== filter );

		// Campaigns with A/B testing variations
		if ( cleanPath.includes( 'campaigns' ) || 'campaigns' === query.get( 'type' ) || 'campaigns' === query.get( 'config' ) ) {
			return {
				request_success: true,
				data: {
					columns: [
						{ id: 'campaign', name: __( 'Campaign', 'burst-statistics' ), format: 'text', sortable: true, align: 'left' },
						{ id: 'pageviews', name: __( 'Pageviews', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'conversions', name: __( 'Conversions', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'conversion_rate', name: __( 'Conversion rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' }
					],
					data: [
						{
							campaign: 'Summer Sale - variation-a',
							pageviews: 2450,
							visitors: 1680,
							conversions: 81,
							conversion_rate: 4.8,
							is_ab_test: true,
							winner: false,
							significant: 'significant'
						},
						{
							campaign: 'Summer Sale - variation-b (15% Off)',
							pageviews: 2510,
							visitors: 1720,
							conversions: 162,
							conversion_rate: 9.4,
							is_ab_test: true,
							winner: true,
							significant: 'significant'
						},
						{
							campaign: 'Product Launch Email',
							pageviews: 1890,
							visitors: 1240,
							conversions: 64,
							conversion_rate: 5.2,
							is_ab_test: false
						},
						{
							campaign: 'Influencer Referral Sprint',
							pageviews: 920,
							visitors: 640,
							conversions: 26,
							conversion_rate: 4.1,
							is_ab_test: false
						}
					],
					total_rows: 4
				}
			};
		}

		// Google Search Console queries
		if ( cleanPath.includes( 'search_console' ) || 'search_console' === query.get( 'type' ) || 'search_console' === query.get( 'config' ) ) {
			return {
				request_success: true,
				data: {
					columns: [
						{ id: 'query', name: __( 'Query', 'burst-statistics' ), format: 'text', sortable: true, align: 'left' },
						{ id: 'clicks', name: __( 'Clicks', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'impressions', name: __( 'Impressions', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'ctr', name: __( 'CTR', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' },
						{ id: 'position', name: __( 'Position', 'burst-statistics' ), format: 'number', sortable: true, align: 'right' }
					],
					data: [
						{ query: 'privacy friendly wordpress analytics', clicks: 420, impressions: 4800, ctr: 8.75, position: 2.1 },
						{ query: 'burst statistics setup guide', clicks: 310, impressions: 2900, ctr: 10.69, position: 1.4 },
						{ query: 'cookieless web tracking', clicks: 185, impressions: 3200, ctr: 5.78, position: 3.8 },
						{ query: 'woocommerce conversion tracking plugin', clicks: 142, impressions: 2100, ctr: 6.76, position: 4.2 }
					],
					total_rows: 4
				}
			};
		}

		// Countries datatable
		if ( cleanPath.includes( 'countries' ) || 'countries' === query.get( 'type' ) || 'countries' === query.get( 'config' ) ) {
			return {
				request_success: true,
				data: {
					columns: [
						{ id: 'country_code', name: __( 'Country', 'burst-statistics' ), format: 'country', sortable: true, align: 'left' },
						{ id: 'country', name: __( 'Country', 'burst-statistics' ), format: 'text', sortable: true, align: 'left' },
						{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'bounce_rate', name: __( 'Bounce rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' }
					],
					data: [
						{ country_code: 'US', country: 'United States', visitors: 1840, bounce_rate: 29.5 },
						{ country_code: 'GB', country: 'United Kingdom', visitors: 620, bounce_rate: 31.2 },
						{ country_code: 'DE', country: 'Germany', visitors: 480, bounce_rate: 28.4 },
						{ country_code: 'NL', country: 'Netherlands', visitors: 390, bounce_rate: 25.1 }
					],
					total_rows: 4
				}
			};
		}

		// Referrers datatable
		if ( cleanPath.includes( 'referrers' ) || 'referrers' === query.get( 'type' ) || 'referrers' === query.get( 'config' ) ) {
			return {
				request_success: true,
				data: {
					columns: [
						{ id: 'referrer', name: __( 'Referrer', 'burst-statistics' ), format: 'text', sortable: true, align: 'left' },
						{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'bounce_rate', name: __( 'Bounce rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' }
					],
					data: [
						{ referrer: 'google.com', visitors: 1420, bounce_rate: 31.5 },
						{ referrer: 'github.com', visitors: 680, bounce_rate: 24.2 },
						{ referrer: 'twitter.com / x.com', visitors: 450, bounce_rate: 38.0 },
						{ referrer: 'linkedin.com', visitors: 310, bounce_rate: 22.8 }
					],
					total_rows: 4
				}
			};
		}

		// Outgoing links datatable
		if ( cleanPath.includes( 'outgoing' ) || 'outgoing_links' === query.get( 'type' ) || 'outgoing_links' === query.get( 'config' ) || 'outgoing-links' === query.get( 'type' ) || 'outgoing-links' === query.get( 'config' ) ) {
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

		// Forms datatable
		if ( cleanPath.includes( 'forms' ) || 'forms' === query.get( 'type' ) || 'forms' === query.get( 'config' ) ) {
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

		// Internal links datatable
		if ( cleanPath.includes( 'internal' ) || 'internal_links' === query.get( 'type' ) || 'internal_links' === query.get( 'config' ) || 'internal-links' === query.get( 'type' ) || 'internal-links' === query.get( 'config' ) ) {
			return {
				request_success: true,
				data: {
					columns: [
						{ id: 'url', name: __( 'Page URL', 'burst-statistics' ), format: 'url', sortable: true, align: 'left' },
						{ id: 'clicks', name: __( 'Clicks', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
						{ id: 'previous_clicks', name: __( 'Previous', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' }
					],
					data: [
						{ url: '/pricing', clicks: 940, previous_clicks: 780 },
						{ url: '/features', clicks: 710, previous_clicks: 620 },
						{ url: '/blog/getting-started-with-analytics', clicks: 520, previous_clicks: 430 },
						{ url: '/documentation', clicks: 380, previous_clicks: 310 },
						{ url: '/contact', clicks: 195, previous_clicks: 160 }
					],
					total_rows: 5
				}
			};
		}

		const hasDesktop = query.get( 'filters[device]' )?.includes( 'desktop' ) ||
			query.get( 'filter' )?.includes( 'desktop' ) ||
			( 'undefined' !== typeof window && window.location.hash.includes( 'desktop' ) );
		const scale = isFiltered ? 0.35 : ( hasDesktop ? 0.65 : 1.0 );

		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'page_url', name: __( 'Page', 'burst-statistics' ), format: 'url', sortable: true, align: 'left' },
					{ id: 'pageviews', name: __( 'Pageviews', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'sessions', name: __( 'Sessions', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'bounce_rate', name: __( 'Bounce rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' },
					{ id: 'avg_time', name: __( 'Avg. time on page', 'burst-statistics' ), format: 'time', sortable: true, align: 'right' },
					{ id: 'avg_time_on_page', name: __( 'Avg. time on page', 'burst-statistics' ), format: 'time', sortable: true, align: 'right' },
					{ id: 'conversions', name: __( 'Conversions', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' },
					{ id: 'conversion_rate', name: __( 'Goal conv. rate', 'burst-statistics' ), format: 'percentage', sortable: true, align: 'right' },
					{ id: 'first_time_visitors', name: __( 'First time visitors', 'burst-statistics' ), format: 'integer', sortable: true, align: 'right' }
				],
				data: [
					{
						page_url: isFiltered ? filter : '/',
						pageviews: Math.round( 5420 * scale ),
						visitors: Math.round( 3890 * scale ),
						sessions: Math.round( 4120 * scale ),
						bounce_rate: 32.4,
						avg_time: '02:14',
						avg_time_on_page: '02:14',
						conversions: Math.round( 182 * scale ),
						conversion_rate: 4.68,
						first_time_visitors: Math.round( 2450 * scale ),
						entrances: Math.round( 3400 * scale ),
						exits: Math.round( 1850 * scale )
					},
					{
						page_url: '/pricing',
						pageviews: Math.round( 2140 * scale ),
						visitors: Math.round( 1780 * scale ),
						sessions: Math.round( 1950 * scale ),
						bounce_rate: 28.1,
						avg_time: '03:02',
						avg_time_on_page: '03:02',
						conversions: Math.round( 96 * scale ),
						conversion_rate: 5.39,
						first_time_visitors: Math.round( 1120 * scale ),
						entrances: Math.round( 1200 * scale ),
						exits: Math.round( 650 * scale )
					},
					{
						page_url: '/features',
						pageviews: Math.round( 1890 * scale ),
						visitors: Math.round( 1450 * scale ),
						sessions: Math.round( 1620 * scale ),
						bounce_rate: 35.8,
						avg_time: '01:48',
						avg_time_on_page: '01:48',
						conversions: Math.round( 64 * scale ),
						conversion_rate: 4.41,
						first_time_visitors: Math.round( 890 * scale ),
						entrances: Math.round( 920 * scale ),
						exits: Math.round( 580 * scale )
					},
					{
						page_url: '/blog/getting-started-with-analytics',
						pageviews: Math.round( 1240 * scale ),
						visitors: Math.round( 980 * scale ),
						sessions: Math.round( 1100 * scale ),
						bounce_rate: 41.2,
						avg_time: '04:12',
						avg_time_on_page: '04:12',
						conversions: Math.round( 42 * scale ),
						conversion_rate: 4.29,
						first_time_visitors: Math.round( 710 * scale ),
						entrances: Math.round( 740 * scale ),
						exits: Math.round( 410 * scale )
					}
				],
				total_rows: 4
			}
		};
	}

	// 18. Compare Block
	if ( 'data/compare' === cleanPath || 'compare' === cleanPath ) {
		return {
			request_success: true,
			data: {
				current: {
					pageviews: 5420,
					sessions: 4120,
					visitors: 3890,
					bounce_rate: 32.4,
					avg_time_on_page: 154,
					first_time_visitors: 2450
				},
				previous: {
					pageviews: 4680,
					sessions: 3580,
					visitors: 3340,
					bounce_rate: 36.8,
					avg_time_on_page: 142,
					first_time_visitors: 2100
				},
				view: 'default'
			}
		};
	}

	// 19. Geo / World Map Data
	if ( 'data/geo' === cleanPath || 'geo' === cleanPath ) {
		return {
			request_success: true,
			data: [
				{ country_code: 'US', country: 'United States', visitors: 1840, pageviews: 2950, bounce_rate: 29.5 },
				{ country_code: 'GB', country: 'United Kingdom', visitors: 620, pageviews: 940, bounce_rate: 31.2 },
				{ country_code: 'DE', country: 'Germany', visitors: 480, pageviews: 710, bounce_rate: 28.4 },
				{ country_code: 'NL', country: 'Netherlands', visitors: 390, pageviews: 580, bounce_rate: 25.1 },
				{ country_code: 'CA', country: 'Canada', visitors: 310, pageviews: 450, bounce_rate: 33.0 },
				{ country_code: 'FR', country: 'France', visitors: 260, pageviews: 380, bounce_rate: 34.2 },
				{ country_code: 'AU', country: 'Australia', visitors: 190, pageviews: 290, bounce_rate: 30.8 }
			]
		};
	}

	// 20. Ecommerce Sales Chart & Subscriptions Revenue Chart
	if ( 'ecommerce/sales-chart' === cleanPath || 'ecommerce/subscriptions-revenue-chart' === cleanPath ) {
		const timestamps = [];
		const salesData = [];
		const revenueData = [];
		for ( let i = 6; 0 <= i; i-- ) {
			timestamps.push( now - i * 86400 );
			salesData.push( 18 + Math.round( Math.sin( i ) * 6 ) + ( i % 4 ) );
			revenueData.push( 1450 + Math.round( Math.sin( i ) * 400 ) + ( ( i * 50 ) % 200 ) );
		}
		return {
			request_success: true,
			data: {
				timestamps,
				interval: 'day',
				spans_multiple_years: false,
				mode: 'revenue',
				currency: '$',
				datasets: [
					{
						data: revenueData,
						label: __( 'Revenue', 'burst-statistics' ),
						metric_key: 'revenue',
						is_comparison: false
					}
				],
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
	if ( 'ecommerce/sales-forecast' === cleanPath || 'ecommerce/subscriptions-forecast' === cleanPath ) {
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
				currency: '$',
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
	if ( 'ecommerce/top-performers' === cleanPath ) {
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
					current: { total_revenue: 9800, total_quantity_sold: 120 },
					previous: { total_revenue: 8100, total_quantity_sold: 104 },
					revenue_change: 21.0
				},
				'top-country': {
					label: __( 'Top country', 'burst-statistics' ),
					current: { total_revenue: 7200, total_quantity_sold: 84 },
					previous: { total_revenue: 6100, total_quantity_sold: 72 },
					revenue_change: 18.0
				},
				'top-campaign': {
					label: __( 'Top campaign', 'burst-statistics' ),
					current: { total_revenue: 3800, total_quantity_sold: 42 },
					previous: { total_revenue: 2900, total_quantity_sold: 31 },
					revenue_change: 31.0
				}
			}
		};
	}

	// 23. Ecommerce Quick Wins
	if ( 'ecommerce/quick-wins' === cleanPath ) {
		return {
			request_success: true,
			data: [
				{
					id: 'abandoned-cart-recovery',
					title: __( 'Recover Abandoned Carts', 'burst-statistics' ),
					impact: 'high',
					description: __( '22% of carts were abandoned this week. Setting up a recovery email could recover ~$1,800/mo.', 'burst-statistics' )
				},
				{
					id: 'mobile-checkout-speed',
					title: __( 'Optimize Mobile Checkout', 'burst-statistics' ),
					impact: 'medium',
					description: __( 'Mobile conversion rate is 1.8% vs 4.2% on desktop. Streamlining checkout fields can boost sales.', 'burst-statistics' )
				}
			]
		};
	}

	// 24. Ecommerce Sales Funnel
	if ( 'ecommerce/sales-funnel' === cleanPath ) {
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
	if ( 'ecommerce/subscriptions-distribution' === cleanPath ) {
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
	if ( 'ecommerce/subscriptions-retention' === cleanPath ) {
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

	if ( 'data/page-parameters' === cleanPath || 'page-parameters' === cleanPath ) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'parameter', name: __( 'Parameter', 'burst-statistics' ), align: 'left' },
					{ id: 'pageviews', name: __( 'Pageviews', 'burst-statistics' ), align: 'right' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), align: 'right' }
				],
				data: [
					{ parameter: 'utm_source=google', pageviews: 420, visitors: 310 },
					{ parameter: 'utm_source=twitter', pageviews: 180, visitors: 140 },
					{ parameter: 'ref=newsletter', pageviews: 95, visitors: 78 }
				]
			}
		};
	}

	// 28. Source Referrers
	if ( 'data/source-referrers' === cleanPath || 'source-referrers' === cleanPath ) {
		return {
			request_success: true,
			data: {
				columns: [
					{ id: 'referrer', name: __( 'Referrer URL', 'burst-statistics' ), align: 'left' },
					{ id: 'visitors', name: __( 'Visitors', 'burst-statistics' ), align: 'right' }
				],
				data: [
					{ referrer: 'https://www.google.com/', visitors: 1420 },
					{ referrer: 'https://news.google.com/', visitors: 420 }
				]
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
