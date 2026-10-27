import React from 'react';
import { useEditorStatisticsData } from './useEditorStatisticsData';
import { EmptyState } from './EmptyState';
import { SkeletonState } from './SkeletonState';
import { PeriodSelect } from './PeriodSelect';
import { Headline } from './Headline';
import { KpiGrid } from './KpiGrid';
import { PageviewsTrend } from './PageviewsTrend';
import { CompactScrollDepth } from './CompactScrollDepth';
import { CompactSearchQueries } from './CompactSearchQueries';
import { Subsections } from './Subsections';
import { ProLockedRows } from './ProLockedRows';
import { OpenFullReportButton } from './OpenFullReportButton';

/**
 * Main content body for the per-page statistics panel inside the Gutenberg sidebar.
 *
 * @return Panel content element.
 */
// fallow-ignore-next-line complexity
export const PostStatisticsPanelContent: React.FC = () => {
	const stats = useEditorStatisticsData();

	if ( stats.isDraft ) {
		return <EmptyState />;
	}

	if ( ( stats.isLoadingCompare || stats.isPlaceholderCompare ) && ( stats.isLoadingInsights || stats.isPlaceholderInsights ) ) {
		return (
			<div className="flex flex-col px-4 py-2">
				<SkeletonState />
			</div>
		);
	}

	if ( stats.isZeroVisits ) {
		return (
			<div className="flex flex-col px-4 py-2">
				<PeriodSelect value={ stats.rangeKey } onChange={ stats.setRangeKey } />
				<EmptyState />
			</div>
		);
	}

	return (
		<div className="flex flex-col px-4 py-2">
			{ /* Period selector dropdown matching mockup */ }
			<PeriodSelect value={ stats.rangeKey } onChange={ stats.setRangeKey } />

			{ /* 1. Headline conclusion */ }
			<Headline
				isPro={ stats.isPro }
				latestRevision={ stats.latestRevision }
				pageviewsMetric={ stats.compareData?.pageviews }
				rangeKey={ stats.rangeKey }
			/>

			{ /* 2. KPI grid */ }
			{ stats.compareData && <KpiGrid compareData={ stats.compareData } isPro={ stats.isPro } /> }

			{ /* 3. Pageviews sparkline trendline */ }
			<PageviewsTrend
				insightsData={ stats.insightsData }
				latestRevision={ stats.latestRevision }
				isPro={ stats.isPro }
				startDate={ stats.startDate }
			/>

			{ /* 4. Scroll depth (Pro) */ }
			{ stats.isPro && stats.isScrollDepthEnabled && (
				<CompactScrollDepth
					scrollData={ stats.scrollData }
					isLoading={ stats.isLoadingScroll }
				/>
			) }

			{ /* 5. Search queries (Pro) */ }
			{ stats.isPro && (
				<CompactSearchQueries
					searchData={ stats.searchData }
					isLoading={ stats.isLoadingSearch }
				/>
			) }

			{ /* 6. Pro sub-sections OR Free locked rows */ }
			{ stats.isPro ? (
				<>
					<Subsections
						isPro={ true }
						visitorFlowData={ stats.flowData }
						outgoingLinks={ stats.outgoingLinks ?? [] }
						devicesData={ stats.devicesData }
						isLoadingFlow={ stats.isLoadingFlow }
						isLoadingLinks={ stats.isLoadingLinks }
						isLoadingDevices={ stats.isLoadingDevices }
					/>

					{ /* 7. Open full page report button (Pro only) */ }
					<OpenFullReportButton
						id={ stats.postId }
						pageUrl={ stats.pageUrl }
						range={ stats.rangeKey }
						startDate={ stats.startDate }
						endDate={ stats.endDate }
					/>
				</>
			) : (
				<ProLockedRows />
			) }
		</div>
	);
};
