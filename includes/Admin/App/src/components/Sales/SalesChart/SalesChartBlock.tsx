import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useMemo } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import MetricInfo from '@/components/Common/MetricInfo';
import { ChartLegend } from '@/components/Common/ChartLegend';
import { ChartModeFilter } from '@/components/Common/ChartModeFilter';
import { ChartEmptyState } from '@/components/Common/ChartEmptyState';
import { ChartErrorNotice } from '@/components/Common/ChartErrorNotice';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { COMPARE_MODES, useCompareStore } from '@/store/useCompareStore';
import { useSalesChartStore } from '@/store/useSalesChartStore';
import { useForecastData } from '@/hooks/useForecastData';
import {
	ForecastAnnotation,
	ForecastToggle
} from '@/components/Forecast';
import { addForecastDataset } from '@/components/Forecast/forecastSeries';
import { buildForecastLegendItems } from '@/components/Forecast/forecastLegend';
import SalesChartGraph from './SalesChartGraph';
import { getSalesChartData } from '@/api/getSalesChartData';
import { getForecastRange } from '@/utils/formatting';
import type { SalesChartData } from '@/types/api-endpoints';

/**
 * SalesChartBlock renders the total sales-over-time line chart on the Sales
 * tab, styled like the Insights graph. Separate historical and forecast
 * endpoint responses are rendered together in this one chart.
 *
 * @return The SalesChartBlock component.
 */
const SALES_CHART_PLACEHOLDER: SalesChartData = {
	timestamps: [],
	interval: 'day',
	spans_multiple_years: false,
	mode: 'revenue',
	currency: null,
	datasets: []
};

// fallow-ignore-next-line complexity
export function SalesChartBlock(): JSX.Element {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();
	const compareMode = useCompareStore( ( state ) => state.compareMode );
	const chartMode = useSalesChartStore( ( state ) => state.chartMode );
	const setChartMode = useSalesChartStore( ( state ) => state.setChartMode );
	const showComparison = useSalesChartStore( ( state ) => state.showComparison );
	const toggleComparison = useSalesChartStore( ( state ) => state.toggleComparison );
	const showForecast = useSalesChartStore( ( state ) => state.showForecast );
	const toggleForecast = useSalesChartStore( ( state ) => state.toggleForecast );

	// While the forecast is shown, chart and forecast share one bucket
	// granularity (months, or years for selections beyond two years) and the
	// end date is anchored to the last complete period — also when the
	// picked range ends earlier — so the forecast always starts at the
	// current period and never projects periods that are already measured.
	// Without the forecast the chart keeps its adaptive resolution and the
	// picked range.
	const forecastRange = getForecastRange( startDate );
	const groupBy = showForecast ? forecastRange.groupBy : 'auto';
	const chartEndDate = showForecast ? forecastRange.endDate : endDate;

	const chartQuery = useQuery<SalesChartData>({
		queryKey: [ 'salesChart', startDate, chartEndDate, range, filters, chartMode, groupBy, showComparison ? compareMode : '' ],
		queryFn: () => getSalesChartData({
			startDate,
			endDate: chartEndDate,
			range,
			filters,
			chartMode,
			compareMode: showComparison ? compareMode : '',
			groupBy
		}),

		// Keep the previous payload during refetches so the chart and its
		// controls do not collapse to the empty placeholder mid-fetch.
		placeholderData: ( previousData: SalesChartData | undefined ) => previousData ?? SALES_CHART_PLACEHOLDER,
		gcTime: 10000
	});
	const forecastQuery = useForecastData({
		source: 'sales',
		chartMode,
		enabled: showForecast
	});

	const historicalData = chartQuery.data ?? SALES_CHART_PLACEHOLDER;
	const forecastData = forecastQuery.data;
	const chartData = useMemo<SalesChartData>(
		() => addForecastDataset(
			historicalData,
			forecastData,
			showForecast,
			__( 'Forecast', 'burst-statistics' )
		),
		[ historicalData, forecastData, showForecast ]
	);
	const isFetching = chartQuery.isFetching ||
		( showForecast && forecastQuery.isFetching );
	const isRevenueMode = 'sales' !== chartMode;

	const hasChartData = useMemo( () => {
		const primary = chartData.datasets.find(
			( dataset ) => ! dataset.is_comparison && ! dataset.is_forecast
		);
		return Boolean( primary?.data.some( ( value ) => null !== value && 0 < value ) );
	}, [ chartData.datasets ]);

	const showEmptyState = ! isFetching && ! chartQuery.isError && ! hasChartData;

	// Shared between the toggle and the legend so both follow the global
	// compare mode instead of the toggle claiming "Previous period" while the
	// series renders year-over-year data.
	const comparisonLabel = COMPARE_MODES.YEAR_OVER_YEAR === compareMode ?
		__( 'Previous year', 'burst-statistics' ) :
		__( 'Previous period', 'burst-statistics' );

	const legendItems = buildForecastLegendItems(
		isRevenueMode ? __( 'Revenue', 'burst-statistics' ) : __( 'Sales', 'burst-statistics' ),
		showComparison,
		comparisonLabel,
		showForecast
	);

	const hasForecastData = showForecast &&
		! forecastQuery.isPlaceholderData &&
		0 < ( forecastData?.rows.length ?? 0 );

	return (
		<Block className="row-span-1 @lg:col-span-12 group/root">
			<BlockHeading
				title={
					<MetricInfo metricKey="sales_forecast_chart" side="bottom">
						{ isRevenueMode ? __( 'Revenue over time', 'burst-statistics' ) : __( 'Sales over time', 'burst-statistics' ) }
					</MetricInfo>
				}
				className="border-b border-gray-200"
				isLoading={ isFetching }
				controls={
					! showEmptyState ? (
						<div className="flex items-center gap-4 flex-wrap justify-end">
							<ChartLegend items={ legendItems } />

							<div className="flex items-center gap-2">
								<ForecastToggle
									active={ showComparison }
									label={ comparisonLabel }
									onClick={ toggleComparison }
								/>

								{ hasChartData && (
									<ForecastToggle
										active={ showForecast }
										label={ __( 'Forecast', 'burst-statistics' ) }
										onClick={ toggleForecast }
									/>
								) }
							</div>

							<ChartModeFilter id="sales_chart_mode" chartMode={ chartMode } onApply={ setChartMode } />
						</div>
					) : null
				}
			/>

			<BlockContent className="px-0 py-0">
				{ chartQuery.isError && (
					<ChartErrorNotice message={ __( 'Failed to load chart data.', 'burst-statistics' ) } />
				) }

				{ showForecast && forecastQuery.isError && (
					<ChartErrorNotice message={ __( 'Failed to load forecast data.', 'burst-statistics' ) } />
				) }

				{ hasForecastData && forecastData && (
					<ForecastAnnotation
						source="sales"
						mode={ chartMode }
						metadata={ forecastData.metadata }
					/>
				) }

				{ showEmptyState ? (
					<ChartEmptyState
						message={ isRevenueMode ?
							__( 'There is no revenue data available for the selected filters and date range.', 'burst-statistics' ) :
							__( 'There is no sales data available for the selected filters and date range.', 'burst-statistics' ) }
					/>
				) : (
					<div
						style={{ height: 360 }}
						aria-busy={ isFetching }
						className={ isFetching ? 'animate-pulse' : undefined }
					>
						<SalesChartGraph
							data={ chartData }
							mode={ chartMode }
							currency={ chartData.currency ?? 'USD' }
						/>
					</div>
				) }
			</BlockContent>
		</Block>
	);
}
