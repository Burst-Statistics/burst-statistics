/**
 * Shared Nivo line-chart configuration for the Insights and ecommerce line
 * charts, so they render with one visual identity without each chart
 * duplicating the setup.
 */

/** Shared tick spacing for both axes. */
export const LINE_CHART_AXIS_BASE = {
	tickSize: 0,
	tickPadding: 12
} as const;

/** Base ResponsiveLine props shared by all Burst line charts. */
export const LINE_CHART_BASE_PROPS = {
	margin: { top: 30, right: 48, bottom: 56, left: 72 },
	xScale: { type: 'time', format: 'native' },
	xFormat: 'time:%Q',
	yScale: { type: 'linear', min: 0, max: 'auto', stacked: false },
	colors: { datum: 'color' },
	enableGridX: false,
	enableGridY: true,
	pointSize: 8,
	lineWidth: 3,
	enablePointLabel: false,
	enableSlices: 'x',
	curve: 'catmullRom',
	theme: {
		grid: { line: { stroke: 'var(--color-gray-300)', strokeWidth: 1 } },
		axis: {
			ticks: { text: { fill: 'var(--color-gray-600)', fontSize: 12 } },
			domain: { line: { stroke: 'var(--color-gray-400)', strokeWidth: 1 } }
		}
	}
} as const;

/**
 * Layer stack with the built-in lines layer replaced by a chart-specific
 * custom layer, so each chart can dash its own series while all other Nivo
 * layers stay in place.
 *
 * @param customLines - The chart's custom lines layer component.
 * @return The Nivo layer stack.
 */
export function buildLineChartLayers<TLayer>(
	customLines: TLayer
): Array<TLayer | 'grid' | 'markers' | 'axes' | 'areas' | 'crosshair' | 'slices' | 'points' | 'mesh' | 'legends'> {
	return [
		'grid',
		'markers',
		'axes',
		'areas',
		'crosshair',
		customLines,
		'slices',
		'points',
		'mesh',
		'legends'
	];
}
