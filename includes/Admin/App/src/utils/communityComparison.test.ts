import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getDeviceComparison,
	getMetricComparison,
	getPageWeightComparison
} from './communityComparison';
import type { BurstCommunityData } from '@/types/burst-settings';

const percentiles = { p5: 10, p10: 20, p25: 30, p50: 40, p75: 50, p90: 60, p95: 70 };

const communityData: BurstCommunityData = {
	range: { min: 5001, max: 10000 },
	sample_size: 41,
	bounce_rate: { percentiles, average: 40 },
	pageviews_per_session: { percentiles, average: 40 },
	new_visitors_percentage: { average: 62.5 },
	devices: { desktop: 55, tablet: 5, mobile: 38, other: 2 }
};

test( 'metric comparison is disabled and links to settings when data sharing is off', () => {
	const comparison = getMetricComparison( false, communityData, 'bounce_rate', 40 );
	assert.strictEqual( comparison.state, 'disabled' );
	assert.match( comparison.text, /turn on sharing anonymous usage data/ );
});

test( 'metric comparison is pending when sharing is on but no community data has arrived', () => {
	assert.strictEqual( getMetricComparison( true, null, 'bounce_rate', 40 ).state, 'pending' );
	assert.strictEqual( getMetricComparison( true, undefined, 'bounce_rate', 40 ).state, 'pending' );
	assert.strictEqual(
		getMetricComparison( true, { range: { min: 0, max: 100 }, sample_size: 2, insufficient_data: true }, 'bounce_rate', 40 ).state,
		'pending'
	);
});

test( 'metric comparison is pending when only this metric is missing', () => {
	const comparison = getMetricComparison( true, communityData, 'average_time_on_page', 40 );
	assert.strictEqual( comparison.state, 'pending' );
	assert.match( comparison.text, /No comparison for this metric yet/ );
});

test( 'pending comparison without community data says the first comparison arrives after a month of tracking', () => {
	assert.match( getMetricComparison( true, null, 'bounce_rate', 40 ).text, /after a month of tracking/ );
});

test( 'metric comparison is active with the percentage in its text when the metric is available', () => {
	const comparison = getMetricComparison( true, communityData, 'pageviews_per_session', 40 );
	assert.strictEqual( comparison.state, 'active' );
	assert.strictEqual(
		comparison.text,
		'Your site performs better than 50% of websites with similar traffic. Based on websites with 5K–10K visitors a month.'
	);

	// No visible rank: the comparison only carries its state and tooltip text.
	assert.deepStrictEqual( Object.keys( comparison ).sort(), [ 'state', 'text' ]);
});

test( 'metric comparison inverts the rank when lower is better', () => {
	const comparison = getMetricComparison( true, communityData, 'bounce_rate', 20 );
	assert.match( comparison.text, /^Your site performs better than 90% of websites with similar traffic\. / );
});

test( 'metric comparison names the peer group, also for open-ended and lowest visitor ranges', () => {
	const topRange = getMetricComparison(
		true,
		{ ...communityData, range: { min: 100001, max: null }, sample_size: 1500 },
		'bounce_rate',
		40
	);
	assert.match( topRange.text, /Based on websites with more than 100K visitors a month\.$/ );

	const lowestRange = getMetricComparison(
		true,
		{ ...communityData, range: { min: 0, max: 1000 } },
		'bounce_rate',
		40
	);
	assert.match( lowestRange.text, /Based on websites with up to 1K visitors a month\.$/ );
});

test( 'metric comparison names all Burst websites for a metric filled from all sites', () => {
	const comparison = getMetricComparison(
		true,
		{ ...communityData, fallback_metrics: [ 'pageviews_per_session', 'new_visitors_percentage' ] },
		'pageviews_per_session',
		40
	);
	assert.strictEqual(
		comparison.text,
		'Your site performs better than 50% of websites using Burst. Too few websites with similar traffic share data yet, so this compares with all websites using Burst.'
	);

	const average = getMetricComparison(
		true,
		{ ...communityData, fallback_metrics: [ 'new_visitors_percentage' ] },
		'new_visitors_percentage',
		0
	);
	assert.strictEqual( average.state, 'active' );
	assert.match( average.text, /^Websites using Burst average .+% new visitors\. Too few websites/ );
});

test( 'new visitors comparison shows the community average', () => {
	const comparison = getMetricComparison( true, communityData, 'new_visitors_percentage', 0 );
	assert.strictEqual( comparison.state, 'active' );
	assert.match( comparison.text, /^Websites with similar traffic average .+% new visitors\. Based on websites with / );
});

test( 'device comparison follows the same states', () => {
	assert.strictEqual( getDeviceComparison( false, communityData, 'mobile', 'Mobile' ).state, 'disabled' );
	assert.strictEqual( getDeviceComparison( true, null, 'mobile', 'Mobile' ).state, 'pending' );

	const comparison = getDeviceComparison( true, communityData, 'mobile', 'Mobile' );
	assert.strictEqual( comparison.state, 'active' );
	assert.strictEqual(
		comparison.text,
		'Community average: 38.0% of visitors use mobile. Based on websites with 5K–10K visitors a month.'
	);
});

test( 'metric comparison is pending when the percentiles cannot produce a rank', () => {
	const unsorted = { ...communityData, bounce_rate: { percentiles: { ...percentiles, p10: 5 }, average: 40 } };
	assert.strictEqual( getMetricComparison( true, unsorted, 'bounce_rate', 40 ).state, 'pending' );

	const flat = { p5: 3, p10: 3, p25: 3, p50: 3, p75: 3, p90: 3, p95: 3 };
	const flatData = { ...communityData, bounce_rate: { percentiles: flat, average: 3 } };
	assert.match(
		getMetricComparison( true, flatData, 'bounce_rate', 10 ).text,
		/^Your site performs better than 50% of websites with similar traffic\. /
	);
});

test( 'a filtered view gets a greyed-out comparison that explains why', () => {
	const state = ( filters: Record<string, string> | undefined ) =>
		getMetricComparison( true, communityData, 'bounce_rate', 40, filters ).state;

	assert.strictEqual( state( undefined ), 'active' );
	assert.strictEqual( state({}), 'active' );
	assert.strictEqual( state({ country_code: '' }), 'active' );

	// A goal filter picks the goal whose conversion rate is compared.
	assert.strictEqual( state({ goal_id: '3' }), 'active' );

	assert.strictEqual( state({ country_code: 'NL' }), 'filtered' );
	assert.strictEqual( state({ page_url: '/about/' }), 'filtered' );
	assert.strictEqual( state({ device_id: '!1' }), 'filtered' );
	assert.strictEqual( state({ goal_id: '3', referrer: 'google.com' }), 'filtered' );

	const comparison = getMetricComparison( true, communityData, 'bounce_rate', 40, { referrer: 'google.com' });
	assert.match( comparison.text, /^No comparison for a filtered view/ );
	assert.match( comparison.text, /Remove the filters to compare\.$/ );
	assert.strictEqual( getDeviceComparison( true, communityData, 'mobile', 'Mobile', { referrer: 'google.com' }).state, 'filtered' );
});

test( 'without data sharing a filtered view still links to the setting', () => {
	assert.strictEqual( getMetricComparison( false, communityData, 'bounce_rate', 40, { referrer: 'google.com' }).state, 'disabled' );
	assert.strictEqual( getDeviceComparison( false, communityData, 'mobile', 'Mobile', { referrer: 'google.com' }).state, 'disabled' );
});

test( 'a filtered view is reported before missing community data', () => {
	assert.strictEqual( getMetricComparison( true, null, 'bounce_rate', 40, { referrer: 'google.com' }).state, 'filtered' );
});

test( 'page weight comparison ranks the weight and adds the CO2 rank, where lighter is better', () => {
	const pageWeightData: BurstCommunityData = {
		...communityData,
		average_page_weight: { percentiles: { p5: 500, p10: 600, p25: 800, p50: 1000, p75: 1500, p90: 2000, p95: 3000 }, average: 1100 },
		co2_per_pageview: { percentiles: { p5: 0.05, p10: 0.08, p25: 0.1, p50: 0.2, p75: 0.3, p90: 0.4, p95: 0.5 }, average: 0.2 }
	};

	const comparison = getPageWeightComparison( true, pageWeightData, 600, 0.1 );
	assert.strictEqual( comparison.state, 'active' );
	assert.match( comparison.text, /^Your pages are lighter than 90% of websites with similar traffic\. Each pageview causes less CO2 than on 75% of websites with similar traffic\. Based on websites with 5K–10K visitors a month\.$/ );

	const heavy = getPageWeightComparison( true, pageWeightData, 3000, 0.5 );
	assert.match( heavy.text, /^Your pages are lighter than 5% of websites with similar traffic\. Each pageview causes less CO2 than on 5% / );
});

test( 'page weight comparison leaves out CO2 when the community has no CO2 figure', () => {
	const weightOnly: BurstCommunityData = {
		...communityData,
		average_page_weight: { percentiles, average: 40 }
	};

	const comparison = getPageWeightComparison( true, weightOnly, 40, 0.1 );
	assert.strictEqual( comparison.state, 'active' );
	assert.doesNotMatch( comparison.text, /CO2/ );
});

test( 'page weight comparison follows the shared states', () => {
	const weightOnly: BurstCommunityData = {
		...communityData,
		average_page_weight: { percentiles, average: 40 }
	};

	assert.strictEqual( getPageWeightComparison( false, weightOnly, 40, 0.1 ).state, 'disabled' );
	assert.strictEqual( getPageWeightComparison( true, null, 40, 0.1 ).state, 'pending' );
	assert.strictEqual( getPageWeightComparison( true, weightOnly, 40, 0.1, { page_url: '/pricing/' }).state, 'filtered' );

	// Community data without a page weight distribution yet.
	const missing = getPageWeightComparison( true, communityData, 600, 0.1 );
	assert.strictEqual( missing.state, 'pending' );
	assert.match( missing.text, /No comparison for this metric yet/ );
});

test( 'store metrics rank conversion up and abandoned carts and revenue churn down', () => {
	const storeData: BurstCommunityData = {
		...communityData,
		ecommerce_conversion_rate: { percentiles: { p5: 0.2, p10: 0.5, p25: 1, p50: 2, p75: 3, p90: 4, p95: 5 }, average: 2 },
		abandoned_cart_rate: { percentiles: { p5: 40, p10: 50, p25: 60, p50: 70, p75: 80, p90: 85, p95: 90 }, average: 70 },
		revenue_churn: { percentiles: { p5: 0.5, p10: 1, p25: 2, p50: 4, p75: 6, p90: 8, p95: 10 }, average: 4 }
	};

	assert.match( getMetricComparison( true, storeData, 'ecommerce_conversion_rate', 4 ).text, /better than 90% of websites with similar traffic/ );
	assert.match( getMetricComparison( true, storeData, 'abandoned_cart_rate', 50 ).text, /better than 90% / );
	assert.match( getMetricComparison( true, storeData, 'abandoned_cart_rate', 90 ).text, /better than 5% / );
	assert.match( getMetricComparison( true, storeData, 'revenue_churn', 2 ).text, /^Your site performs better than 75% of websites with similar traffic\./ );
});

test( 'store metrics stay pending until the community reports them', () => {
	assert.strictEqual( getMetricComparison( true, communityData, 'revenue_churn', 2 ).state, 'pending' );
});
