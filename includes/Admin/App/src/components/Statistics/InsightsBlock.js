import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import InsightsHeader from './InsightsHeader';
import { useInsightsStore } from '../../store/useInsightsStore';
import InsightsGraph from './InsightsGraph';
import { useQuery } from '@tanstack/react-query';
import getInsightsData from '../../api/getInsightsData';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { METRIC_LABELS, METRIC_COLORS } from './insightsConfig';

/**
 * Legend displayed in the BlockHeading controls area.
 * Items are driven by the currently selected metrics (always up-to-date),
 * with colors pulled from the corresponding dataset by index.
 *
 * @param {Object}   props          - Component props.
 * @param {string[]} props.metrics  - Currently selected metric keys.
 * @param {Array}    props.datasets - Chart.js dataset array used for color lookup.
 * @param {boolean}  props.loading  - Whether the chart is in a loading state.
 * @return {JSX.Element|null} The legend element, or null when no metrics are selected.
 */
function InsightsLegend({ metrics, loading }) {
	if ( ! metrics?.length ) {
		return null;
	}

	return (
		<div className="flex items-center gap-4">
			{ metrics.map( ( key ) => (
				<div key={ key } className="flex items-center gap-1.5">
					<span
						className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
						style={{
							backgroundColor: loading ?
								'var(--color-gray-400)' :
								( METRIC_COLORS[ key ] ?? 'var(--color-gray-400)' )
						}}
					/>
					<span className="text-sm text-gray-500">
						{ METRIC_LABELS[ key ] ?? key }
					</span>
				</div>
			) ) }
		</div>
	);
}

//eslint-disable-next-line
const InsightsBlock = (props) => {
	const { startDate, endDate, range, filters, allowBlockFilters, isReport, index } = useBlockConfig( props );

	const metrics = useInsightsStore( ( state ) => state.getMetrics() );

	const args = { filters, metrics };

	const query = useQuery({
		queryKey: [ 'insights', metrics, startDate, endDate, args ],
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
					fill: 'false'
				},
				{
					data: [ 0, 0, 0, 0, 0, 0, 0 ],
					backgroundColor: 'var(--color-yellow-500)',
					borderColor: 'var(--color-yellow-500)',
					label: '-',
					fill: 'false'
				}
			]
		}
	});

	const loading = query.isLoading || query.isFetching;

	return (
		<Block className="row-span-1 lg:col-span-12 xl:col-span-6 min-h-96 group/root">
			<BlockHeading
				title={__( 'Insights', 'burst-statistics' )}
				className="border-b border-gray-200"
				isReport={isReport}
				reportBlockIndex={index}
				isLoading={loading}
				controls={
					<div className="flex items-center gap-4">
						<InsightsLegend
							metrics={ metrics }
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
							metrics={metrics}
						/>
					)
				}
			</BlockContent>
		</Block>
	);
};

export default InsightsBlock;
