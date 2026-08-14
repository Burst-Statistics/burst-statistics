import type {
	ForecastData,
	ForecastRow,
	SalesChartData,
	SalesChartDataset
} from '@/types/api-endpoints';

interface ComparisonExtensionPoint {
	x: number;
	value: number;
	sourceTimestamp: number;
}

/**
 * Append a separately fetched forecast to a historical line-chart payload.
 *
 * @param history       - Historical chart payload.
 * @param forecast      - Forecast endpoint payload.
 * @param enabled       - Whether the forecast series is enabled.
 * @param forecastLabel - Localized forecast dataset label.
 * @return Historical payload with an optional forecast dataset.
 */
// fallow-ignore-next-line complexity -- Branches are defensive guards on network payloads; the merge logic itself is covered by forecastSeries.test.ts.
export function addForecastDataset(
	history: SalesChartData,
	forecast: ForecastData | undefined,
	enabled: boolean,
	forecastLabel: string
): SalesChartData {
	const rows = Array.isArray( forecast?.rows ) ? forecast.rows : [];

	if ( ! enabled || 0 === rows.length ) {
		return history;
	}

	// The forecast window can cross a calendar-year boundary the selection
	// does not, so recompute the year-suffix flag over the combined range.
	const firstTimestamp = Array.isArray( history.timestamps ) && 0 < history.timestamps.length ?
		Number( history.timestamps[ 0 ]) :
		Number( rows[ 0 ].timestamp );
	const lastForecastTimestamp = Number( rows[ rows.length - 1 ].timestamp );
	const spansMultipleYears = Boolean( history.spans_multiple_years ) ||
		Boolean( forecast?.spans_multiple_years ) ||
		new Date( firstTimestamp * 1000 ).getFullYear() !==
			new Date( lastForecastTimestamp * 1000 ).getFullYear();

	// Start the dashed forecast line at the last measured point, so the solid
	// and dashed lines connect into one continuous line. The bridge point is
	// flagged so tooltips can skip it (it duplicates the actual value).
	const primary = ( Array.isArray( history.datasets ) ? history.datasets : []).find(
		( dataset ) => ! dataset.is_comparison && ! dataset.is_forecast
	);
	const lastHistoryIndex = Array.isArray( history.timestamps ) ?
		history.timestamps.length - 1 :
		-1;
	const lastActualValue = 0 <= lastHistoryIndex ? primary?.data?.[ lastHistoryIndex ] : null;
	const hasBridgePoint = null !== lastActualValue && undefined !== lastActualValue;

	const datasets: SalesChartDataset[] = [
		...( Array.isArray( history.datasets ) ? history.datasets : []),
		{
			data: [
				...( hasBridgePoint ? [ Number( lastActualValue ) ] : []),
				...rows.map( ( row ) => Number( row.value ?? 0 ) )
			],
			label: forecastLabel,
			metric_key: history.mode,
			is_comparison: false,
			is_forecast: true,
			...( hasBridgePoint ? { has_bridge_point: true } : {}),
			forecast_timestamps: [
				...( hasBridgePoint ? [ Number( history.timestamps[ lastHistoryIndex ]) ] : []),
				...rows.map( ( row ) => Number( row.timestamp ) )
			]
		}
	];

	const comparisonIndex = datasets.findIndex( ( dataset ) => dataset.is_comparison );
	if ( -1 !== comparisonIndex ) {
		datasets[ comparisonIndex ] = extendComparisonDataset(
			datasets[ comparisonIndex ],
			history,
			forecast,
			rows
		);
	}

	return {
		...history,
		spans_multiple_years: spansMultipleYears,
		datasets
	};
}

/**
 * Extend a comparison dataset across the forecast window.
 *
 * The forecast months have known comparison values too: for year-over-year
 * the backend supplies the measured same-month-last-year totals (null where
 * history does not reach, so the line stops there); for previous-period the
 * previous period of the forecast window is the displayed selection itself.
 *
 * @param comparison   - Comparison dataset from the historical payload.
 * @param history      - Historical chart payload.
 * @param forecast     - Forecast endpoint payload.
 * @param forecastRows - Forecast rows being appended.
 * @return Comparison dataset, extended when values are available.
 */
// fallow-ignore-next-line complexity -- Covered by forecastSeries.test.ts; the two compare-mode branches share the extension plumbing.
function extendComparisonDataset(
	comparison: SalesChartDataset,
	history: SalesChartData,
	forecast: ForecastData | undefined,
	forecastRows: ForecastRow[]
): SalesChartDataset {
	const baseTimestamps = Array.isArray( history.timestamps ) ? history.timestamps : [];
	const extension: ComparisonExtensionPoint[] = [];

	if ( 'year_over_year' === comparison.compare_mode ) {
		const valuesByTimestamp = new Map<number, number | null>(
			( Array.isArray( forecast?.comparison_rows ) ? forecast.comparison_rows : []).map(
				( row ) => [ Number( row.timestamp ), row.value ]
			)
		);

		for ( const row of forecastRows ) {
			const timestamp = Number( row.timestamp );
			const value = valuesByTimestamp.get( timestamp );
			if ( null === value || undefined === value ) {
				continue;
			}

			const sourceDate = new Date( timestamp * 1000 );
			sourceDate.setFullYear( sourceDate.getFullYear() - 1 );
			extension.push({
				x: timestamp,
				value: Number( value ),
				sourceTimestamp: Math.round( sourceDate.getTime() / 1000 )
			});
		}
	} else {

		// Previous period of the forecast window is the displayed selection.
		const primary = ( Array.isArray( history.datasets ) ? history.datasets : []).find(
			( dataset ) => ! dataset.is_comparison && ! dataset.is_forecast
		);

		forecastRows.forEach( ( row, index ) => {
			const value = primary?.data?.[ index ];
			if ( null === value || undefined === value ) {
				return;
			}

			extension.push({
				x: Number( row.timestamp ),
				value: Number( value ),
				sourceTimestamp: Number( baseTimestamps[ index ] ?? null )
			});
		});
	}

	if ( 0 === extension.length ) {
		return comparison;
	}

	const baseData = Array.isArray( comparison.data ) ? comparison.data : [];
	const baseComparisonTimestamps = Array.isArray( comparison.comparison_timestamps ) ?
		comparison.comparison_timestamps :
		baseTimestamps.map( () => null );

	return {
		...comparison,
		x_timestamps: [ ...baseTimestamps, ...extension.map( ( point ) => point.x ) ],
		data: [ ...baseData, ...extension.map( ( point ) => point.value ) ],
		comparison_timestamps: [
			...baseComparisonTimestamps,
			...extension.map( ( point ) => point.sourceTimestamp )
		]
	};
}
