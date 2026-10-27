/**
 * One source of truth for the tour demo data.
 *
 * Every mock endpoint derives its rows and totals from the datasets below, so
 * blocks tell the same story (the devices block, a device filter and the
 * pages table all agree that mobile is 31% of visitors). Filters scale
 * numbers by the filtered segment's share instead of returning fixed values.
 *
 * Everything here is deterministic: the same request gives the same response.
 */

/** Visitors in the default period (matches the compare block). */
export const TOTAL_VISITORS = 3890;

/**
 * Pages, pageviews and visitors per page. Bounce rate in %, time in ms.
 */
export const PAGES = [
	{ page_url: '/', pageviews: 5420, visitors: 2140, sessions: 2380, bounce_rate: 32.4, avg_time_on_page: 134000, conversions: 82, entrances: 1980, exit_rate: 34.1, first_time_visitors: 1450 },
	{ page_url: '/pricing', pageviews: 2140, visitors: 1180, sessions: 1310, bounce_rate: 28.1, avg_time_on_page: 182000, conversions: 64, entrances: 520, exit_rate: 30.4, first_time_visitors: 690 },
	{ page_url: '/features', pageviews: 1890, visitors: 960, sessions: 1040, bounce_rate: 35.8, avg_time_on_page: 108000, conversions: 21, entrances: 410, exit_rate: 36.9, first_time_visitors: 610 },
	{ page_url: '/blog/how-to-grow-traffic', pageviews: 1240, visitors: 720, sessions: 760, bounce_rate: 41.2, avg_time_on_page: 252000, conversions: 9, entrances: 590, exit_rate: 52.3, first_time_visitors: 580 },
	{ page_url: '/documentation', pageviews: 980, visitors: 540, sessions: 600, bounce_rate: 24.6, avg_time_on_page: 216000, conversions: 4, entrances: 220, exit_rate: 28.7, first_time_visitors: 190 },
	{ page_url: '/contact', pageviews: 420, visitors: 310, sessions: 320, bounce_rate: 22.3, avg_time_on_page: 96000, conversions: 18, entrances: 60, exit_rate: 44.0, first_time_visitors: 120 },
	{ page_url: '/about-us', pageviews: 330, visitors: 220, sessions: 230, bounce_rate: 38.5, avg_time_on_page: 74000, conversions: 2, entrances: 40, exit_rate: 47.2, first_time_visitors: 150 }
];

/**
 * Traffic sources. `referrer` is the domain shown in the free referrers
 * view, `children` are the raw referrer URLs behind a Pro source row.
 * Visitors add up to TOTAL_VISITORS.
 */
export const SOURCES = [
	{
		source: 'Google', source_category: 'search', referrer: 'google.com', visitors: 1480, pageviews: 2310, bounce_rate: 31.5, conversions: 71, sales: 68, revenue: 5320,
		children: [
			{ referrer: 'https://www.google.com/', visitors: 1190, pageviews: 1850 },
			{ referrer: 'https://www.google.nl/', visitors: 170, pageviews: 270 },
			{ referrer: 'https://news.google.com/', visitors: 120, pageviews: 190 }
		]
	},
	{ source: 'Direct', source_category: 'direct', referrer: '', visitors: 1040, pageviews: 1610, bounce_rate: 29.8, conversions: 52, sales: 49, revenue: 3840, children: [] },
	{
		source: 'Twitter / X', source_category: 'social', referrer: 't.co', visitors: 360, pageviews: 470, bounce_rate: 44.2, conversions: 9, sales: 8, revenue: 610,
		children: [
			{ referrer: 'https://t.co/', visitors: 290, pageviews: 380 },
			{ referrer: 'https://x.com/', visitors: 70, pageviews: 90 }
		]
	},
	{ source: 'GitHub', source_category: 'referral', referrer: 'github.com', visitors: 270, pageviews: 520, bounce_rate: 24.2, conversions: 14, sales: 13, revenue: 1180, children: [] },
	{
		source: 'Bing', source_category: 'search', referrer: 'bing.com', visitors: 260, pageviews: 390, bounce_rate: 33.1, conversions: 11, sales: 10, revenue: 820,
		children: [
			{ referrer: 'https://www.bing.com/', visitors: 230, pageviews: 350 },
			{ referrer: 'https://duckduckgo.com/', visitors: 30, pageviews: 40 }
		]
	},
	{
		source: 'LinkedIn', source_category: 'social', referrer: 'linkedin.com', visitors: 190, pageviews: 260, bounce_rate: 22.8, conversions: 8, sales: 7, revenue: 640,
		children: [
			{ referrer: 'https://www.linkedin.com/', visitors: 140, pageviews: 190 },
			{ referrer: 'https://lnkd.in/', visitors: 50, pageviews: 70 }
		]
	},
	{
		source: 'ChatGPT', source_category: 'aiReferral', referrer: 'chatgpt.com', visitors: 160, pageviews: 290, bounce_rate: 18.4, conversions: 11, sales: 10, revenue: 1020,
		children: [
			{ referrer: 'https://chatgpt.com/', visitors: 140, pageviews: 250 },
			{ referrer: 'https://chat.openai.com/', visitors: 20, pageviews: 40 }
		]
	},
	{
		source: 'Newsletter', source_category: 'email', referrer: 'mail.google.com', visitors: 130, pageviews: 210, bounce_rate: 20.5, conversions: 6, sales: 17, revenue: 820,
		children: [
			{ referrer: 'https://mail.google.com/', visitors: 90, pageviews: 150 },
			{ referrer: 'https://outlook.live.com/', visitors: 40, pageviews: 60 }
		]
	}
];

/** Device shares, matching the devices block (650 / 310 / 40 of 1000). */
export const DEVICES = [
	{ id: 'desktop', share: 0.65, os: 'macOS', browser: 'Chrome' },
	{ id: 'mobile', share: 0.31, os: 'iOS', browser: 'Safari' },
	{ id: 'tablet', share: 0.04, os: 'iPadOS', browser: 'Safari' }
];

/**
 * Countries with states and cities. State codes are the ISO 3166-2 suffixes
 * the country maps use (US-CA → CA). Visitors add up to TOTAL_VISITORS.
 */
export const COUNTRIES = [
	{
		country_code: 'US', country: 'United States', continent_code: 'NA', visitors: 1520, pageviews: 2440, bounce_rate: 29.5,
		states: [
			{ state_code: 'CA', state: 'California', visitors: 420, cities: [ [ 'San Francisco', 190 ], [ 'Los Angeles', 150 ], [ 'San Diego', 80 ] ] },
			{ state_code: 'NY', state: 'New York', visitors: 310, cities: [ [ 'New York', 260 ], [ 'Buffalo', 50 ] ] },
			{ state_code: 'TX', state: 'Texas', visitors: 230, cities: [ [ 'Austin', 120 ], [ 'Houston', 110 ] ] },
			{ state_code: 'WA', state: 'Washington', visitors: 160, cities: [ [ 'Seattle', 160 ] ] },
			{ state_code: 'IL', state: 'Illinois', visitors: 120, cities: [ [ 'Chicago', 120 ] ] },
			{ state_code: 'FL', state: 'Florida', visitors: 110, cities: [ [ 'Miami', 70 ], [ 'Orlando', 40 ] ] },
			{ state_code: 'MA', state: 'Massachusetts', visitors: 90, cities: [ [ 'Boston', 90 ] ] },
			{ state_code: 'CO', state: 'Colorado', visitors: 80, cities: [ [ 'Denver', 80 ] ] }
		]
	},
	{
		country_code: 'GB', country: 'United Kingdom', continent_code: 'EU', visitors: 540, pageviews: 820, bounce_rate: 31.2,
		states: [
			{ state_code: 'WSM', state: 'Westminster', visitors: 190, cities: [ [ 'London', 190 ] ] },
			{ state_code: 'MAN', state: 'Manchester', visitors: 110, cities: [ [ 'Manchester', 110 ] ] },
			{ state_code: 'EDH', state: 'Edinburgh', visitors: 80, cities: [ [ 'Edinburgh', 80 ] ] },
			{ state_code: 'BIR', state: 'Birmingham', visitors: 70, cities: [ [ 'Birmingham', 70 ] ] },
			{ state_code: 'BST', state: 'Bristol', visitors: 50, cities: [ [ 'Bristol', 50 ] ] },
			{ state_code: 'LDS', state: 'Leeds', visitors: 40, cities: [ [ 'Leeds', 40 ] ] }
		]
	},
	{
		country_code: 'DE', country: 'Germany', continent_code: 'EU', visitors: 460, pageviews: 690, bounce_rate: 28.4,
		states: [
			{ state_code: 'BE', state: 'Berlin', visitors: 150, cities: [ [ 'Berlin', 150 ] ] },
			{ state_code: 'BY', state: 'Bavaria', visitors: 120, cities: [ [ 'Munich', 90 ], [ 'Nuremberg', 30 ] ] },
			{ state_code: 'HH', state: 'Hamburg', visitors: 80, cities: [ [ 'Hamburg', 80 ] ] },
			{ state_code: 'NW', state: 'North Rhine-Westphalia', visitors: 110, cities: [ [ 'Cologne', 60 ], [ 'Düsseldorf', 50 ] ] }
		]
	},
	{
		country_code: 'NL', country: 'Netherlands', continent_code: 'EU', visitors: 410, pageviews: 610, bounce_rate: 25.1,
		states: [
			{ state_code: 'NH', state: 'North Holland', visitors: 170, cities: [ [ 'Amsterdam', 140 ], [ 'Haarlem', 30 ] ] },
			{ state_code: 'ZH', state: 'South Holland', visitors: 120, cities: [ [ 'Rotterdam', 70 ], [ 'The Hague', 50 ] ] },
			{ state_code: 'UT', state: 'Utrecht', visitors: 70, cities: [ [ 'Utrecht', 70 ] ] },
			{ state_code: 'GR', state: 'Groningen', visitors: 50, cities: [ [ 'Groningen', 50 ] ] }
		]
	},
	{ country_code: 'CA', country: 'Canada', continent_code: 'NA', visitors: 300, pageviews: 440, bounce_rate: 33.0, states: [] },
	{ country_code: 'FR', country: 'France', continent_code: 'EU', visitors: 250, pageviews: 370, bounce_rate: 34.2, states: [] },
	{ country_code: 'IN', country: 'India', continent_code: 'AS', visitors: 220, pageviews: 300, bounce_rate: 41.6, states: [] },
	{ country_code: 'AU', country: 'Australia', continent_code: 'OC', visitors: 190, pageviews: 280, bounce_rate: 30.8, states: [] }
];

/** UTM campaigns (with an A/B test). */
export const CAMPAIGNS = [
	{ campaign: 'Summer Sale - variation-a', utm_source: 'newsletter', medium: 'email', pageviews: 610, visitors: 420, bounce_rate: 26.1, conversions: 20, conversion_rate: 4.8, sales: 18, revenue: 1260, is_ab_test: true, winner: false, significant: 'significant' },
	{ campaign: 'Summer Sale - variation-b (15% Off)', utm_source: 'newsletter', medium: 'email', pageviews: 630, visitors: 430, bounce_rate: 22.4, conversions: 40, conversion_rate: 9.4, sales: 37, revenue: 2540, is_ab_test: true, winner: true, significant: 'significant' },
	{ campaign: 'Product Launch Email', utm_source: 'newsletter', medium: 'email', pageviews: 470, visitors: 310, bounce_rate: 27.9, conversions: 16, conversion_rate: 5.2, sales: 14, revenue: 1120, is_ab_test: false },
	{ campaign: 'Influencer Referral Sprint', utm_source: 'twitter', medium: 'social', pageviews: 230, visitors: 160, bounce_rate: 39.0, conversions: 7, conversion_rate: 4.1, sales: 6, revenue: 480, is_ab_test: false }
];

/** Products; sales and revenue add up to the Sales block (182 orders, $14,250). */
export const PRODUCTS = [
	{ product: 'Pro License (Annual)', adds_to_cart: 118, sales: 45, revenue: 6450 },
	{ product: 'Starter License', adds_to_cart: 240, sales: 92, revenue: 3220 },
	{ product: 'Agency License', adds_to_cart: 34, sales: 11, revenue: 2970 },
	{ product: 'Setup Service', adds_to_cart: 70, sales: 34, revenue: 1610 }
];

/** Subscription plans; add up to the Subscriptions block (148 active, $4,850 MRR, 3 canceled). */
export const SUBSCRIPTION_PLANS = [
	{ plan: 'Pro Annual', active_subscribers: 88, canceled_subscribers: 2, trialling_subscribers: 4, monthly_recurring_revenue: 2860, product_churn_value: 1.6 },
	{ plan: 'Agency Annual', active_subscribers: 22, canceled_subscribers: 0, trialling_subscribers: 1, monthly_recurring_revenue: 1540, product_churn_value: 1.2 },
	{ plan: 'Starter Monthly', active_subscribers: 38, canceled_subscribers: 1, trialling_subscribers: 3, monthly_recurring_revenue: 450, product_churn_value: 2.9 }
];

/** Reading engagement per page; time in ms, score 0–100. */
export const READING_ENGAGEMENT = [
	{ page_url: '/blog/how-to-grow-traffic', title: 'How to grow traffic', avg_time_on_page: 252000, word_count: 1850, reading_engagement_score: 92 },
	{ page_url: '/documentation', title: 'Documentation', avg_time_on_page: 216000, word_count: 1400, reading_engagement_score: 88 },
	{ page_url: '/pricing', title: 'Pricing', avg_time_on_page: 182000, word_count: 600, reading_engagement_score: 84 },
	{ page_url: '/', title: 'Home', avg_time_on_page: 134000, word_count: 450, reading_engagement_score: 79 },
	{ page_url: '/blog/cookieless-tracking', title: 'Cookieless tracking explained', avg_time_on_page: 121000, word_count: 1600, reading_engagement_score: 61 },
	{ page_url: '/features', title: 'Features', avg_time_on_page: 108000, word_count: 980, reading_engagement_score: 55 },
	{ page_url: '/blog/release-notes-2-4', title: 'Release notes 2.4', avg_time_on_page: 42000, word_count: 1200, reading_engagement_score: 31 },
	{ page_url: '/about-us', title: 'About us', avg_time_on_page: 38000, word_count: 900, reading_engagement_score: 24 }
];

/** Share of visitors for filters that have no dataset of their own. */
const FIXED_SHARES = {
	bounces: 0.324,
	new_visitor: 0.63,
	goal_id: 0.047,
	entry_exit_pages: 0.51,
	browser_id: { Chrome: 0.58, Safari: 0.27, Firefox: 0.09, Edge: 0.06 },
	platform_id: { macOS: 0.38, Windows: 0.29, iOS: 0.19, Android: 0.12, Linux: 0.02 }
};
const DEFAULT_SHARE = 0.5;

/** Fields that are counts; everything else (rates, times, scores) is left alone when scaling. */
const COUNT_KEYS = new Set([
	'pageviews', 'visitors', 'sessions', 'conversions', 'first_time_visitors', 'entrances', 'exits',
	'sales', 'revenue', 'count', 'top_count', 'hits', 'clicks', 'bounced_sessions', 'adds_to_cart', 'value'
]);

const byVisitors = ( rows, match ) =>
	rows.filter( match ).reduce( ( sum, row ) => sum + row.visitors, 0 ) / TOTAL_VISITORS;

const allStates = () => COUNTRIES.flatMap( ( country ) =>
	country.states.map( ( state ) => ({ ...state, country_code: country.country_code }) )
);

const allCities = () => allStates().flatMap( ( state ) =>
	state.cities.map( ([ city, visitors ]) => ({ city, visitors, state: state.state, state_code: state.state_code, country_code: state.country_code }) )
);

/**
 * Share of all visitors that matches one filter value.
 *
 * @param {string} key   Filter key from filterConfig (page_url, device_id, …).
 * @param {string} value A single value, without '!' prefix.
 * @return {number} Share between 0 and 1.
 */
// fallow-ignore-next-line complexity
const valueShare = ( key, value ) => {
	switch ( key ) {
		case 'page_url':
			return byVisitors( PAGES, ( page ) => page.page_url === value );
		case 'referrer':
			return byVisitors( SOURCES, ( source ) => source.referrer && value.includes( source.referrer ) );
		case 'source':
			return byVisitors( SOURCES, ( source ) => source.source === value );
		case 'source_category':
			return byVisitors( SOURCES, ( source ) => source.source_category === value );
		case 'device_id':
			return DEVICES.find( ( device ) => device.id === value.toLowerCase() )?.share ?? 0;
		case 'country_code':
			return byVisitors( COUNTRIES, ( country ) => country.country_code === value );
		case 'continent_code':
			return byVisitors( COUNTRIES, ( country ) => country.continent_code === value );
		case 'state':
			return byVisitors( allStates(), ( state ) => state.state === value || state.state_code === value );
		case 'city':
			return byVisitors( allCities(), ( city ) => city.city === value );
		case 'utm_campaign':
			return byVisitors( CAMPAIGNS, ( campaign ) => campaign.campaign === value );
		default: {
			const fixed = FIXED_SHARES[ key ];
			if ( 'number' === typeof fixed ) {
				return [ 'exclude', '0', 'false' ].includes( value ) ? 1 - fixed : fixed;
			}
			if ( fixed && 'object' === typeof fixed ) {
				return fixed[ value ] ?? 0.05;
			}
			return DEFAULT_SHARE;
		}
	}
};

const isPlainObject = ( value ) => null !== value && 'object' === typeof value && ! Array.isArray( value );

/**
 * Read the `filters` query param as an object; anything else gives an empty object.
 *
 * @param {URLSearchParams} query The request query.
 * @return {Object} Filter values by key.
 */
const readFiltersParam = ( query ) => {
	try {
		const raw = JSON.parse( query.get( 'filters' ) || '{}' );
		return isPlainObject( raw ) ? raw : {};
	} catch {
		return {};
	}
};

/**
 * Parse the `filters` query param (a JSON object) into active filters.
 *
 * @param {URLSearchParams} query The request query.
 * @return {Array<{key: string, values: string[], exclude: boolean}>} Active filters.
 */
export const parseMockFilters = ( query ) =>
	Object.entries( readFiltersParam( query ) )
		.filter( ([ , value ]) => null !== value && undefined !== value && '' !== String( value ).trim() )
		.map( ([ key, value ]) => {
			const text = String( value ).trim();
			const exclude = text.startsWith( '!' );
			const values = ( exclude ? text.slice( 1 ) : text ).split( ',' ).map( ( v ) => v.trim() ).filter( Boolean );
			return { key, values, exclude };
		})
		.filter( ( filter ) => 0 < filter.values.length );

/**
 * Share of visitors left after one filter.
 *
 * @param {{key: string, values: string[], exclude: boolean}} filter Parsed filter.
 * @return {number} Share between 0 and 1.
 */
const filterShare = ( filter ) => {
	const share = Math.min( 1, filter.values.reduce( ( sum, value ) => sum + valueShare( filter.key, value ), 0 ) );
	return filter.exclude ? 1 - share : share;
};

/**
 * Combined share of all filters, treating segments as independent.
 *
 * @param {Array} filters Parsed filters.
 * @param {string[]} [skipKeys] Filter keys handled elsewhere (e.g. by row selection).
 * @return {number} Share between 0 and 1.
 */
export const combinedShare = ( filters, skipKeys = []) =>
	filters
		.filter( ( filter ) => ! skipKeys.includes( filter.key ) )
		.reduce( ( share, filter ) => share * filterShare( filter ), 1 );

/**
 * Multiply the count fields of a row, leaving rates and times alone.
 *
 * @param {Object} row   Data row.
 * @param {number} share Scale factor.
 * @return {Object} New row.
 */
export const scaleRow = ( row, share ) => {
	if ( 1 === share ) {
		return row;
	}
	const scaled = { ...row };
	Object.keys( scaled ).forEach( ( key ) => {
		if ( COUNT_KEYS.has( key ) && 'number' === typeof scaled[ key ]) {
			scaled[ key ] = Math.round( scaled[ key ] * share );
		}
	});
	return scaled;
};

/**
 * Apply filters to table rows.
 *
 * A filter on the table's own dimension (a page filter on the pages table)
 * keeps only the matching rows. Every other filter scales the counts by
 * that segment's share, so all blocks move together.
 *
 * @param {Object[]} rows         Rows to filter.
 * @param {Array}    filters      Parsed filters.
 * @param {Object}   [dimensions] Map of filter key → row field for this table.
 * @return {Object[]} Filtered rows.
 */
export const applyMockFilters = ( rows, filters, dimensions = {}) => {
	let result = rows;
	filters.forEach( ( filter ) => {
		const field = dimensions[ filter.key ];
		if ( ! field ) {
			return;
		}
		result = result.filter( ( row ) => {
			const matches = filter.values.some( ( value ) => String( row[ field ] ?? '' ).toLowerCase() === value.toLowerCase() );
			return filter.exclude ? ! matches : matches;
		});
	});

	const share = combinedShare( filters, Object.keys( dimensions ) );
	return result.map( ( row ) => scaleRow( row, share ) );
};

/**
 * Build a datatable response the way `get_datatables_data()` does: one column
 * per requested metric, rows carrying the fields for those metrics.
 *
 * @param {Object[]} rows    Rows, already filtered.
 * @param {string[]} metrics Requested metrics (`metrics[]`); empty uses the row keys.
 * @param {Object}   [extra] Extra top-level fields for the response.
 * @return {Object} `{ request_success, data: { columns, data, total_rows } }`.
 */
export const buildDatatable = ( rows, metrics, extra = {}) => {
	const ids = 0 < metrics.length ? metrics : Object.keys( rows[ 0 ] || {});
	return {
		request_success: true,
		data: {
			columns: ids.map( ( id ) => ({
				id,
				name: id.replace( /_/g, ' ' ).replace( /^./, ( c ) => c.toUpperCase() ),
				sortable: 'true',
				right: 'true'
			}) ),
			data: rows.map( ( row ) => {
				const complete = { ...row };
				ids.forEach( ( id ) => {
					if ( undefined === complete[ id ]) {
						complete[ id ] = 0;
					}
				});
				return complete;
			}),
			total_rows: rows.length,
			metrics: ids,
			...extra
		}
	};
};

/** Location rows at the level a datatable groups by (country, state or city). */
// fallow-ignore-next-line complexity
export const locationRows = ( groupBy ) => {
	const countryOf = ( code ) => COUNTRIES.find( ( country ) => country.country_code === code );
	const bounceRate = ( code ) => countryOf( code )?.bounce_rate ?? 30;
	const withDerived = ( row ) => ({
		...row,
		pageviews: row.pageviews ?? Math.round( row.visitors * 1.52 ),
		sessions: Math.round( row.visitors * 1.08 ),
		conversions: Math.round( row.visitors * 0.047 ),
		sales: Math.round( row.visitors * 0.047 ),
		revenue: Math.round( row.visitors * 3.66 ),
		sales_conversion_rate: 4.7,
		avg_order_value: 78.5
	});

	if ( groupBy.includes( 'city' ) ) {
		return allCities().map( ( city ) => withDerived({
			country_code: city.country_code,
			continent: countryOf( city.country_code ).continent_code,
			state: city.state,
			city: city.city,
			visitors: city.visitors,
			bounce_rate: bounceRate( city.country_code )
		}) );
	}
	if ( groupBy.includes( 'state' ) ) {
		return allStates().map( ( state ) => withDerived({
			country_code: state.country_code,
			continent: countryOf( state.country_code ).continent_code,
			state: state.state,
			visitors: state.visitors,
			bounce_rate: bounceRate( state.country_code )
		}) );
	}
	return COUNTRIES.map( ( country ) => withDerived({
		country_code: country.country_code,
		continent: country.continent_code,
		visitors: country.visitors,
		pageviews: country.pageviews,
		bounce_rate: country.bounce_rate
	}) );
};

/** Filter options derived from the datasets, keyed by `data_type`. */
export const datasetFilterOptions = () => ({
	pages: PAGES.map( ( page ) => ({ ID: page.page_url, name: page.page_url }) ),
	referrers: SOURCES.filter( ( source ) => source.referrer ).map( ( source ) => ({ ID: source.referrer, name: source.referrer }) ),
	traffic_sources: SOURCES.map( ( source ) => ({ ID: source.source, name: source.source }) ),
	source_categories: [ ...new Set( SOURCES.map( ( source ) => source.source_category ) ) ].map( ( category ) => ({ ID: category, name: category }) ),
	campaigns: CAMPAIGNS.map( ( campaign ) => ({ ID: campaign.campaign, name: campaign.campaign }) ),
	countries: COUNTRIES.map( ( country ) => ({ ID: country.country_code, name: country.country }) ),
	states: allStates().map( ( state ) => ({ ID: state.state, name: state.state }) ),
	cities: allCities().map( ( city ) => ({ ID: city.city, name: city.city }) )
});
