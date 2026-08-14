import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';
import type { Point, SliceData } from '@nivo/line';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { COMPARE_MODES } from '@/store/useCompareStore';
import { formatCurrency, formatNumber, formatTooltipLabel, getChangePercentage } from '@/utils/formatting';
import { SALES_CHART_COLORS } from './salesChartData';
import type { SalesChartSeries } from './salesChartData';

interface SalesChartTooltipProps {
	slice: SliceData<SalesChartSeries>;
	interval: string;
	mode: 'revenue' | 'sales';
	currency: string;
	actualLabel?: string;
}

/**
 * Resolves the display label for a sales chart slice point.
 *
 * @param point         - A Nivo slice point.
 * @param isRevenueMode - Whether the chart shows revenue.
 * @return The row label.
 */
// fallow-ignore-next-line complexity
function getPointLabel(
	point: Point<SalesChartSeries>,
	isRevenueMode: boolean,
	actualLabel?: string
): string {
	const { isComparison, isForecast, compareMode } = point.data;

	if ( isForecast ) {
		return __( 'Forecast', 'burst-statistics' );
	}

	if ( isComparison ) {
		return COMPARE_MODES.YEAR_OVER_YEAR === compareMode ?
			__( 'Previous year', 'burst-statistics' ) :
			__( 'Previous period', 'burst-statistics' );
	}

	return actualLabel ??
		( isRevenueMode ?
			__( 'Revenue', 'burst-statistics' ) :
			__( 'Sales', 'burst-statistics' ) );
}

/**
 * Returns the marker color for a slice point, matching its line color.
 *
 * @param point - A Nivo slice point.
 * @return CSS color value for the marker dot.
 */
function getMarkerColor( point: Point<SalesChartSeries> ): string {
	if ( point.data.isForecast ) {
		return SALES_CHART_COLORS.forecast;
	}

	if ( point.data.isComparison ) {
		return SALES_CHART_COLORS.comparison;
	}

	return SALES_CHART_COLORS.primary;
}

/**
 * Custom slice tooltip for the sales-over-time line chart.
 * Actual values are listed first, with the percent change against the
 * comparison value when a comparison series is present. Future points are
 * labeled as forecast values.
 *
 * @param props - Slice, interval, chart mode and currency.
 * @return The rendered tooltip.
 */
export function SalesChartTooltip({
	slice,
	interval,
	mode,
	currency,
	actualLabel
}: SalesChartTooltipProps ): JSX.Element {
	const { points } = slice;
	const isRevenueMode = 'sales' !== mode;

	const formatValue = ( amount: number ): string => isRevenueMode ?
		formatCurrency( currency, amount ) :
		formatNumber( amount, 0, false );

	const primaryPoint = points.find(
		( point ) => ! point.data.isComparison && ! point.data.isForecast
	) ?? points[ 0 ];
	const xDate = primaryPoint?.data.x;
	const xLabel = ( xDate instanceof Date ) ?
		formatTooltipLabel( xDate.getTime() / 1000, interval ) :
		null;

	const comparisonPoint = points.find( ( p ) => p.data.isComparison );

	// The forecast's bridge point duplicates the last actual value so the
	// lines connect visually; showing it would list the same number twice.
	// Null values are gaps and have nothing to show. Ordering: actuals first,
	// then comparison, then forecast.
	const seriesOrder = ( point: Point<SalesChartSeries> ): number =>
		point.data.isForecast ? 2 : ( point.data.isComparison ? 1 : 0 );
	const sortedPoints = points
		.filter( ( p ) => ! p.data.isBridge && null !== p.data.y )
		.sort( ( a, b ) => seriesOrder( a ) - seriesOrder( b ) );

	return (
		<ChartTooltip className="min-w-44">
			{ xLabel && (
				<p className="font-semibold text-gray-700 mb-1.5">{ xLabel }</p>
			) }
			<div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-2 gap-y-1 items-center">
				{ sortedPoints.map(

					// fallow-ignore-next-line complexity
					( point ) => {
					const { isComparison, isForecast } = point.data;
					const label = getPointLabel(
						point,
						isRevenueMode,
						actualLabel
					);

					// Null-valued points are filtered out above; the fallbacks
					// only satisfy the type checker.
					const change = ! isComparison && ! isForecast && comparisonPoint ?
						getChangePercentage( point.data.y ?? 0, comparisonPoint.data.y ?? 0 ) :
						null;
					const percentChangeLabel = change?.val || null;

					return (
						<div key={ point.id } className="contents">
							<span
								className="inline-block w-2 h-2 rounded-full justify-self-center"
								style={ { backgroundColor: getMarkerColor( point ) } }
							/>
							<span className="text-gray-600 min-w-0">{ label }</span>
							<span className="font-medium text-gray-800 tabular-nums text-right whitespace-nowrap">
								{ formatValue( point.data.y ?? 0 ) }
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
