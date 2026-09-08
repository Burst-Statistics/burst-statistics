import { __, sprintf } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import Icon from '@/utils/Icon';
import { ScrollDepthChart } from './ScrollDepthChart';
import { ScrollDepthInsight } from './ScrollDepthInsight';
import { ScrollDepthDatum } from '@/api/getScrollAnalyticsData';

/**
 * Minimum number of scroll-tracked visits before the chart is shown without a warning.
 * Below this threshold we show a "limited data" notice. Below MIN_BUILDING we show an
 * empty state instead.
 */
const MIN_BUILDING = 0;  // 0 meaningful visits → building state
const MIN_RELIABLE = 100; // ≥ 100 → full graph, no warning

interface ScrollDepthBlockProps {
	data?: {
		totalPageviews: number;
		meaningfulVisits?: number;
		totalRawVisits?: number;
		data: ScrollDepthDatum[];
		insight: {
			range: string;
			dwellSeconds: number;
		};
	};
	isLoadingData?: boolean;
}

/**
 * Skeleton loader shown while scroll analytics data is loading.
 */
const ScrollDepthSkeleton = () => (
	<div className="flex flex-col justify-between h-56 py-2 animate-pulse">
		{ [ 95, 68, 42, 22 ].map( ( width, i ) => (
			<div key={ i } className="flex items-center gap-3">
				<div className="w-12 h-3 shrink-0 rounded bg-gray-200" />
				<div className="h-6 flex-1 rounded-md bg-gray-100 overflow-hidden">
					<div
						className="h-full rounded-md bg-gray-200"
						style={{ width: `${ width }%` }}
					/>
				</div>
				<div className="w-8 h-3 shrink-0 rounded bg-gray-200" />
			</div>
		) ) }
	</div>
);

/**
 * "Building dataset" empty state shown when no scroll data exists yet.
 */
const BuildingState = () => (
	<div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
		<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
			<Icon
				name="empty"
				size={ 24 }
				color=""
				className="text-gray-400"
			/>
		</div>
		<div>
			<p className="mb-1 font-semibold text-text-black">
				{ __( 'Building your scroll dataset', 'burst-statistics' ) }
			</p>
			<p className="max-w-xs text-sm text-text-gray">
				{ __(
					'Once visitors start scrolling this page, depth data will appear here automatically.',
					'burst-statistics'
				) }
			</p>
		</div>
	</div>
);

/**
 * Warning badge shown when the dataset is small and results may be unreliable.
 *
 * @param props             - Component props.
 * @param props.count       - Number of meaningful visits so far.
 * @param props.minReliable - Threshold to be considered reliable.
 */
const LimitedDataBadge = ({ count, minReliable }: { count: number; minReliable: number }) => (
	<div className="mb-3 flex items-start gap-2.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-text-black">
		<Icon
			name="warning-triangle"
			size={ 16 }
			color=""
			className="mt-0.5 shrink-0 text-orange-500"
		/>
		<span className="leading-snug">
			{ sprintf(

				/* translators: 1: current count, 2: min reliable threshold */
				__( 'Limited data — %1$d sessions tracked (need %2$d+ for reliable insights)', 'burst-statistics' ),
				count,
				minReliable
			) }
		</span>
	</div>
);

/**
 * Displays scroll reach and dwell time for the selected page.
 * Renders three quality states: building (no data), limited-data warning, and full chart.
 *
 * @param props               - Component props.
 * @param props.data          - Live scroll depth statistics from the API.
 * @param props.isLoadingData - Whether the data is currently loading.
 * @return Scroll-depth analytics block.
 */
export const ScrollDepthBlock = ({ data, isLoadingData = false }: ScrollDepthBlockProps ) => {
	const meaningfulVisits = data?.meaningfulVisits ?? data?.totalPageviews ?? 0;
	const isBuilding  = ! isLoadingData && ( ! data || meaningfulVisits <= MIN_BUILDING );
	const isLimited   = ! isLoadingData && ! isBuilding && meaningfulVisits < MIN_RELIABLE;

	return (
		<Block className="@lg:col-span-6 @xl:col-span-3">
			<BlockHeading
				title={ __( 'Scroll depth', 'burst-statistics' ) }
				className="border-b border-gray-200"
				isLoading={ isLoadingData }
			/>
			<BlockContent className="pt-3 pb-5">
				{ isLoadingData ? (
					<ScrollDepthSkeleton />
				) : isBuilding ? (
					<BuildingState />
				) : (
					<>
						{ isLimited && (
							<LimitedDataBadge
								count={ meaningfulVisits }
								minReliable={ MIN_RELIABLE }
							/>
						) }
						<ScrollDepthChart
							data={ data?.data }
							meaningfulVisits={ meaningfulVisits }
						/>
					</>
				) }
			</BlockContent>
			{ ! isLoadingData && ! isBuilding && data?.insight?.range && (
				<BlockFooter className="justify-start border-t border-gray-200 py-4">
					<ScrollDepthInsight insight={ data.insight } />
				</BlockFooter>
			) }
		</Block>
	);
};
