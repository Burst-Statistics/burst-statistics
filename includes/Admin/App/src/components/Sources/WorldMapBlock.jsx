import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { memo } from 'react';
import WorldMap from '@/components/Sources/WorldMap/WorldMap';
import WorldMapHeader from '@/components/Sources/WorldMap/WorldMapHeader';
import ErrorBoundary from '../Common/ErrorBoundary';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { useGeoAnalytics } from '@/hooks/useGeoAnalytics';
import MetricInfo from '@/components/Common/MetricInfo';

const WorldMapBlock = ( props ) => {
	const { allowBlockFilters, isReport, index } = useBlockConfig( props );
	const { isFetching: isGeoFetching } = useGeoAnalytics( props );

	return (
		<Block className="row-span-2 @xl:col-span-6 group/root">
			<ErrorBoundary>
				<BlockHeading
					className="border-b border-gray-200"
					title={
						<MetricInfo metricKey="world_view" side="bottom">
							{__( 'World view', 'burst-statistics' )}
						</MetricInfo>
					}
					isReport={isReport}
					reportBlockIndex={index}
					isLoading={isGeoFetching}
					controls={allowBlockFilters ? <WorldMapHeader /> : undefined}
				/>
				<BlockContent className="px-0 py-0">
					<WorldMap {...props}/>
				</BlockContent>
			</ErrorBoundary>
		</Block>
	);
};

// Export a memoized version of the component
export default memo( WorldMapBlock );
