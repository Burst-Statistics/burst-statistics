import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { formatTooltipLabel } from '@/utils/formatting';
import { METRIC_LABELS } from './insightsConfig';
import { COMPARISON_SERIES_PREFIX } from './InsightsGraph';
import { __ } from '@wordpress/i18n';

/**
 * Format a percentage change value for display.
 * Returns an object with `text` and `isPositive` flag.
 *
 * @param {number} currentValue    - Current period value.
 * @param {number} comparisonValue - Comparison period value.
 * @return {{ text: string, isPositive: boolean }|null} Formatted change, or null when not computable.
 */
function formatChange( currentValue, comparisonValue ) {
	if ( ! comparisonValue || isNaN( currentValue ) || isNaN( comparisonValue ) ) {
		return null;
	}
	const pct = ( ( currentValue - comparisonValue ) / comparisonValue ) * 100;
	if ( ! isFinite( pct ) ) {
		return null;
	}
	const rounded = Math.round( pct );
	return {
		text: ( 0 <= rounded ? '+' : '' ) + rounded + '%',
		isPositive: 0 <= rounded
	};
}

/**
 * Custom slice tooltip for the InsightsGraph line chart.
 * Shows all series values at the hovered x position, with the date header
 * formatted according to the active grouping interval.
 *
 * When comparison points are present (single-metric mode), a separate row is
 * displayed with the comparison period date, value, and percentage change.
 *
 * @param {Object} props          - Nivo slice tooltip props.
 * @param {Object} props.slice    - The x-axis slice containing all points at that position.
 * @param {string} props.interval - Active grouping interval: 'hour'|'day'|'week'|'month'.
 * @return {JSX.Element} The rendered tooltip.
 */
export function InsightsTooltip({ slice, interval }) {
	const { points } = slice;

	// Split current-period points from comparison points.
	const currentPoints = points.filter(
		( p ) => ! String( p.serieId ).startsWith( COMPARISON_SERIES_PREFIX )
	);
	const comparisonPoints = points.filter(
		( p ) => String( p.serieId ).startsWith( COMPARISON_SERIES_PREFIX )
	);

	// x is a Date object when using Nivo's time scale.
	const xDate = currentPoints[ 0 ]?.data.x ?? points[ 0 ]?.data.x;
	const xLabel = ( xDate instanceof Date ) ?
		formatTooltipLabel( xDate.getTime() / 1000, interval ?? 'day' ) :
		null;

	return (
		<ChartTooltip>
			{ xLabel && (
				<p className="font-semibold text-gray-700 mb-1.5">{ xLabel }</p>
			) }

			<div className="flex flex-col gap-1">
				{ currentPoints.map( ( point ) => {
					const label = METRIC_LABELS[ point.serieId ] ?? point.serieId;

					// Find the matching comparison point for this metric.
					const compPoint = comparisonPoints.find(
						( cp ) => cp.serieId === COMPARISON_SERIES_PREFIX + point.serieId
					);

					const change = compPoint ?
						formatChange( Number( point.data.y ), Number( compPoint.data.y ) ) :
						null;

					return (
						<div key={ point.id } className="flex flex-col gap-0.5">
							{ /* Current period row. */ }
							<div className="flex items-center gap-2">
								<span
									className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
									style={ { backgroundColor: point.serieColor } }
								/>
								<span className="text-gray-600">{ label }:</span>
								<span className="font-medium text-gray-800 ml-auto">
									{ Number( point.data.y ).toLocaleString() }
								</span>
								{ change && (
									<span className={ change.isPositive ? 'text-green-600 font-medium text-xs' : 'text-red-500 font-medium text-xs' }>
										{ change.text }
									</span>
								) }
							</div>

							{ /* Comparison period row. */ }
							{ compPoint && (
								<div className="flex items-center gap-2 ml-5">
									{ /* Dashed line swatch. */ }
									<span className="inline-block w-3 flex-shrink-0 border-t-2 border-dashed border-gray-400" />
									<span className="text-gray-400 text-xs">
										{ ( () => {
											const compTs = compPoint.data.comparisonTimestamp;
											return compTs ?
												formatTooltipLabel( compTs, interval ?? 'day' ) :
												__( 'Previous period', 'burst-statistics' );
										})() }:
									</span>
									<span className="text-gray-500 text-xs ml-auto">
										{ Number( compPoint.data.y ).toLocaleString() }
									</span>
								</div>
							) }
						</div>
					);
				}) }
			</div>
		</ChartTooltip>
	);
}
