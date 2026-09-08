/**
 * Growth Component.
 */

import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import { ForecastAnnotation } from '@/components/Forecast';
import { getGrowthData, GrowthBlockData } from '@/api/getGrowthData';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { BlockComponentProps } from '@/store/reports/types';

// Metric-explainer keys per row, resolved in metricDefinitions.js.
const GROWTH_METRIC_KEYS: Record<string, string> = {
	'forecast-this-year': 'growth_forecast_this_year',
	'forecast-this-month': 'growth_forecast_this_month',
	'forecast-next-year': 'growth_forecast_next_year',
	'forecast-next-month': 'growth_forecast_next_month'
};

const PLACEHOLDER_DATA: GrowthBlockData = {
	items: Object.fromEntries(
		Object.keys( GROWTH_METRIC_KEYS ).map( ( key ) => [
			key,
			{
				title: '-',
				subtitle: '-',
				value: '-',
				exactValue: null,
				change: null,
				changeStatus: null,
				tooltipText: null,
				isForecast: key.startsWith( 'forecast' )
			}
		])
	),
	metadata: {
		growth_rate: 0,
		limited_data: true
	}
};

/**
 * Growth component: the forecasted revenue for the current month and year,
 * and for the next month and year. Calendar-anchored to now — the picked
 * date range deliberately does not apply, matching the forecast view of the
 * revenue chart it sits next to; visitor filters do apply.
 *
 * @return {JSX.Element} The Growth component.
 */
const GrowthBlock = ( props: BlockComponentProps ): JSX.Element => {
	const { startDate, endDate, range, filters, index } = useBlockConfig( props );

	const growthQuery = useQuery<GrowthBlockData>({
		queryKey: [ 'growth', filters ],
		queryFn: () => getGrowthData({
			startDate,
			endDate,
			range,
			filters: filters as Record<string, unknown>
		}),
		placeholderData: PLACEHOLDER_DATA,
		gcTime: 10000
	});

	const growth = growthQuery.data ?? PLACEHOLDER_DATA;
	const showAnnotation = ! growthQuery.isPlaceholderData && ! growthQuery.isError;

	const blockHeadingProps = {
		title: __( 'Growth', 'burst-statistics' ),
		isReport: props.isReport,
		reportBlockIndex: index,
		isLoading: growthQuery.isFetching
	};

	return (
		<Block className="row-span-1 @xl:col-span-3 block-growth">
			<BlockHeading { ...blockHeadingProps } />

			<BlockContent>
				{ Object.entries( growth.items ).map( ([ key, item ]) => (
					<ExplanationAndStatsItem
						key={ key }
						iconKey={ item.isForecast ? 'trending-up' : 'banknote' }
						metricKey={ GROWTH_METRIC_KEYS[ key ] ?? null }
						title={ item.title }
						subtitle={ item.subtitle }
						value={ item.value }
						exactValue={ item.exactValue }
						change={ item.change }
						changeStatus={ item.changeStatus }
						tooltipText={ item.tooltipText }
						className={ key }
					/>
				) ) }

				{ showAnnotation && (
					<ForecastAnnotation
						source="sales"
						mode="revenue"
						metadata={ growth.metadata }
						className="pt-2"
					/>
				) }
			</BlockContent>
		</Block>
	);
};

export default GrowthBlock;
