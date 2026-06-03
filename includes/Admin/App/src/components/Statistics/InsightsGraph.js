import { useMemo, useCallback } from '@wordpress/element';
import { ResponsiveLine } from '@nivo/line';
import { InsightsTooltip } from './InsightsTooltip';
import { formatAxisLabel, getChartXAxisTickValues } from '@/utils/formatting';
import { METRIC_COLORS } from './insightsConfig';

/**
 * Transforms API response data into the format expected by Nivo ResponsiveLine.
 * Each x value is a JS Date object derived from the corresponding Unix timestamp.
 * Colors are resolved from the design-system METRIC_COLORS map, with the
 * server-provided borderColor used only as a fallback.
 *
 * For comparison datasets (is_comparison: true) the x value uses the current-period
 * timestamp so the series aligns horizontally with the primary line. Each point also
 * carries isComparison, compareDate (the real comparison-period Date), and metric_key
 * so the tooltip can render the correct label and date.
 *
 * @param {Object}   data                    - API response object.
 * @param {Array}    data.datasets            - Dataset definitions with label, data, borderColor, metric_key, is_comparison.
 * @param {number[]} timestamps              - Array of Unix timestamps (UTC seconds) per data point.
 * @return {Array} Nivo-compatible line series array.
 */
function transformToNivoFormat( data, timestamps ) {
	if ( ! data?.datasets || ! timestamps?.length ) {
		return [];
	}

	return data.datasets.map( ( dataset, i ) => {
		const isComparison = Boolean( dataset.is_comparison );
		const metricKey = dataset.metric_key ?? dataset.label ?? String( i );
		const color = isComparison ?
			'var(--color-gray-400)' :
			( METRIC_COLORS[ metricKey ] ?? dataset.borderColor );

		// Always include the array index in the id to guarantee uniqueness across
		// datasets, including placeholder entries that may share the same label.
		const id = isComparison ? `${ i }_${ metricKey }_comparison` : `${ i }_${ metricKey }`;

		return {
			id,
			color,
			data: timestamps.map( ( ts, j ) => {
				const compareTs = dataset.comparison_timestamps?.[ j ];
				return {
					x: new Date( ts * 1000 ),
					y: dataset.data[ j ] ?? 0,
					isComparison,
					metric_key: metricKey,
					compareDate: compareTs ? new Date( compareTs * 1000 ) : null,
					compareMode: dataset.compare_mode ?? null
				};
			})
		};
	});
}

/**
 * Custom Nivo layer that renders each series as an SVG path, applying a dashed
 * stroke to comparison series so they are visually distinct from the primary lines.
 * Uses a Fragment (not a wrapping <g>) so no extra SVG group is introduced into
 * the Nivo layer stack, avoiding potential key collisions at the layer level.
 *
 * @param {Object}   props               - Nivo layer render props.
 * @param {Array}    props.series        - All series computed by Nivo.
 * @param {Function} props.lineGenerator - D3 line generator bound to chart scales.
 * @param {Function} props.xScale        - Nivo x-scale function.
 * @param {Function} props.yScale        - Nivo y-scale function.
 * @return {JSX.Element} SVG paths, one per series.
 */
function CustomLines({ series, lineGenerator, xScale, yScale }) {
	return (
		<>
			{ series.map( ( s ) => (
				<path
					key={ `line-${ s.id }` }
					d={ lineGenerator(
						s.data.map( ( d ) => ({
							x: xScale( d.data.x ),
							y: yScale( d.data.y )
						}) )
					) }
					fill="none"
					stroke={ s.color }
					strokeWidth={ 3 }
					strokeDasharray={ s.data[ 0 ]?.data?.isComparison ? '6 4' : undefined }
				/>
			) ) }
		</>
	);
}

/**
 * InsightsGraph renders the multi-line chart for the Insights block.
 * Accepts raw API data with Unix timestamps and formats the x-axis using
 * native Intl.DateTimeFormat via the insightsDateFormatting utility.
 *
 * @param {Object}   props                    - Component props.
 * @param {Object}   props.data               - API response with datasets.
 * @param {number[]} props.timestamps         - Unix timestamps (UTC seconds) per point.
 * @param {string}   props.interval           - Active grouping: 'hour'|'day'|'week'|'month'|'year'.
 * @param {boolean}  props.spansMultipleYears - Whether the range covers more than one year.
 * @return {JSX.Element} The rendered line chart.
 */
const InsightsGraph = ({ data, timestamps, interval, spansMultipleYears }) => {
	const nivoData = useMemo(
		() => transformToNivoFormat( data, timestamps ),
		[ data, timestamps ]
	);

	const allDates = useMemo(
		() => ( timestamps ?? []).map( ( ts ) => new Date( ts * 1000 ) ),
		[ timestamps ]
	);

	const xTickValues = useMemo(
		() => getChartXAxisTickValues( allDates ),
		[ allDates ]
	);

	// Memoised tick formatter — called by Nivo for every visible tick label.
	const formatTick = useCallback(
		( value ) => {

			// Nivo passes the raw Date object for time scales.
			const ts = value instanceof Date ? value.getTime() / 1000 : Number( value ) / 1000;
			return formatAxisLabel( ts, interval ?? 'day', spansMultipleYears ?? false );
		},
		[ interval, spansMultipleYears ]
	);

	// Slice tooltip wrapper so we can pass interval down without prop-drilling through Nivo.
	const sliceTooltip = useCallback(
		({ slice }) => (
			<InsightsTooltip
				slice={ slice }
				interval={ interval ?? 'day' }
			/>
		),
		[ interval ]
	);

	// Replace the built-in lines layer with CustomLines so each series can carry
	// its own strokeDasharray while all other Nivo layers (slices, points, etc.) remain.
	// Memoised so Nivo receives a stable array reference and avoids unnecessary remounts.
	const layers = useMemo(
		() => [
			'grid',
			'markers',
			'axes',
			'areas',
			'crosshair',
			CustomLines,
			'slices',
			'points',
			'mesh',
			'legends'
		],
		[]
	);

	return (
		<ResponsiveLine
			data={ nivoData }
			margin={{ top: 30, right: 48, bottom: 56, left: 72 }}
			xScale={{ type: 'time', format: 'native' }}
			xFormat="time:%Q"
			yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
			colors={{ datum: 'color' }}
			axisBottom={{
				tickSize: 0,
				tickPadding: 12,
				tickValues: xTickValues,
				format: formatTick
			}}
			axisLeft={{
				tickSize: 0,
				tickPadding: 12,
				tickValues: 6
			}}
			enableGridX={ false }
			enableGridY={ true }
			gridYValues={ 6 }
			pointSize={ 8 }
			lineWidth={ 3 }
			enablePointLabel={ false }
			enableSlices="x"
			sliceTooltip={ sliceTooltip }
			layers={ layers }
			theme={{
				grid: { line: { stroke: 'var(--color-gray-300)', strokeWidth: 1 } },
				axis: {
					ticks: { text: { fill: 'var(--color-gray-600)', fontSize: 12 } },
					domain: { line: { stroke: 'var(--color-gray-400)', strokeWidth: 1 } }
				}
			}}
			curve="catmullRom"
		/>
	);
};

export default InsightsGraph;
