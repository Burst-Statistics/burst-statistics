import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriptionHistoryChartData } from './subscriptionForecastData';

test( 'Subscription history shows renewal values only per bucket', () => {
	const result = buildSubscriptionHistoryChartData(
		{
			interval: 'month',
			spans_multiple_years: true,
			mode: 'revenue',
			currency: 'EUR',
			rows: [
				{ timestamp: 100, newValue: 90, renewalValue: 10 },
				{ timestamp: 200, newValue: 80, renewalValue: 20 }
			]
		},
		'Renewal Revenue',
		'Previous period'
	);

	assert.deepEqual( result, {
		timestamps: [ 100, 200 ],
		interval: 'month',
		spans_multiple_years: true,
		mode: 'revenue',
		currency: 'EUR',
		datasets: [
			{
				data: [ 10, 20 ],
				label: 'Renewal Revenue',
				metric_key: 'revenue',
				is_comparison: false
			}
		]
	});
});

test( 'Malformed Subscription history normalizes to an empty safe payload', () => {
	const result = buildSubscriptionHistoryChartData(
		null,
		'Subscription Revenue',
		'Previous period',
		'revenue'
	);

	assert.deepEqual( result, {
		timestamps: [],
		interval: 'day',
		spans_multiple_years: false,
		mode: 'revenue',
		currency: null,
		datasets: [
			{
				data: [],
				label: 'Subscription Revenue',
				metric_key: 'revenue',
				is_comparison: false
			}
		]
	});
});

test( 'Comparison buckets pad missing entries with null instead of fake zeros', () => {
	const result = buildSubscriptionHistoryChartData(
		{
			interval: 'day',
			spans_multiple_years: false,
			mode: 'revenue',
			currency: 'EUR',
			compareMode: 'previous_period',
			rows: [
				{ timestamp: 100, newValue: 10, renewalValue: 0 },
				{ timestamp: 200, newValue: 20, renewalValue: 0 }
			],
			comparisonRows: [
				{ timestamp: 50, newValue: 5, renewalValue: 1 }
			]
		},
		'Subscription Revenue',
		'Previous period'
	);

	const comparison = result.datasets[ 1 ];

	assert.deepEqual( comparison.data, [ 1, null ]);
	assert.deepEqual( comparison.comparison_timestamps, [ 50, null ]);
	assert.strictEqual( comparison.is_comparison, true );
	assert.strictEqual( comparison.compare_mode, 'previous_period' );
});
