import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { ResponsiveBar } from '@nivo/bar';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { ChartLegend } from '@/components/Common/ChartLegend';
import { ChartModeFilter } from '@/components/Common/ChartModeFilter';
import { ChartEmptyState } from '@/components/Common/ChartEmptyState';
import { ChartErrorNotice } from '@/components/Common/ChartErrorNotice';
import { useDate } from '@/store/useDateStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { formatCurrencyCompact, formatNumber, getChartXAxisTickValues } from '@/utils/formatting';
import { RevenueTooltip } from './RevenueTooltip';
import { getRevenueChartData } from '@/api/getRevenueChartData';

/** Colors for new and recurring revenue bars respectively. */
const REVENUE_COLORS = [ 'var(--color-primary-700)', 'var(--color-primary-300)' ];

/**
 * RevenueChartBlock component.
 * Displays a stacked bar chart of new vs renewal revenue or sales.
 * Uses TanStack Query for data fetching with a localized loading state that
 * preserves layout via placeholder data and a heading spinner.
 *
 * @return {JSX.Element} The RevenueChartBlock component.
 */
// fallow-ignore-next-line complexity
export function RevenueChartBlock() {

	// Subscription daily rows are site-wide: visitor filters do not apply
	// here, so none are sent and none participate in the query key. The key
	// matches SubscriptionForecastChartBlock's (without comparison) so the
	// shared historical request is deduplicated.
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const chartMode = useSubscriptionsStore( ( state ) => state.chartMode );
	const setChartMode = useSubscriptionsStore( ( state ) => state.setChartMode );
	const PLACEHOLDER_DATA = {
		interval: 'day',
		spans_multiple_years: false,
		rows: [],
		mode: chartMode,
		currency: null
	};

	const revenueQuery = useQuery({
		queryKey: [ 'revenueChart', chartMode, startDate, endDate, range ],
		queryFn: () => getRevenueChartData({ startDate, endDate, range, chartMode }),
		placeholderData: PLACEHOLDER_DATA,
		gcTime: 10000
	});

	const isFetching = revenueQuery.isFetching;
	const chartData = revenueQuery.data ?? PLACEHOLDER_DATA;

	const data = useMemo( () => chartData.rows ?? [], [ chartData.rows ]);
	const currency = chartData.currency ?? 'USD';

	const labelByTimestamp = useMemo(
		() => new Map( data.map( ( row ) => [ String( row.timestamp ), row.label ]) ),
		[ data ]
	);

	const tickValues = useMemo(
		() => getChartXAxisTickValues( data.map( ( row ) => row.timestamp ) ),
		[ data ]
	);

	const isRevenueMode = 'revenue' === chartMode;

	const hasChartData = useMemo(
		() => data.some( ( row ) => 0 < Number( row.newValue ?? 0 ) || 0 < Number( row.renewalValue ?? 0 ) ),
		[ data ]
	);

	const showEmptyState = ! isFetching && ! revenueQuery.isError && ! hasChartData;

	const emptyStateMessage = isRevenueMode ?
		__( 'There is no revenue data available for the selected filters and date range.', 'burst-statistics' ) :
		__( 'There is no sales data available for the selected filters and date range.', 'burst-statistics' );

	const loadingColors = [ 'var(--color-gray-400)', 'var(--color-gray-300)' ];

	return (
		<Block className="row-span-1 @lg:col-span-12 @xl:col-span-6 group/root">
			<BlockHeading
				title={ isRevenueMode ? __( 'New & Renewal revenue', 'burst-statistics' ) : __( 'New & Renewal sales', 'burst-statistics' ) }
				className="border-b border-gray-200"
				controls={
					! showEmptyState ? (
						<div className="flex items-center gap-4 flex-wrap justify-end">
							<ChartLegend
								items={ [
									{
										key: 'new',
										color: REVENUE_COLORS[ 0 ],
										square: true,
										label: isRevenueMode ? __( 'New Revenue', 'burst-statistics' ) : __( 'New Sales', 'burst-statistics' )
									},
									{
										key: 'renewal',
										color: REVENUE_COLORS[ 1 ],
										square: true,
										label: isRevenueMode ? __( 'Renewal Revenue', 'burst-statistics' ) : __( 'Renewal Sales', 'burst-statistics' )
									}
								] }
							/>

							<ChartModeFilter id="subscriptions_revenue_chart_mode" chartMode={ chartMode } onApply={ setChartMode } />
						</div>
					) : null
				}
				isLoading={ isFetching }
			/>

			<BlockContent className="px-0 py-0">
				{
					revenueQuery.isError && (
						<ChartErrorNotice message={ __( 'Failed to load chart data.', 'burst-statistics' ) } />
					)
				}

				{
					showEmptyState ? (
						<ChartEmptyState
							message={ emptyStateMessage }
							icon={
								<svg
									className="h-14 w-14 text-gray-300"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							}
						/>
					) : (
						<div
							style={{ height: 360 }}
							aria-busy={ isFetching }
							className={ isFetching ? 'animate-pulse' : undefined }
						>
							<ResponsiveBar
								data={ data }
								keys={ [ 'newValue', 'renewalValue' ] }
								indexBy="timestamp"
								groupMode="stacked"
								margin={{ top: 40, right: 24, bottom: 40, left: 72 }}
								padding={ 0.35 }
								colors={ isFetching ? loadingColors : REVENUE_COLORS }
								borderRadius={ 3 }
								axisBottom={{
									tickSize: 0,
									tickPadding: 12,
									tickValues,
									format: ( value ) => labelByTimestamp.get( String( value ) ) ?? ''
								}}
								axisLeft={{
									tickSize: 0,
									tickPadding: 12,
									tickValues: 5,
									format: ( value ) => isRevenueMode ?
										formatCurrencyCompact( currency, Number( value ), { currencyDisplay: 'narrowSymbol' }) :
										formatNumber( Number( value ), 0 )
								}}
								enableGridX={ false }
								enableGridY={ true }
								gridYValues={ 5 }
								enableLabel={ false }
								tooltip={
									isFetching ?
										() => null :
										( props ) => (
											<RevenueTooltip
												{ ...props }
												mode={ chartMode }
												currency={ currency }
											/>
										)
								}
								theme={{
									grid: { line: { stroke: 'var(--color-gray-300)', strokeWidth: 1 } },
									axis: {
										ticks: { text: { fill: 'var(--color-gray-600)', fontSize: 12 } },
										domain: { line: { stroke: 'var(--color-gray-400)', strokeWidth: 1 } }
									}
								}}
							/>
						</div>
					)
				}
			</BlockContent>
		</Block>
	);
}
