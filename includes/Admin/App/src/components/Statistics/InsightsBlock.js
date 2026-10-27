import { __ } from '@wordpress/i18n';
import { useEffect } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import InsightsHeader from './InsightsHeader';
import { useInsightsStore, groupByFitsRange } from '../../store/useInsightsStore';
import { useCompareStore } from '../../store/useCompareStore';
import InsightsGraph from './InsightsGraph';
import { useInsightsData } from '@/hooks/useInsightsData';
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
			{/* fallow-ignore-next-line complexity */}
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

					// While loading, placeholder datasets carry internal metric
					// keys (e.g. 'placeholder_a') that should never be shown.
					label = METRIC_LABELS[ metricKey ] ?? ( loading ? '…' : metricKey );
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
// fallow-ignore-next-line complexity
const InsightsBlock = ( props ) => {
	const { startDate, endDate, range, filters, allowBlockFilters, isReport, index } = useBlockConfig( props );

	const metrics = useInsightsStore( ( state ) => state.getMetrics() );
	const groupBy = useInsightsStore( ( state ) => state.groupBy );
	const setGroupBy = useInsightsStore( ( state ) => state.setGroupBy );
	const compareMode = useCompareStore( ( state ) => state.compareMode );

	// When the date range shrinks below the selected grouping (e.g. 'month'
	// while viewing last 7 days) the chart would collapse into a single point,
	// so fall back to 'auto'. The query below uses the effective value right
	// away; the effect also resets the store so the popover reflects it.
	const groupByFits = groupByFitsRange( groupBy, startDate, endDate );
	const effectiveGroupBy = groupByFits ? groupBy : 'auto';

	useEffect( () => {
		if ( ! groupByFits ) {
			setGroupBy( 'auto' );
		}
	}, [ groupByFits, setGroupBy ]);

	const query = useInsightsData({
		startDate,
		endDate,
		range,
		metrics,
		groupBy: effectiveGroupBy,
		compareMode,
		filters
	});

	const loading = query.isLoading || query.isFetching;

	return (
		<Block data-tour="insights-graph" className="row-span-1 @lg:col-span-12 @xl:col-span-6 min-h-96 group/root">
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
