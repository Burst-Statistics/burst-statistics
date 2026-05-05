import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { ResponsiveBar } from '@nivo/bar';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import PopoverFilter from '@/components/Common/PopoverFilter';
import { useDate } from '@/store/useDateStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { formatCurrencyCompact, formatNumber, getChartXAxisTickValues } from '@/utils/formatting';
import { RevenueTooltip } from './RevenueTooltip';
import {
	REVENUE_COLORS,
	fetchRevenueData
} from './revenueData';

/**
 * Legend displayed in the BlockHeading controls area.
 *
 * @param {Object} props Component props.
 * @param {string} props.chartMode Selected chart mode.
 * @return {JSX.Element} The legend element.
 */
function RevenueLegend({ chartMode }) {
	const isRevenueMode = 'revenue' === chartMode;
	const items = [
		{
			color: REVENUE_COLORS[ 0 ],
			label: isRevenueMode ? __( 'New Revenue', 'burst-statistics' ) : __( 'New Sales', 'burst-statistics' )
		},
		{
			color: REVENUE_COLORS[ 1 ],
			label: isRevenueMode ? __( 'Renewal Revenue', 'burst-statistics' ) : __( 'Renewal Sales', 'burst-statistics' )
		}
	];

	return (
		<div className="flex items-center gap-4">
			{ items.map( ({ color, label }) => (
				<div key={ label } className="flex items-center gap-1.5">
					<span
						className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
						style={{ backgroundColor: color }}
					/>
					<span className="text-sm text-gray-500">{ label }</span>
				</div>
			) ) }
		</div>
	);
}

/**
 * Chart mode filter
 *
 * @param {Object}   props Component props.
 * @param {string}   props.chartMode Active mode.
 * @param {Function} props.onApply Mode apply handler.
 * @return {JSX.Element}
 */
function RevenueModeFilter({ chartMode, onApply }) {
	const modeOptions = {
		revenue: {
			label: __( 'Revenue', 'burst-statistics' ),
			default: true
		},
		sales: {
			label: __( 'Sales', 'burst-statistics' )
		}
	};

	const handleApply = ( selectedOptions ) => {
		const nextMode = selectedOptions?.[ 0 ] ?? 'revenue';
		onApply( nextMode );
	};

	return (
		<PopoverFilter
			id="subscriptions_revenue_chart_mode"
			selectedOptions={[ chartMode ]}
			options={ modeOptions }
			defaultOptions={[ 'revenue' ]}
			selectionMode="single"
			onApply={ handleApply }
		/>
	);
}

/**
 * RevenueChartBlock component.
 * Displays a stacked bar chart of new vs renewal revenue or sales.
 * Uses TanStack Query for data fetching with a localized loading state that
 * preserves layout via placeholder data and a heading spinner.
 *
 * @return {JSX.Element} The RevenueChartBlock component.
 */
export function RevenueChartBlock() {
	const { startDate, endDate, range, filters } = useDate( ( state ) => state );
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
		queryKey: [ 'revenueChart', chartMode, startDate, endDate, range, filters ],
		queryFn: () => fetchRevenueData({ startDate, endDate, range, filters, chartMode }),
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
		<Block className="row-span-1 lg:col-span-12 xl:col-span-6 group/root">
			<BlockHeading
				title={ isRevenueMode ? __( 'New & Renewal revenue', 'burst-statistics' ) : __( 'New & Renewal sales', 'burst-statistics' ) }
				className="border-b border-gray-200"
				controls={
					! showEmptyState ? (
						<div className="flex items-center gap-4 flex-wrap justify-end">
							<RevenueLegend chartMode={ chartMode } />

							<RevenueModeFilter chartMode={ chartMode } onApply={ setChartMode } />
						</div>
					) : null
				}
				isLoading={ isFetching }
			/>

			<BlockContent className="px-0 py-0">
				{
					revenueQuery.isError && (
						<p className="px-6 py-4 text-sm text-red-600">
							{ __( 'Failed to load chart data.', 'burst-statistics' ) }
						</p>
					)
				}

				{
					showEmptyState ? (
						<div className="h-[360px] flex items-center justify-center px-6 py-8 text-center">
							<div className="max-w-md">
								<div className="mb-4 flex justify-center">
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
								</div>

								<h3 className="mb-1 text-base font-medium text-gray-600">
									{ __( 'No data to display', 'burst-statistics' ) }
								</h3>

								<p className="text-sm text-gray-400">
									{ emptyStateMessage }
								</p>
							</div>
						</div>
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
