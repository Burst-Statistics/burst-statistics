import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getDeviceComparison,
	getMetricComparison
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
	assert.match( comparison.text, /Data sharing is off/ );
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
	assert.match( comparison.text, /next monthly sync/ );
});

test( 'metric comparison is active with a rank when the metric is available', () => {
	const comparison = getMetricComparison( true, communityData, 'pageviews_per_session', 40 );
	assert.strictEqual( comparison.state, 'active' );
	assert.strictEqual( comparison.text, 'Your site performs better than 50% of websites with similar traffic.' );
});

test( 'metric comparison inverts the rank when lower is better', () => {
	const comparison = getMetricComparison( true, communityData, 'bounce_rate', 20 );
	assert.strictEqual( comparison.text, 'Your site performs better than 90% of websites with similar traffic.' );
});

test( 'metric comparison names all Burst websites for a metric filled from all sites', () => {
	const comparison = getMetricComparison(
		true,
		{ ...communityData, fallback_metrics: [ 'pageviews_per_session', 'new_visitors_percentage' ] },
		'pageviews_per_session',
		40
	);
	assert.strictEqual( comparison.text, 'Your site performs better than 50% of websites using Burst.' );

	const average = getMetricComparison(
		true,
		{ ...communityData, fallback_metrics: [ 'new_visitors_percentage' ] },
		'new_visitors_percentage',
		0
	);
	assert.strictEqual( average.state, 'active' );
	assert.match( average.text, /^Websites using Burst average .+% new visitors\.$/ );
});

test( 'new visitors comparison shows the community average', () => {
	const comparison = getMetricComparison( true, communityData, 'new_visitors_percentage', 0 );
	assert.strictEqual( comparison.state, 'active' );
	assert.match( comparison.text, /^Websites with similar traffic average .+% new visitors\.$/ );
});

test( 'device comparison follows the same states', () => {
	assert.strictEqual( getDeviceComparison( false, communityData, 'mobile', 'Mobile' ).state, 'disabled' );
	assert.strictEqual( getDeviceComparison( true, null, 'mobile', 'Mobile' ).state, 'pending' );

	const comparison = getDeviceComparison( true, communityData, 'mobile', 'Mobile' );
	assert.strictEqual( comparison.state, 'active' );
	assert.strictEqual( comparison.text, 'Community average: 38.0% of visitors use mobile.' );
});

test( 'metric comparison is pending when the percentiles cannot produce a rank', () => {
	const unsorted = { ...communityData, bounce_rate: { percentiles: { ...percentiles, p10: 5 }, average: 40 } };
	assert.strictEqual( getMetricComparison( true, unsorted, 'bounce_rate', 40 ).state, 'pending' );

	const flat = { p5: 3, p10: 3, p25: 3, p50: 3, p75: 3, p90: 3, p95: 3 };
	const flatData = { ...communityData, bounce_rate: { percentiles: flat, average: 3 } };
	assert.strictEqual(
		getMetricComparison( true, flatData, 'bounce_rate', 10 ).text,
		'Your site performs better than 50% of websites with similar traffic.'
	);
});
