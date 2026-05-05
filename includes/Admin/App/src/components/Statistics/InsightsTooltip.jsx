import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { formatTooltipLabel } from '@/utils/formatting';
import { METRIC_LABELS } from './insightsConfig';

/**
 * Custom slice tooltip for the InsightsGraph line chart.
 * Shows all series values at the hovered x position, with the date header
 * formatted according to the active grouping interval.
 *
 * @param {Object} props          - Nivo slice tooltip props.
 * @param {Object} props.slice    - The x-axis slice containing all points at that position.
 * @param {string} props.interval - Active grouping interval: 'hour'|'day'|'week'|'month'.
 * @return {JSX.Element} The rendered tooltip.
 */
export function InsightsTooltip({ slice, interval }) {
	const { points } = slice;

	// x is a Date object when using Nivo's time scale.
	const xDate = points[ 0 ]?.data.x;
	const xLabel = ( xDate instanceof Date ) ?
		formatTooltipLabel( xDate.getTime() / 1000, interval ?? 'day' ) :
		null;

	return (
		<ChartTooltip>
			{ xLabel && (
				<p className="font-semibold text-gray-700 mb-1.5">{ xLabel }</p>
			) }
			<div className="flex flex-col gap-1">
				{ points.map( ( point ) => {

					// serieId is the metric key set in InsightsGraph.transformToNivoFormat.
					// Using it here keeps the label aligned with the point's actual series,
					// regardless of the order Nivo uses for slice points.
					const label = METRIC_LABELS[ point.serieId ] ?? point.serieId;
					return (
						<div key={ point.id } className="flex items-center gap-2">
							<span
								className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
								style={ { backgroundColor: point.serieColor } }
							/>
							<span className="text-gray-600">{ label }:</span>
							<span className="font-medium text-gray-800 ml-auto">
								{ Number( point.data.y ).toLocaleString() }
							</span>
						</div>
					);
				}) }
			</div>
		</ChartTooltip>
	);
}
