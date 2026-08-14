import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import MetricInfo from '@/components/Common/MetricInfo';
import { ChartLegend } from '@/components/Common/ChartLegend';
import { ChartModeFilter } from '@/components/Common/ChartModeFilter';
import { ChartEmptyState } from '@/components/Common/ChartEmptyState';
import { ChartErrorNotice } from '@/components/Common/ChartErrorNotice';
import {
	ForecastAnnotation,
	ForecastToggle
} from '@/components/Forecast';
import { addForecastDataset } from '@/components/Forecast/forecastSeries';
import { buildForecastLegendItems } from '@/components/Forecast/forecastLegend';
import SalesChartGraph from '@/components/Sales/SalesChart/SalesChartGraph';
import { useForecastData } from '@/hooks/useForecastData';
import { useDate } from '@/store/useDateStore';
import { COMPARE_MODES, useCompareStore } from '@/store/useCompareStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import type { SalesChartData } from '@/types/api-endpoints';
import { getForecastRange } from '@/utils/formatting';
import { getRevenueChartData } from '@/api/getRevenueChartData';
import {
	buildSubscriptionHistoryChartData
} from './subscriptionForecastData';

/**
 * Dedicated Subscription total history and renewal forecast line chart.
 *
 * Historical subscription totals come from the existing revenue-chart endpoint.
 * The separate forecast endpoint is queried only while Forecast is enabled.
 */
const HISTORICAL_PLACEHOLDER = {
	interval: 'day',
	spans_multiple_years: false,
	rows: [],
	mode: 'revenue',
	currency: null
};

// fallow-ignore-next-line complexity
export function SubscriptionForecastChartBlock(): JSX.Element {

	// Subscription daily rows are site-wide: visitor filters do not apply
	// here, so none are sent and none participate in the query key.
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const compareMode = useCompareStore( ( state ) => state.compareMode );
	const chartMode = useSubscriptionsStore( ( state ) => state.chartMode );
	const setChartMode = useSubscriptionsStore(
		( state ) => state.setChartMode
	);
	const showForecast = useSubscriptionsStore(
		( state ) => state.showForecast
	);
	const showComparison = useSubscriptionsStore(
		( state ) => state.showComparison
	);
	const toggleForecast = useSubscriptionsStore(
		( state ) => state.toggleForecast
	);
	const toggleComparison = useSubscriptionsStore(
		( state ) => state.toggleComparison
	);
	const historicalLabel = 'revenue' === chartMode ?
		__( 'Renewal Revenue', 'burst-statistics' ) :
		__( 'Renewals', 'burst-statistics' );
	const comparisonLabel = COMPARE_MODES.YEAR_OVER_YEAR === compareMode ?
		__( 'Previous year', 'burst-statistics' ) :
		__( 'Previous period', 'burst-statistics' );

	// While the forecast is shown, chart and forecast share one bucket
	// granularity (months, or years for selections beyond two years) and the
	// end date is anchored to the last complete period — also when the
	// picked range ends earlier — so the forecast always starts at the
	// current period and never projects periods that are already measured.
	const forecastRange = getForecastRange( startDate );
	const groupBy = showForecast ? forecastRange.groupBy : 'auto';
	const historicalEndDate = showForecast ? forecastRange.endDate : endDate;

	// Without comparison or forecast this key is identical to
	// RevenueChartBlock's, so TanStack Query deduplicates the shared
	// historical request; with either toggle on the payload differs and gets
	// its own cache entry.
	const historicalQuery = useQuery({
		queryKey: [
			'revenueChart',
			chartMode,
			startDate,
			historicalEndDate,
			range,
			...( 'auto' !== groupBy ? [ groupBy ] : []),
			...( showComparison ? [ compareMode ] : [])
		],
		queryFn: () => getRevenueChartData({
			startDate,
			endDate: historicalEndDate,
			range,
			chartMode,
			compareMode: showComparison ? compareMode : '',
			groupBy
		}),

		// Keep the previous payload during refetches so the chart and its
		// controls do not collapse to the empty placeholder mid-fetch.
		placeholderData: ( previousData: unknown ) => previousData ?? HISTORICAL_PLACEHOLDER,
		gcTime: 10000
	});

	const historicalChartData = useMemo<SalesChartData>(
		() => buildSubscriptionHistoryChartData(
			historicalQuery.data,
			historicalLabel,
			comparisonLabel,
			chartMode
		),
		[ historicalQuery.data, historicalLabel, comparisonLabel, chartMode ]
	);
	const hasHistoricalData = Boolean(
		historicalChartData.datasets[0]?.data.some(
			( value ) => null !== value && 0 < value
		)
	);

	// Gate the forecast on historical data as well: a persisted toggle must
	// not keep fetching a forecast the block neither renders nor lets the
	// user switch off while the empty state is shown.
	const forecastQuery = useForecastData({
		source: 'subscriptions',
		chartMode,
		enabled: showForecast && hasHistoricalData
	});
	const forecastData = forecastQuery.data;
	const chartData = useMemo<SalesChartData>(
		() => addForecastDataset(
			historicalChartData,
			forecastData,
			showForecast,
			__( 'Forecast', 'burst-statistics' )
		),
		[ historicalChartData, forecastData, showForecast ]
	);
	const isFetching = historicalQuery.isFetching ||
		( showForecast && forecastQuery.isFetching );
	const showEmptyState = ! isFetching &&
		! historicalQuery.isError &&
		! hasHistoricalData;
	const hasForecastData = showForecast &&
		! forecastQuery.isPlaceholderData &&
		0 < ( forecastData?.rows.length ?? 0 );
	const isRevenueMode = 'revenue' === chartMode;
	const legendItems = buildForecastLegendItems(
		historicalLabel,
		showComparison,
		comparisonLabel,
		showForecast
	);

	return (
		<Block className="row-span-1 @lg:col-span-12 group/root">
			<BlockHeading
				title={
					<MetricInfo metricKey="subscription_forecast_chart" side="bottom">
						{ __( 'Subscription renewals over time', 'burst-statistics' ) }
					</MetricInfo>
				}
				className="border-b border-gray-200"
				isLoading={ isFetching }
				controls={
					! showEmptyState ? (
						<div className="flex flex-wrap items-center justify-end gap-4">
							<ChartLegend items={ legendItems } />

							<div className="flex items-center gap-2">
								<ForecastToggle
									active={ showComparison }
									label={ comparisonLabel }
									onClick={ toggleComparison }
								/>

								{ hasHistoricalData && (
									<ForecastToggle
										active={ showForecast }
										label={ __( 'Forecast', 'burst-statistics' ) }
										onClick={ toggleForecast }
									/>
								) }
							</div>

							<ChartModeFilter
								id="subscriptions_forecast_chart_mode"
								chartMode={ chartMode }
								onApply={ setChartMode }
							/>
						</div>
					) : null
				}
			/>

			<BlockContent className="px-0 py-0">
				{ historicalQuery.isError && (
					<ChartErrorNotice message={ __( 'Failed to load chart data.', 'burst-statistics' ) } />
				) }

				{ showForecast && forecastQuery.isError && (
					<ChartErrorNotice message={ __( 'Failed to load forecast data.', 'burst-statistics' ) } />
				) }

				{ hasForecastData && forecastData && (
					<ForecastAnnotation
						source="subscriptions"
						mode={ chartMode }
						metadata={ forecastData.metadata }
					/>
				) }

				{ showEmptyState ? (
					<ChartEmptyState
						message={
							isRevenueMode ?
								__(
									'There is no subscription renewal revenue available for the selected date range.',
									'burst-statistics'
								) :
								__(
									'There are no subscription renewals available for the selected date range.',
									'burst-statistics'
								)
						}
					/>
				) : (
					<div
						style={{ height: 360 }}
						aria-busy={ isFetching }
						className={
							isFetching ?
								'animate-pulse' :
								undefined
						}
					>
						<SalesChartGraph
							data={ chartData }
							mode={ chartMode }
							currency={ chartData.currency ?? 'USD' }
							actualLabel={ historicalLabel }
						/>
					</div>
				) }
			</BlockContent>
		</Block>
	);
}
