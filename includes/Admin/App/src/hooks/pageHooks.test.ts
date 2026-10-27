import assert from 'node:assert/strict';
import test from 'node:test';
import { getComparisonDates, getEmptyCompareData } from '@/utils/comparisonDates';
import { DEFAULT_INSIGHTS_PLACEHOLDER_DATA } from '@/utils/insightsPlaceholders';

test( 'getComparisonDates calculates previous period of equal length', () => {
	const dates = getComparisonDates( '2026-09-01', '2026-09-30', 'previous_period' );
	assert.strictEqual( dates.compareEnd, '2026-08-31' );
	assert.strictEqual( dates.compareStart, '2026-08-02' );
});

test( 'getComparisonDates calculates year over year window', () => {
	const dates = getComparisonDates( '2026-09-01', '2026-09-30', 'year_over_year' );
	assert.strictEqual( dates.compareStart, '2025-09-01' );
	assert.strictEqual( dates.compareEnd, '2025-09-30' );
});

test( 'getEmptyCompareData generates standard and page comparison metrics structure', () => {
	const standard = getEmptyCompareData( false );
	assert.ok( standard.pageviews );
	assert.ok( standard.visitors );
	assert.ok( standard.bounce_rate );
	assert.ok( standard.avg_time_on_page );
	assert.strictEqual( standard.reading_engagement_score, undefined );

	const withPage = getEmptyCompareData( true );
	assert.ok( withPage.pageviews );
	assert.ok( withPage.visitors );
	assert.ok( withPage.reading_engagement_score );
	assert.ok( withPage.conversions );
	assert.strictEqual( withPage.avg_time_on_page, undefined );
});

test( 'DEFAULT_INSIGHTS_PLACEHOLDER_DATA has valid structure for fallback rendering', () => {
	assert.strictEqual( DEFAULT_INSIGHTS_PLACEHOLDER_DATA.timestamps.length, 7 );
	assert.strictEqual( DEFAULT_INSIGHTS_PLACEHOLDER_DATA.datasets.length, 2 );
	assert.strictEqual( DEFAULT_INSIGHTS_PLACEHOLDER_DATA.datasets[ 0 ].data.length, 7 );
});
