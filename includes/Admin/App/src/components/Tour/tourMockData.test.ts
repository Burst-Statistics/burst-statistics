import assert from 'node:assert/strict';
import test from 'node:test';

interface MockWindow {
	location: {
		search: string;
		href: string;
		hash: string;
		hostname: string;
	};
	__burst_is_tour_active?: () => boolean;
}

const originalWindow = global.window;
const mockWindow: MockWindow = {
	location: {
		search: '',
		href: 'http://localhost/wp-admin/admin.php?page=burst',
		hash: '',
		hostname: 'localhost'
	}
};

const testGlobal: Record<string, unknown> = globalThis;

// Loaded in `before` so the window mock is installed before the module is
// evaluated, independent of CommonJS/ESM import hoisting.
let getFrontendTourMockData: ( path: string ) => unknown;

test.before( async() => {
	testGlobal.window = mockWindow;
	({ getFrontendTourMockData } = await import( './tourMockData' ) );
});

test.after( () => {
	testGlobal.window = originalWindow;
});

test.beforeEach( () => {
	mockWindow.location.search = '';
	delete mockWindow.__burst_is_tour_active;
});

test( 'getFrontendTourMockData returns null when tour is not active', () => {
	const mock = getFrontendTourMockData( 'data/overview' );
	assert.strictEqual( mock, null );
});

test( 'getFrontendTourMockData returns mock data when ?tour=dashboard is in URL', () => {
	mockWindow.location.search = '?page=burst&tour=dashboard';

	const insightsMock = getFrontendTourMockData( 'data/insights' ) as { request_success: boolean; data: { datasets: Array<{ label: string }> } };
	assert.ok( null !== insightsMock, 'Insights mock should return data' );
	assert.strictEqual( insightsMock.request_success, true );
	assert.ok( Array.isArray( insightsMock.data.datasets ), 'Insights should include datasets' );
});

test( 'getFrontendTourMockData follows the tour store when it reports mock data active (Sales upsell, demo mode)', () => {

	// URL has NO tour parameter; the store (exposed as __burst_is_tour_active) says mock data is on.
	mockWindow.location.search = '?page=burst';
	mockWindow.__burst_is_tour_active = () => true;

	const datatableMock = getFrontendTourMockData( 'data/datatable/upsell_pages' ) as {
		request_success: boolean;
		data: { columns: Array<{ id: string }>; data: Array<Record<string, unknown>>; total_rows: number };
	};

	assert.ok( null !== datatableMock, 'Datatable mock should return data when the store reports mock data active' );
	assert.strictEqual( datatableMock.request_success, true );
	assert.ok( Array.isArray( datatableMock.data.columns ), 'Columns should be an array' );
	assert.ok( Array.isArray( datatableMock.data.data ), 'Data should be an array' );
	assert.ok( 0 < datatableMock.data.data.length, 'Data rows should not be empty' );

	const firstRow = datatableMock.data.data[0];
	assert.ok( firstRow.page_url !== undefined, 'Row should include page_url' );
	assert.ok( firstRow.pageviews !== undefined, 'Row should include pageviews' );
	assert.ok( firstRow.visitors !== undefined, 'Row should include visitors' );
});

test( 'the tour store verdict wins over the URL when it reports inactive', () => {
	mockWindow.location.search = '?page=burst&tour=dashboard';
	mockWindow.__burst_is_tour_active = () => false;

	assert.strictEqual( getFrontendTourMockData( 'data/insights' ), null );
});

test( 'getFrontendTourMockData provides mock ecommerce data for sales upsell', () => {
	mockWindow.__burst_is_tour_active = () => true;

	const salesMock = getFrontendTourMockData( 'data/ecommerce/sales' ) as { request_success: boolean; data: Record<string, unknown> };
	assert.ok( null !== salesMock, 'Sales mock should return data' );
	assert.strictEqual( salesMock.request_success, true );

	const topPerformersMock = getFrontendTourMockData( 'ecommerce/top-performers' ) as { request_success: boolean; data: unknown };
	assert.ok( null !== topPerformersMock, 'Top performers mock should return data' );
	assert.strictEqual( topPerformersMock.request_success, true );
});

test( 'tour management endpoints are never intercepted by getFrontendTourMockData', () => {
	mockWindow.location.search = '?tour=dashboard';

	assert.strictEqual( getFrontendTourMockData( 'burst/v1/tour/status' ), null );
	assert.strictEqual( getFrontendTourMockData( 'burst/v1/do_action/tour_dismiss' ), null );
	assert.strictEqual( getFrontendTourMockData( 'burst/v1/get_action/tour_steps' ), null );
});

test( 'getFrontendTourMockData matches paths from plain permalinks, where the query is glued on with &', () => {
	mockWindow.__burst_is_tour_active = () => true;

	const todayMock = getFrontendTourMockData( 'burst/v1/data/today&date_start=2026-06-30&date_end=2026-06-30&nonce=abc' ) as { request_success: boolean } | null;
	assert.ok( null !== todayMock, 'Today mock should match a plain-permalink path' );
	assert.strictEqual( todayMock?.request_success, true );
});

test( 'getFrontendTourMockData serves ecommerce mocks for the data/ paths that getData() requests', () => {
	mockWindow.__burst_is_tour_active = () => true;

	for ( const endpoint of [ 'sales-chart', 'sales-forecast', 'top-performers', 'sales-funnel', 'quick-wins', 'growth', 'subscriptions-revenue-chart', 'subscriptions-distribution' ]) {
		const mock = getFrontendTourMockData( `burst/v1/data/ecommerce/${ endpoint }?date_start=2026-06-23` ) as { request_success: boolean } | null;
		assert.ok( null !== mock, `${ endpoint } mock should match its data/ path` );
	}

	const salesMock = getFrontendTourMockData( 'burst/v1/data/ecommerce/sales' ) as { data: Record<string, { label?: string }> };
	assert.ok( salesMock.data.revenue?.label, 'Sales mock uses the keyed metric shape of Sales::get_data()' );
});

// Interactive mock data: responses follow what the visitor does in the dashboard.

type Row = Record<string, unknown>;
type Mock = { request_success: boolean; data: unknown; [ key: string ]: unknown };

const mock = ( path: string, method = 'GET', body: Row = {}) => {
	mockWindow.__burst_is_tour_active = () => true;
	const response = ( getFrontendTourMockData as ( p: string, m?: string, b?: Row ) => unknown )( path, method, body ) as Mock | null;
	assert.ok( null !== response, `${ path } should be mocked` );
	return response as Mock;
};

const withFilters = ( path: string, filters: Row ) =>
	`${ path }${ path.includes( '?' ) ? '&' : '?' }filters=${ encodeURIComponent( JSON.stringify( filters ) ) }`;

const datatable = ( id: string, metrics: string[], extra = '' ) =>
	`burst/v1/data/datatable/${ id }?${ metrics.map( ( m ) => `metrics[]=${ m }` ).join( '&' ) }${ extra }`;

const sum = ( rows: Row[], key: string ) => rows.reduce( ( total, row ) => total + Number( row[ key ] ?? 0 ), 0 );

test( 'live traffic returns 18 visitors, stable between refetches', () => {
	const first = mock( 'burst/v1/data/live-traffic?nonce=a' ).data as Row[];
	const second = mock( 'burst/v1/data/live-traffic?nonce=b' ).data as Row[];
	assert.strictEqual( first.length, 18 );
	assert.deepStrictEqual( first, second );
	for ( const row of first ) {
		assert.ok( row.uid && row.page_url && row.active_time, 'Each row has uid, page and activity time' );
	}
});

test( '404 referrers add up to the page hits', () => {
	const data = mock( 'burst/v1/data/not_found_page_referrers?page_url=%2Fold-pricing-2024' ).data as {
		total_hits: number; no_referrer_hits: number; referrers: Row[]; counts: { all: number };
	};
	assert.ok( 2 <= data.referrers.length );
	assert.strictEqual( sum( data.referrers, 'hits' ) + data.no_referrer_hits, 34 );
	assert.strictEqual( data.counts.all, data.referrers.length );
});

test( 'predefined goals are listed and adding one keeps it after a refetch', () => {
	const goals = mock( 'burst/v1/goals/get?nonce=a' ) as unknown as { predefinedGoals: Row[]; goals: Row[] };
	assert.ok( 4 <= goals.predefinedGoals.length );

	const added = mock( 'burst/v1/goals/add_predefined?nonce=a', 'POST', { id: 'edd_complete_purchase' }) as unknown as { goal: Row };
	assert.match( String( added.goal.title ), /Easy Digital Downloads/ );

	const after = mock( 'burst/v1/goals/get?nonce=b' ) as unknown as { goals: Row[] };
	assert.ok( after.goals.some( ( goal ) => goal.id === added.goal.id ) );
});

test( 'products table adds up to the Sales block totals', () => {
	const table = mock( 'burst/v1/data/ecommerce/datatable/sales_products?metrics[]=product&metrics[]=sales&metrics[]=revenue' ).data as { columns: Row[]; data: Row[] };
	const sales = ( mock( 'burst/v1/data/ecommerce/sales' ).data as { revenue: { current: { total_revenue: number; total_orders: number } } }).revenue.current;
	assert.deepStrictEqual( table.columns.map( ( c ) => c.id ), [ 'product', 'sales', 'revenue' ]);
	assert.strictEqual( table.data.length, 4 );
	assert.strictEqual( sum( table.data, 'revenue' ), sales.total_revenue );
	assert.strictEqual( sum( table.data, 'sales' ), sales.total_orders );
});

test( 'previous period adds a comparison series to the sales and insights charts', () => {
	const plain = mock( 'burst/v1/data/ecommerce/sales-chart?chart_mode=revenue' ).data as { datasets: Row[] };
	assert.strictEqual( plain.datasets.length, 1 );

	const compared = mock( 'burst/v1/data/ecommerce/sales-chart?chart_mode=revenue&compare_mode=previous_period' ).data as { datasets: Array<{ data: number[]; is_comparison: boolean; compare_mode?: string }> };
	assert.strictEqual( compared.datasets.length, 2 );
	assert.strictEqual( compared.datasets[ 1 ].is_comparison, true );
	assert.strictEqual( compared.datasets[ 1 ].compare_mode, 'previous_period' );
	assert.notDeepStrictEqual( compared.datasets[ 1 ].data, compared.datasets[ 0 ].data );

	const insights = mock( 'burst/v1/data/insights?metrics[]=visitors&compare_mode=previous_period' ).data as { datasets: Row[] };
	assert.strictEqual( insights.datasets.length, 2 );
	assert.strictEqual( insights.datasets[ 1 ].is_comparison, true );

	const multi = mock( 'burst/v1/data/insights?metrics[]=visitors&metrics[]=pageviews&compare_mode=previous_period' ).data as { datasets: Row[] };
	assert.strictEqual( multi.datasets.length, 2, 'No comparison line with more than one metric' );
});

test( 'reading engagement "lowest" returns the lowest scores first', () => {
	const top = mock( 'burst/v1/data/reading_engagement?least_engagement=false' ).data as Array<{ reading_engagement_score: number; page_url: string }>;
	const lowest = mock( 'burst/v1/data/reading_engagement?least_engagement=true' ).data as Array<{ reading_engagement_score: number; page_url: string }>;
	assert.ok( top[ 0 ].reading_engagement_score > lowest[ 0 ].reading_engagement_score );
	assert.ok( lowest[ 0 ].reading_engagement_score <= lowest[ 1 ].reading_engagement_score );
	assert.notDeepStrictEqual( top.map( ( r ) => r.page_url ), lowest.map( ( r ) => r.page_url ) );
});

test( 'device filter options load without a search term', () => {
	const response = mock( 'burst/v1/get_action/get_filter_options?nonce=a&data_type=devices&search=undefined' ).data as { devices: Row[] };
	assert.deepStrictEqual( response.devices.map( ( d ) => d.ID ), [ 'desktop', 'mobile', 'tablet' ]);

	for ( const type of [ 'pages', 'referrers', 'campaigns', 'countries', 'states', 'cities', 'browsers', 'platforms', 'hosts', 'mediums', 'terms', 'contents', 'sources', 'traffic_sources', 'source_categories', 'continents' ]) {
		const options = mock( `burst/v1/get_action/get_filter_options?data_type=${ type }&search=` ).data as Record<string, Row[]>;
		assert.ok( 0 < options[ type ].length, `${ type } filter has options` );
	}
});

test( 'filters change the numbers consistently across blocks', () => {
	const mobile = { device_id: 'mobile' };
	const compare = ( mock( 'burst/v1/data/compare' ).data as { current: { visitors: number; bounce_rate: number } }).current;
	const compareMobile = ( mock( withFilters( 'burst/v1/data/compare', mobile ) ).data as { current: { visitors: number; bounce_rate: number } }).current;
	assert.strictEqual( compareMobile.visitors, Math.round( compare.visitors * 0.31 ), 'Mobile is 31% of visitors, as in the devices block' );
	assert.strictEqual( compareMobile.bounce_rate, compare.bounce_rate, 'Rates do not scale' );

	const devices = mock( withFilters( 'burst/v1/data/devices', mobile ) ).data as Record<string, { count: number }>;
	assert.strictEqual( devices.desktop.count, 0 );
	assert.strictEqual( devices.mobile.count, devices.all.count );

	const pages = mock( datatable( 'statistics_pages', [ 'page_url', 'visitors' ]) ).data as { data: Row[] };
	const pagesMobile = mock( withFilters( datatable( 'statistics_pages', [ 'page_url', 'visitors' ]), mobile ) ).data as { data: Row[] };
	assert.ok( sum( pagesMobile.data, 'visitors' ) < sum( pages.data, 'visitors' ) );

	const pageFiltered = mock( withFilters( datatable( 'statistics_pages', [ 'page_url', 'visitors' ]), { page_url: '/pricing' }) ).data as { data: Row[] };
	assert.deepStrictEqual( pageFiltered.data.map( ( r ) => r.page_url ), [ '/pricing' ]);

	const insights = mock( 'burst/v1/data/insights?metrics[]=visitors' ).data as { datasets: Array<{ data: number[] }> };
	const insightsPricing = mock( withFilters( 'burst/v1/data/insights?metrics[]=visitors', { page_url: '/pricing' }) ).data as { datasets: Array<{ data: number[] }> };
	assert.ok( insightsPricing.datasets[ 0 ].data[ 0 ] < insights.datasets[ 0 ].data[ 0 ]);

	const countries = mock( withFilters( datatable( 'sources_countries', [ 'country_code', 'visitors' ], '&group_by[]=country_code' ), { country_code: 'NL' }) ).data as { data: Row[] };
	assert.deepStrictEqual( countries.data.map( ( r ) => r.country_code ), [ 'NL' ]);

	const excluded = ( mock( withFilters( 'burst/v1/data/compare', { device_id: '!mobile' }) ).data as { current: { visitors: number } }).current;
	assert.strictEqual( excluded.visitors, Math.round( compare.visitors * 0.69 ) );
});

test( 'datatable columns follow the requested metrics', () => {
	const table = mock( datatable( 'statistics_pages', [ 'page_url', 'pageviews', 'entrances', 'exit_rate' ]) ).data as { columns: Row[]; data: Row[] };
	assert.deepStrictEqual( table.columns.map( ( c ) => c.id ), [ 'page_url', 'pageviews', 'entrances', 'exit_rate' ]);
	assert.ok( table.data.every( ( row ) => undefined !== row.entrances && undefined !== row.exit_rate ) );
});

test( 'Pro referrer rows are expandable and expand into their raw referrers', () => {
	const table = mock( datatable( 'statistics_referrers', [ 'source', 'source_category', 'visitors' ], '&group_by[]=source&group_by[]=source_category' ) ).data as { data: Row[] };
	const google = table.data.find( ( row ) => 'Google' === row.source ) as Row;
	assert.strictEqual( google.source_category, 'search', 'Search rows can expand (not referral or direct)' );

	const children = mock( 'burst/v1/data/source-referrers?source=Google' ).data as { data: Row[] };
	assert.ok( 2 <= children.data.length );
	assert.strictEqual( sum( children.data, 'visitors' ), google.visitors );
});

test( 'world map drills down into states for a country', () => {
	const world = mock( 'burst/v1/data/geo' ).data as Row[];
	assert.ok( world.some( ( row ) => 'US' === row.country_code ) );

	for ( const code of [ 'US', 'DE', 'NL', 'GB' ]) {
		const view = encodeURIComponent( JSON.stringify({ level: 'country', id: code }) );
		const states = mock( `burst/v1/data/geo?currentView=${ view }` ).data as Row[];
		const country = world.find( ( row ) => code === row.country_code ) as Row;
		assert.ok( 3 <= states.length, `${ code } has states` );
		assert.ok( states.every( ( row ) => row.state_code && code === row.country_code ) );
		assert.strictEqual( sum( states, 'visitors' ), country.visitors );
	}

	const cities = mock( datatable( 'sources_countries', [ 'country_code', 'state', 'city', 'visitors' ], '&group_by[]=country_code&group_by[]=state&group_by[]=city' ) ).data as { data: Row[] };
	assert.ok( cities.data.some( ( row ) => 'Amsterdam' === row.city ) );
});

test( 'the same request gives the same response', () => {
	const path = withFilters( datatable( 'statistics_referrers', [ 'source', 'visitors' ], '&group_by[]=source' ), { device_id: 'mobile' });
	assert.deepStrictEqual( mock( path ), mock( path ) );
});
