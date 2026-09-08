import React from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { useVisitorFlowData } from '@/hooks/useVisitorFlowData';
import { usePageRevisionsData } from '@/hooks/usePageRevisionsData';
import { useScrollAnalyticsData } from '@/hooks/useScrollAnalyticsData';
import { VisitorFlowDiagramBlock } from '@/components/Pages/VisitorFlowDiagram/VisitorFlowDiagramBlock';
import { PageRevisionsBlock } from '@/components/Pages/PageRevisions/PageRevisionsBlock';
import { PageSummaryBlock } from '@/components/Pages/PageSummary';
import { PageCompareBlock } from '@/components/Pages/PageCompareBlock';
import { PageDevicesBlock } from '@/components/Pages/PageDevicesBlock';
import { PageOutgoingLinksBlock } from '@/components/Pages/PageOutgoingLinksBlock';
import { SearchQueriesBlock } from '@/components/Pages/SearchQueries';
import {
	ScrollDepthBlock
} from '@/components/Pages/ScrollAnalytics';

/**
 * PerPage — Overlay page view for per-page visitor flow, scroll analytics, and revision impact.
 *
 * Resolved via the /page/$id route. Reads the page ID from route params
 * and the page URL from validated search params.
 *
 * @return {JSX.Element} The per-page overlay content.
 */
// fallow-ignore-next-line complexity
export const PerPage: React.FC = () => {
	const { id } = useParams({ strict: false });
	const { pageUrl } = useSearch({ strict: false });

	const { data: flowData, isLoading: isFlowLoading } = useVisitorFlowData({
		id: id || '',
		pageUrl: pageUrl || ''
	});

	const { data: revisionsData, isLoading: isRevisionsLoading } = usePageRevisionsData({
		id: id || '',
		pageUrl: pageUrl || ''
	});

	const { data: scrollData, isLoading: isScrollLoading } = useScrollAnalyticsData({
		id: id || '',
		pageUrl: pageUrl || ''
	});

	return (
		<div className="grid w-full grid-cols-12 gap-6 pb-8">
			<PageSummaryBlock
				pageId={id || ''}
				pageUrl={pageUrl || ''}
			/>

			<PageCompareBlock pageUrl={pageUrl || ''} />

			<ScrollDepthBlock
				data={scrollData?.scroll_depth}
				isLoadingData={isScrollLoading}
			/>

			<SearchQueriesBlock
				id={id || ''}
				pageUrl={pageUrl || ''}
			/>

			<VisitorFlowDiagramBlock
				data={flowData}
				isLoadingData={isFlowLoading}
				fallbackPageUrl={pageUrl || ''}
			/>

			<PageRevisionsBlock
				data={revisionsData}
				isLoadingData={isRevisionsLoading}
				fallbackPageUrl={pageUrl || ''}
			/>

			<PageOutgoingLinksBlock pageUrl={pageUrl || ''} />

			<PageDevicesBlock pageUrl={pageUrl || ''} />
		</div>
	);
};
