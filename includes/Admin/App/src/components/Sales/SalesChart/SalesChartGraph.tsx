import { useMemo, useCallback } from 'react';
import { ResponsiveLine } from '@nivo/line';
import type { LineCustomSvgLayerProps, LineSvgLayer, SliceTooltipProps } from '@nivo/line';
import { SalesChartTooltip } from './SalesChartTooltip';
import { formatAxisLabel, formatCurrencyCompact, formatNumber, getChartXAxisTickValues } from '@/utils/formatting';
import { LINE_CHART_AXIS_BASE, LINE_CHART_BASE_PROPS, buildLineChartLayers } from '@/components/Common/nivoLineConfig';
import { SALES_CHART_COLORS } from './salesChartData';
import type { SalesChartSeries } from './salesChartData';
import type { SalesChartData } from '@/types/api-endpoints';

interface SalesChartGraphProps {
	data: SalesChartData;
	mode: 'revenue' | 'sales';
	currency: string;
	actualLabel?: string;
}

/**
 * Transforms the sales chart API response into Nivo line series.
 *
 * The forecast dataset carries its own future timestamps, while historical
 * and comparison datasets share the historical timestamps.
 *
 * @param payload - API response with timestamps and datasets.
 * @return Nivo-compatible line series array.
 */
function transformToNivoFormat( payload: SalesChartData ): SalesChartSeries[] {
	return payload.datasets.map(

		// fallow-ignore-next-line complexity
		( dataset, i ) => {
		const isComparison = Boolean( dataset.is_comparison );
		const isForecast = Boolean( dataset.is_forecast );

		// A comparison line extended across the forecast window carries its
		// own x positions; other datasets share the historical timestamps.
		const xTimestamps = isForecast ?
			( dataset.forecast_timestamps ?? []) :
			( dataset.x_timestamps ?? payload.timestamps );

		let color: string = SALES_CHART_COLORS.primary;
		let variant = 'sales';
		if ( isComparison ) {
			color = SALES_CHART_COLORS.comparison;
			variant = 'comparison';
		}
		if ( isForecast ) {
			color = SALES_CHART_COLORS.forecast;
			variant = 'forecast';
		}

		return {
			id: `${ i }_${ variant }`,
			color,

			// fallow-ignore-next-line complexity
			data: xTimestamps.map( ( ts, j ) => {
				const compareTs = dataset.comparison_timestamps?.[ j ];
				const value = dataset.data[ j ];
				return {
					x: new Date( ts * 1000 ),

					// Null means "no data for this bucket": preserved so the
					// line renders a gap instead of a false zero.
					y: null === value || undefined === value ? null : value,
					isComparison,
					isForecast,
					isBridge: isForecast && Boolean( dataset.has_bridge_point ) && 0 === j,
					compareDate: compareTs ? new Date( compareTs * 1000 ) : null,
					compareMode: dataset.compare_mode ?? null
				};
			})
		};
	});
}

/**
 * Custom Nivo layer rendering each series as an SVG path, dashing the
 * comparison and forecast series so they are visually distinct from actuals.
 *
 * @param props - Nivo custom layer render props.
 * @return SVG paths, one per series.
 */
function CustomLines({ series, lineGenerator, xScale, yScale }: LineCustomSvgLayerProps<SalesChartSeries> ): JSX.Element {
	return (
		<>
			{ series.map(

				// fallow-ignore-next-line complexity
				( s ) => {
				const firstPoint = s.data[ 0 ]?.data;
				const isDashed = Boolean(
					firstPoint?.isComparison || firstPoint?.isForecast
				);

				// Null values are gaps: split the series into contiguous
				// segments so the line breaks where data is missing instead
				// of drawing a false zero.
				type SeriesPoint = ( typeof s.data )[number];
				const segments: SeriesPoint[][] = [];
				let current: SeriesPoint[] = [];
				for ( const point of s.data ) {
					if ( null === point.data.y ) {
						if ( 0 < current.length ) {
							segments.push( current );
						}
						current = [];
						continue;
					}
					current.push( point );
				}
				if ( 0 < current.length ) {
					segments.push( current );
				}

				return segments.map( ( segment, segmentIndex ) => (
					<path
						key={ `line-${ s.id }-${ segmentIndex }` }
						d={ lineGenerator(
							segment.map( ( d ) => ({
								x: xScale( d.data.x ),
								y: yScale( d.data.y as number )
							}) )
						) ?? undefined }
						fill="none"
						stroke={ s.color }
						strokeWidth={ 3 }
						strokeDasharray={ isDashed ? '6 4' : undefined }
					/>
				) );
			}) }
		</>
	);
}

/**
 * SalesChartGraph renders historical and optional future Sales series.
 *
 * @param props - Component props: API payload, chart mode and currency.
 * @return The rendered line chart.
 */
const SalesChartGraph = ({
	data,
	mode,
	currency,
	actualLabel
}: SalesChartGraphProps ): JSX.Element => {
	const { interval, spans_multiple_years: spansMultipleYears } = data;
	const isRevenueMode = 'sales' !== mode;

	const nivoData = useMemo( () => transformToNivoFormat( data ), [ data ]);

	const allDates = useMemo( () => {
		const forecastDataset = data.datasets.find(
			( dataset ) => dataset.is_forecast
		);

		return [
			...data.timestamps,
			...( forecastDataset?.forecast_timestamps ?? [])
		].map( ( ts ) => new Date( ts * 1000 ) );
	}, [ data ]);

	const xTickValues = useMemo(
		() => getChartXAxisTickValues( allDates ),
		[ allDates ]
	);

	const formatTick = useCallback(
		( value: Date | number ) => {
			const ts = value instanceof Date ? value.getTime() / 1000 : Number( value ) / 1000;
			return formatAxisLabel( ts, interval, spansMultipleYears );
		},
		[ interval, spansMultipleYears ]
	);

	const formatValueTick = useCallback(
		( value: number ) => isRevenueMode ?
			formatCurrencyCompact( currency, Number( value ), { currencyDisplay: 'narrowSymbol' }) :
			formatNumber( Number( value ), 0 ),
		[ isRevenueMode, currency ]
	);

	// Sales counts are integers: when the series maximum is below the default
	// tick count, d3 would pick fractional ticks (0.2, 0.4, …) that all round
	// to the same label. Capping the count at the maximum keeps ticks whole.
	const yTickValues = useMemo( () => {
		if ( isRevenueMode ) {
			return 6;
		}
		const maxValue = Math.max(
			0,
			...nivoData.flatMap( ( s ) =>
				s.data
					.map( ( d ) => d.y )
					.filter( ( value ): value is number => null !== value )
			)
		);
		return Math.max( 1, Math.min( 6, maxValue ) );
	}, [ isRevenueMode, nivoData ]);

	const sliceTooltip = useCallback(
		({ slice }: SliceTooltipProps<SalesChartSeries> ) => (
			<SalesChartTooltip
				slice={ slice }
				interval={ interval }
				mode={ mode }
				currency={ currency }
				actualLabel={ actualLabel }
			/>
		),
		[ interval, mode, currency, actualLabel ]
	);

	// Replace the built-in lines layer so comparison and forecast series can
	// carry their own strokeDasharray.
	const layers = useMemo<LineSvgLayer<SalesChartSeries>[]>(
		() => buildLineChartLayers( CustomLines ),
		[]
	);

	return (
		<ResponsiveLine
			data={ nivoData }
			{ ...LINE_CHART_BASE_PROPS }
			axisBottom={{
				...LINE_CHART_AXIS_BASE,
				tickValues: xTickValues,
				format: formatTick
			}}
			axisLeft={{
				...LINE_CHART_AXIS_BASE,
				tickValues: yTickValues,
				format: formatValueTick
			}}
			gridYValues={ yTickValues }
			sliceTooltip={ sliceTooltip }
			layers={ layers }
		/>
	);
};

export default SalesChartGraph;
