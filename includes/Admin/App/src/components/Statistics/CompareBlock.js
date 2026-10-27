import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import { __ } from '@wordpress/i18n';
import CompareFooter from './CompareFooter';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { useCompareStore } from '@/store/useCompareStore';
import useMetricComparison from '@/hooks/useMetricComparison';
import { useCompareData } from '@/hooks/useCompareData';

//eslint-disable-next-line
const CompareBlock = ( props ) => {
	const {
		title = __( 'Compare', 'burst-statistics' ),
		showCommunityComparison = true,
		includePageMetrics = false,
		enabled = true
	} = props;
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );
	const getComparison = useMetricComparison( filters );
	const compareMode = useCompareStore( ( state ) => state.compareMode );

	const query = useCompareData({
		startDate,
		endDate,
		range,
		compareMode,
		filters,
		includePageMetrics,
		enabled
	});

	const isLoading = query.isLoading || query.isFetching;
	const data = query.data || {};
	const { compareStart, compareEnd } = query;

	// If query is fetched and all .change values are empty, set compareNotAvailable to true.
	const compareNotAvailable = ! Object.keys( data ).some(
		( key ) => '' !== data[ key ].change
	);

	return (
		<Block className="row-span-1 @lg:col-span-6 @xl:col-span-3">
			<BlockHeading title={ title } isReport={ isReport } reportBlockIndex={ index } isLoading={ isLoading } />
			<BlockContent>
			{/* fallow-ignore-next-line complexity */}
			{ Object.keys( data ).map( ( key, i ) => {
				const m = data[ key ];
				const communityComparison = showCommunityComparison ?
					getComparison( m.communityMetricKey, m.communityMetricValue ) :
					null;

				return (
					<ExplanationAndStatsItem
						key={ i }
						iconKey={ 'avg_time_on_page' === key ? 'time' : key }
						title={ m.title }
						subtitle={ m.subtitle }
						value={ m.value }
						exactValue={ m.exactValue }
						change={ m.change }
						changeStatus={ m.changeStatus }
						metricKey={ 'avg_time_on_page' === key ? 'time_on_page' : key }
						communityComparison={ communityComparison }
					/>
				);
			}) }
			</BlockContent>
			<BlockFooter>
				<CompareFooter
					noCompare={ compareNotAvailable }
					startDate={ startDate }
					endDate={ endDate }
					compareMode={ compareMode }
					compareStart={ compareStart }
					compareEnd={ compareEnd }
				/>
			</BlockFooter>
		</Block>
	);
};

export default CompareBlock;
