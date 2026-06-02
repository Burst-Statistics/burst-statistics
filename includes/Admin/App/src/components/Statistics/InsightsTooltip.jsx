import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { formatNumber, formatTooltipLabel, getChangePercentage } from '@/utils/formatting';
import { METRIC_COLORS, METRIC_LABELS } from './insightsConfig';

/**
 * Resolves the metric key from a Nivo slice point.
 *
 * @param {Object} point - A Nivo slice point.
 * @return {string} The resolved metric key.
 */
function resolveMetricKey( point ) {
	const { metric_key: metricKey } = point.data;
	return metricKey ?? point.serieId.replace( /_comparison$/, '' );
}

/**
 * Returns the marker color for a slice point, matching its chart line color.
 *
 * @param {Object} point - A Nivo slice point.
 * @param {string} metricKey - Resolved metric key for the point.
 * @return {string} CSS color value for the marker dot.
 */
function getMarkerColor( point, metricKey ) {
	if ( point.data.isComparison ) {
		return 'var(--color-gray-400)';
	}

	return METRIC_COLORS[ metricKey ] ?? point.serieColor;
}

/**
 * Custom slice tooltip for the InsightsGraph line chart.
 * Shows all series values at the hovered x position, with the date header
 * formatted according to the active grouping interval.
 *
 * Current-period rows are listed first. Comparison rows use a "Previous year"
 * or "Previous period" label instead of an explicit comparison date. Percent
 * change is shown beside each current-period value when comparison data exists.
 *
 * @param {Object} props          - Nivo slice tooltip props.
 * @param {Object} props.slice    - The x-axis slice containing all points at that position.
 * @param {string} props.interval - Active grouping interval: 'hour'|'day'|'week'|'month'|'year'.
 * @return {JSX.Element} The rendered tooltip.
 */
export function InsightsTooltip({ slice, interval }) {
	const { points } = slice;

	// Use the first non-comparison point's x value for the header so it always
	// reflects the current period, even when a comparison series is present.
	const primaryPoint = points.find( ( p ) => ! p.data.isComparison ) ?? points[ 0 ];
	const xDate = primaryPoint?.data.x;
	const xLabel = ( xDate instanceof Date ) ?
		formatTooltipLabel( xDate.getTime() / 1000, interval ?? 'day' ) :
		null;

	const comparisonValuesByMetric = points.reduce( ( acc, point ) => {
		if ( ! point.data.isComparison ) {
			return acc;
		}

		const metricKey = resolveMetricKey( point );
		acc[metricKey] = Number( point.data.y );
		return acc;
	}, {});

	const sortedPoints = [ ...points ].sort( ( a, b ) => {
		const aOrder = a.data.isComparison ? 1 : 0;
		const bOrder = b.data.isComparison ? 1 : 0;
		return aOrder - bOrder;
	});

	return (
		<ChartTooltip className="min-w-44">
			{ xLabel && (
				<p className="font-semibold text-gray-700 mb-1.5">{ xLabel }</p>
			) }
			<div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-2 gap-y-1 items-center">
				{ sortedPoints.map( ( point ) => {
					const { isComparison, compareMode } = point.data;
					const metricKey = resolveMetricKey( point );
					const baseLabel = METRIC_LABELS[ metricKey ] ?? metricKey;

					let label = baseLabel;
					if ( isComparison ) {
						label = 'year_over_year' === compareMode ?
							__( 'Previous year', 'burst-statistics' ) :
							__( 'Previous period', 'burst-statistics' );
					}

					const value = formatNumber( Number( point.data.y ) );
					const change = ! isComparison && metricKey in comparisonValuesByMetric ?
						getChangePercentage( point.data.y, comparisonValuesByMetric[metricKey]) :
						null;
					const percentChangeLabel = change?.val || null;

					return (
						<div key={ point.id } className="contents">
							<span
								className="inline-block w-2 h-2 rounded-full justify-self-center"
								style={ { backgroundColor: getMarkerColor( point, metricKey ) } }
							/>
							<span className="text-gray-600 min-w-0">{ label }</span>
							<span className="font-medium text-gray-800 tabular-nums text-right whitespace-nowrap">
								{ value }
							</span>
							{ percentChangeLabel ? (
								<span
									className={ clsx(
										'text-xs font-medium tabular-nums text-right whitespace-nowrap',
										'positive' === change?.status ? 'text-green-600' : 'text-red-600'
									) }
								>
									{ percentChangeLabel }
								</span>
							) : (
								<span aria-hidden="true" />
							) }
						</div>
					);
				}) }
			</div>
		</ChartTooltip>
	);
}
