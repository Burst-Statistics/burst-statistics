import { useMemo, useCallback } from '@wordpress/element';
import { ResponsiveLine } from '@nivo/line';
import { InsightsTooltip } from './InsightsTooltip';
import { formatAxisLabel, getChartXAxisTickValues } from '@/utils/formatting';
import { METRIC_COLORS } from './insightsConfig';

/**
 * Series id prefix that marks a series as comparison data.
 * Used to distinguish comparison points in the tooltip and the custom line layer.
 *
 * @type {string}
 */
export const COMPARISON_SERIES_PREFIX = '__comparison__';

/**
 * Transforms API response data into the format expected by Nivo ResponsiveLine.
 * Each x value is a JS Date object derived from the corresponding Unix timestamp.
 * Colors are resolved from the design-system METRIC_COLORS map, with the
 * server-provided borderColor used only as a fallback.
 *
 * When comparison data is provided, an additional dashed series is appended for
 * each metric, mapped onto the same x-axis as the current period so both lines
 * share the same time scale. Each comparison datum also carries the actual
 * comparison-period timestamp so the tooltip can display the correct date.
 *
 * @param {Object}      data                    - API response object.
 * @param {Array}       data.datasets            - Dataset definitions with label, data, and borderColor.
 * @param {number[]}    timestamps              - Array of Unix timestamps (UTC seconds) per data point.
 * @param {string[]}    metrics                 - Ordered array of active metric keys.
 * @param {Object|null} comparison              - Optional comparison data from the API.
 * @param {Array}       comparison.datasets     - Comparison dataset values.
 * @param {number[]}    comparison.timestamps   - Actual comparison-period timestamps.
 * @return {Array} Nivo-compatible line series array.
 */
function transformToNivoFormat( data, timestamps, metrics, comparison ) {
	if ( ! data?.datasets || ! timestamps?.length ) {
		return [];
	}

	const series = data.datasets.map( ( dataset, i ) => ({
		id: metrics?.[ i ] ?? dataset.label,
		color: METRIC_COLORS[ metrics?.[ i ] ] ?? dataset.borderColor,
		data: timestamps.map( ( ts, j ) => ({
			x: new Date( ts * 1000 ),
			y: dataset.data[ j ] ?? 0
		}) )
	}) );

	// Append one dashed comparison series per metric when comparison data is present.
	if ( comparison?.datasets?.length && comparison?.timestamps?.length ) {
		comparison.datasets.forEach( ( compDataset, i ) => {
			const metricKey = metrics?.[ i ] ?? i;
			series.push({
				id: COMPARISON_SERIES_PREFIX + metricKey,

				// Gray color for all comparison lines.
				color: 'var(--color-gray-400)',
				data: timestamps.map( ( currentTs, j ) => ({
					x: new Date( currentTs * 1000 ),
					y: compDataset.data[ j ] ?? 0,

					// Carry the actual comparison-period timestamp for the tooltip.
					comparisonTimestamp: comparison.timestamps[ j ] ?? null
				}) )
			});
		});
	}

	return series;
}

/**
 * Custom Nivo layer that renders all series lines, distinguishing between
 * regular (solid) and comparison (dashed gray) series.
 * Replaces the built-in 'lines' layer so comparison lines never get a solid rendering.
 *
 * @param {Object}   layerProps               - Nivo layer props injected at render time.
 * @param {Array}    layerProps.series         - All series with computed positions.
 * @param {Function} layerProps.lineGenerator  - d3 line generator pre-configured by Nivo.
 * @param {Function} layerProps.xScale         - x scale function.
 * @param {Function} layerProps.yScale         - y scale function.
 * @return {JSX.Element[]} SVG path elements for each series.
 */
function CustomLinesLayer({ series, lineGenerator, xScale, yScale }) {
	return series.map( ( serie ) => {
		const isComparison = String( serie.id ).startsWith( COMPARISON_SERIES_PREFIX );
		const pathData = lineGenerator(
			serie.data.map( ( d ) => ({
				x: xScale( d.data.x ),
				y: null != d.data.y ? yScale( d.data.y ) : null
			}) )
		);

		return (
			<path
				key={ serie.id }
				d={ pathData }
				fill="none"
				stroke={ serie.color }
				strokeWidth={ isComparison ? 2 : 3 }
				strokeDasharray={ isComparison ? '6 4' : undefined }
				strokeOpacity={ isComparison ? 0.75 : 1 }
			/>
		);
	});
}

/**
 * InsightsGraph renders the multi-line chart for the Insights block.
 * Accepts raw API data with Unix timestamps and formats the x-axis using
 * native Intl.DateTimeFormat via the insightsDateFormatting utility.
 *
 * When the `comparison` prop is provided (single-metric mode), a second dashed
 * gray line is overlaid on the same x-axis to represent the comparison period.
 *
 * @param {Object}      props                    - Component props.
 * @param {Object}      props.data               - API response with datasets.
 * @param {number[]}    props.timestamps         - Unix timestamps (UTC seconds) per point.
 * @param {string}      props.interval           - Active grouping: 'hour'|'day'|'week'|'month'.
 * @param {boolean}     props.spansMultipleYears - Whether the range covers more than one year.
 * @param {string[]}    props.metrics            - Ordered array of active metric keys.
 * @param {Object|null} props.comparison         - Optional comparison data from the API.
 * @return {JSX.Element} The rendered line chart.
 */
const InsightsGraph = ({ data, timestamps, interval, spansMultipleYears, metrics, comparison }) => {
	const nivoData = useMemo(
		() => transformToNivoFormat( data, timestamps, metrics, comparison ?? null ),
		[ data, timestamps, metrics, comparison ]
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

	// Replace the built-in 'lines' layer with our custom one that handles dashed comparison lines.
	const layers = [
		'grid',
		'markers',
		'axes',
		'areas',
		CustomLinesLayer,
		'slices',
		'mesh',
		'legends'
	];

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

			// Points are suppressed — the custom layer handles all rendering and
			// the slice tooltip provides hover interaction without needing dots.
			pointSize={ 0 }
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
