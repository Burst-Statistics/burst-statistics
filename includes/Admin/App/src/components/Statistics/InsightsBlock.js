import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import InsightsHeader from './InsightsHeader';
import { useInsightsStore } from '../../store/useInsightsStore';
import { useCompareStore } from '../../store/useCompareStore';
import InsightsGraph from './InsightsGraph';
import { useQuery } from '@tanstack/react-query';
import getInsightsData from '@/api/getInsightsData';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { METRIC_LABELS, METRIC_COLORS } from './insightsConfig';

/**
 * Legend displayed in the BlockHeading controls area.
 * Items are driven by the datasets returned from the API, so comparison entries
 * automatically appear with a dashed swatch when a comparison series is present.
 *
 * @param {Object}  props          - Component props.
 * @param {Array}   props.datasets - Dataset array from the API response.
 * @param {boolean} props.loading  - Whether the chart is in a loading state.
 * @return {JSX.Element|null} The legend element, or null when no datasets are present.
 */
function InsightsLegend({ datasets, loading }) {
	if ( ! datasets?.length ) {
		return null;
	}

	return (
		<div className="flex items-center gap-4">
			{ datasets.map( ( dataset, i ) => {
				const isComparison = Boolean( dataset.is_comparison );
				const metricKey = dataset.metric_key ?? dataset.label;

				const color = loading ?
					'var(--color-gray-400)' :
					( isComparison ? 'var(--color-gray-400)' : ( METRIC_COLORS[ metricKey ] ?? 'var(--color-gray-400)' ) );

				// Derive a human-readable label for the comparison mode.
				let label;
				if ( isComparison ) {
					label = 'year_over_year' === dataset.compare_mode ?
						__( 'Year over year', 'burst-statistics' ) :
						__( 'Previous period', 'burst-statistics' );
				} else {
					label = METRIC_LABELS[ metricKey ] ?? metricKey;
				}

				return (
					<div key={ i } className="flex items-center gap-1.5">
						{ isComparison ? (

							// Dashed swatch for comparison series.
							<svg
								width="10"
								height="10"
								viewBox="0 0 10 10"
								className="flex-shrink-0"
								aria-hidden="true"
							>
								<line
									x1="0"
									y1="5"
									x2="10"
									y2="5"
									stroke={ color }
									strokeWidth="2"
									strokeDasharray="3 2"
								/>
							</svg>
						) : (
							<span
								className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
								style={{ backgroundColor: color }}
							/>
						) }
						<span className="text-sm text-gray-500">
							{ label }
						</span>
					</div>
				);
			}) }
		</div>
	);
}

//eslint-disable-next-line
const InsightsBlock = (props) => {
	const { startDate, endDate, range, filters, allowBlockFilters, isReport, index } = useBlockConfig( props );

	const metrics = useInsightsStore( ( state ) => state.getMetrics() );
	const groupBy = useInsightsStore( ( state ) => state.groupBy );
	const compareMode = useCompareStore( ( state ) => state.compareMode );

	// Pass compare_mode only when a single metric is active — comparison is not
	// meaningful when multiple series are already overlaid on the chart.
	const isSingleMetric = 1 === metrics.length;
	const args = {
		filters,
		metrics,

		// Forward the user's grouping choice. 'auto' is the backend default but
		// we send it explicitly so changes from the popover always invalidate
		// the cached query above.
		group_by: groupBy,
		...( isSingleMetric && { compare_mode: compareMode })
	};

	const query = useQuery({
		queryKey: [ 'insights', metrics, startDate, endDate, compareMode, groupBy, args ],
		queryFn: () => getInsightsData({ startDate, endDate, range, args }),
		placeholderData: {
			timestamps: [ 0, 0, 0, 0, 0, 0, 0 ],
			interval: 'day',
			spans_multiple_years: false,
			datasets: [
				{
					data: [ 0, 0, 0, 0, 0, 0, 0 ],
					backgroundColor: 'var(--color-blue-400)',
					borderColor: 'var(--color-blue-400)',
					label: '-',
					metric_key: 'placeholder_a',
					is_comparison: false,
					fill: 'false'
				},
				{
					data: [ 0, 0, 0, 0, 0, 0, 0 ],
					backgroundColor: 'var(--color-yellow-500)',
					borderColor: 'var(--color-yellow-500)',
					label: '-',
					metric_key: 'placeholder_b',
					is_comparison: false,
					fill: 'false'
				}
			]
		}
	});

	const loading = query.isLoading || query.isFetching;

	return (
		<Block className="row-span-1 @lg:col-span-12 @xl:col-span-6 min-h-96 group/root">
			<BlockHeading
				title={__( 'Insights', 'burst-statistics' )}
				className="border-b border-gray-200"
				isReport={isReport}
				reportBlockIndex={index}
				isLoading={loading}
				controls={
					<div className="flex items-center gap-4">
						<InsightsLegend
							datasets={ query.data?.datasets }
							loading={ loading }
						/>
						{ allowBlockFilters && (
							<InsightsHeader
								selectedMetrics={metrics}
								filters={filters}
							/>
						) }
					</div>
				}
			/>
			<BlockContent className="px-0 py-0 h-75">
				{
					query.data && InsightsGraph && (
						<InsightsGraph
							loading={loading}
							data={query.data}
							timestamps={query.data.timestamps}
							interval={query.data.interval}
							spansMultipleYears={query.data.spans_multiple_years}
						/>
					)
				}
			</BlockContent>
		</Block>
	);
};

export default InsightsBlock;
