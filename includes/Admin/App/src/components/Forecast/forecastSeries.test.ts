import assert from 'node:assert/strict';
import test from 'node:test';
import { addForecastDataset } from './forecastSeries';
import type {
	ForecastData,
	SalesChartData
} from '@/types/api-endpoints';

const salesHistory: SalesChartData = {
	timestamps: [ 100, 200 ],
	interval: 'day',
	spans_multiple_years: false,
	mode: 'revenue',
	currency: 'EUR',
	datasets: [
		{
			data: [ 10, 20 ],
			label: 'Revenue',
			metric_key: 'revenue',
			is_comparison: false
		}
	]
};

const forecast: ForecastData = {
	interval: 'day',
	spans_multiple_years: false,
	rows: [
		{ timestamp: 300, value: 30 },
		{ timestamp: 400, value: 40 }
	],
	mode: 'revenue',
	currency: 'EUR',
	metadata: {
		growth_rate: 5,
		limited_data: false
	}
};

test( 'disabled forecast leaves Sales history untouched', () => {
	const result = addForecastDataset(
		salesHistory,
		forecast,
		false,
		'Forecast'
	);

	assert.strictEqual( result, salesHistory );
});

test( 'Sales forecast is appended as one timestamped future dataset', () => {
	const result = addForecastDataset(
		salesHistory,
		forecast,
		true,
		'Forecast'
	);

	assert.deepEqual( result.datasets, [
		salesHistory.datasets[ 0 ],
		{
			data: [ 20, 30, 40 ],
			label: 'Forecast',
			metric_key: 'revenue',
			is_comparison: false,
			is_forecast: true,
			has_bridge_point: true,
			forecast_timestamps: [ 200, 300, 400 ]
		}
	]);
	assert.deepEqual( salesHistory.datasets, [ salesHistory.datasets[ 0 ] ]);
});

test( 'previous-year comparison extends across covered forecast months only', () => {
	const januaryTimestamp = Date.UTC( 2027, 0, 1, 12 ) / 1000;
	const februaryTimestamp = Date.UTC( 2027, 1, 1, 12 ) / 1000;
	const historyWithComparison: SalesChartData = {
		...salesHistory,
		datasets: [
			salesHistory.datasets[ 0 ],
			{
				data: [ 5, 15 ],
				label: 'Previous year',
				metric_key: 'revenue',
				is_comparison: true,
				comparison_timestamps: [ 50, 150 ],
				compare_mode: 'year_over_year'
			}
		]
	};
	const result = addForecastDataset(
		historyWithComparison,
		{
			...forecast,
			rows: [
				{ timestamp: januaryTimestamp, value: 30 },
				{ timestamp: februaryTimestamp, value: 40 }
			],
			comparison_rows: [
				{ timestamp: januaryTimestamp, value: 25 },
				{ timestamp: februaryTimestamp, value: null }
			]
		},
		true,
		'Forecast'
	);

	const comparison = result.datasets.find( ( dataset ) => dataset.is_comparison );

	// Only January had last-year coverage: one extension point, February stops the line.
	assert.deepEqual( comparison?.data, [ 5, 15, 25 ]);
	assert.deepEqual( comparison?.x_timestamps, [ 100, 200, januaryTimestamp ]);
	assert.strictEqual( comparison?.comparison_timestamps?.length, 3 );
});

test( 'year-crossing forecast flags the combined range for year labels', () => {
	const decemberTimestamp = Date.UTC( 2026, 11, 15, 12 ) / 1000;
	const januaryTimestamp = Date.UTC( 2027, 0, 15, 12 ) / 1000;
	const result = addForecastDataset(
		{ ...salesHistory, timestamps: [ decemberTimestamp ] },
		{
			...forecast,
			rows: [ { timestamp: januaryTimestamp, value: 30 } ]
		},
		true,
		'Forecast'
	);

	assert.strictEqual( result.spans_multiple_years, true );
});
