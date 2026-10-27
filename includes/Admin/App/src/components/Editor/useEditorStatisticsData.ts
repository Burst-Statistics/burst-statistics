import { useMemo, useState } from 'react';
import { useSelect } from '@wordpress/data';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { availableRanges } from '@/utils/formatting';
import { getDatatableData } from '@/utils/api';
import { getDevicesTitleAndValueData } from '@/api/getDevicesData';
import useLicenseData from '@/hooks/useLicenseData';
import { useCompareData } from '@/hooks/useCompareData';
import { useInsightsData } from '@/hooks/useInsightsData';
import { usePageRevisionsBaseData } from '@/hooks/usePageRevisionsData';
import { useScrollAnalyticsBaseData } from '@/hooks/useScrollAnalyticsData';
import { useSearchQueriesBaseData } from '@/hooks/useSearchQueriesData';
import { useVisitorFlowBaseData } from '@/hooks/useVisitorFlowData';
import { isFeatureEnabled } from '@/utils/isFeatureEnabled';
import type { OutgoingLinkRow } from '@/components/OutgoingLinks/useOutgoingLinksData';

type EditorStoreSelect = ( store: string ) => {
	getCurrentPostId?: () => number | undefined;
	getCurrentPostAttribute?: ( attribute: string ) => string | undefined;
	getPermalink?: () => string | undefined;
	getCurrentPost?: () => { link?: string } | undefined;
} | undefined;

interface EditorPostSummary {
	id?: number;
	status?: string;
	pageUrl: string;
}

// fallow-ignore-next-line complexity
const resolveEditorPath = ( rawLink?: string ): string => {
	if ( ! rawLink ) {
		return '';
	}
	const origin = window.location?.origin || 'https://burst.local';
	try {
		return new URL( rawLink, origin ).pathname;
	} catch {
		return rawLink.startsWith( '/' ) ? rawLink : `/${ rawLink }`;
	}
};

// fallow-ignore-next-line complexity
const resolveEditorPost = ( select: EditorStoreSelect ): EditorPostSummary | null => {
	const editor = select( 'core/editor' );
	if ( ! editor ) {
		return null;
	}

	return {
		id: editor.getCurrentPostId?.(),

		// The saved status: an unsaved status change does not affect the live page.
		status: editor.getCurrentPostAttribute?.( 'status' ),
		pageUrl: resolveEditorPath( editor.getPermalink?.() || editor.getCurrentPost?.()?.link )
	};
};

/**
 * Data hook fetching all per-page metrics for the editor panel.
 *
 * @return Editor statistics dataset and query loading states.
 */
// fallow-ignore-next-line complexity
export function useEditorStatisticsData() {

	// Pro sections need both the Pro plugin and a valid license.
	const { isLicenseValid: isPro } = useLicenseData();

	const editorData = useSelect( resolveEditorPost, []);

	const postId = String( editorData?.id ?? '' );
	const pageUrl = editorData?.pageUrl || '';
	const postStatus = editorData?.status || '';

	const isDraft = ! postStatus || ( 'publish' !== postStatus && 'private' !== postStatus );

	const [ rangeKey, setRangeKey ] = useState<string>( 'last-30-days' );

	const { startDate, endDate } = useMemo( () => {
		const rangeDef =
			( availableRanges as Record<string, { range: () => { startDate: Date; endDate: Date } }> )[ rangeKey ] ??
			availableRanges[ 'last-30-days' ];
		const r = rangeDef ? rangeDef.range() : { startDate: new Date(), endDate: new Date() };
		return {
			startDate: format( r.startDate, 'yyyy-MM-dd' ),
			endDate: format( r.endDate, 'yyyy-MM-dd' )
		};
	}, [ rangeKey ]);

	const {
		data: compareData,
		isLoading: isLoadingCompare,
		isPlaceholderData: isPlaceholderCompare
	} = useCompareData({
		startDate,
		endDate,
		range: rangeKey,
		filters: { page_url: pageUrl },
		includePageMetrics: isPro,
		enabled: ! isDraft && Boolean( pageUrl )
	});

	const {
		data: insightsData,
		isLoading: isLoadingInsights,
		isPlaceholderData: isPlaceholderInsights
	} = useInsightsData({
		startDate,
		endDate,
		range: rangeKey,
		metrics: [ 'pageviews' ],
		filters: { page_url: pageUrl },
		enabled: ! isDraft && Boolean( pageUrl )
	});

	const { data: revisionsData } = usePageRevisionsBaseData({
		id: postId,
		pageUrl,
		startDate,
		endDate,
		range: rangeKey,
		filters: {},
		enabled: ! isDraft && isPro && Boolean( postId || pageUrl )
	});

	// The editor loads no settings fields, so the localized flag decides.
	const isScrollDepthEnabled = isFeatureEnabled( 'scroll_depth', undefined, window.burst_settings );
	const { data: scrollData, isLoading: isLoadingScroll } = useScrollAnalyticsBaseData({
		id: postId,
		pageUrl,
		startDate,
		endDate,
		range: rangeKey,
		filters: {},
		enabled: ! isDraft && isPro && isScrollDepthEnabled && Boolean( postId || pageUrl )
	});

	const { data: searchData, isLoading: isLoadingSearch } = useSearchQueriesBaseData({
		id: postId,
		pageUrl,
		startDate,
		endDate,
		range: rangeKey,
		enabled: ! isDraft && isPro && Boolean( postId || pageUrl )
	});

	const { data: flowData, isLoading: isLoadingFlow } = useVisitorFlowBaseData({
		id: postId,
		pageUrl,
		startDate,
		endDate,
		range: rangeKey,
		filters: {},
		enabled: ! isDraft && isPro && Boolean( postId || pageUrl )
	});

	const { data: outgoingLinks, isLoading: isLoadingLinks } = useQuery<OutgoingLinkRow[]>({
		queryKey: [ 'editor-outgoing-links', startDate, endDate, rangeKey, pageUrl ],
		queryFn: async() => {
			const res = await getDatatableData(
				'outgoing-links',
				false,
				startDate,
				endDate,
				rangeKey,
				{ filters: { page_url: pageUrl } }
			);
			const rawRows: Array<Record<string, unknown>> = res?.data?.data ?? [];
			return rawRows.map( ( r ) => ({
				url: String( r.url || '' ),
				clicks: Number( r.clicks ) || 0,
				previousClicks: Number( r.previous_clicks ) || 0,
				previousClicksYoy: Number( r.previous_clicks_yoy ) || 0
			}) ).sort( ( a, b ) => b.clicks - a.clicks );
		},
		enabled: ! isDraft && isPro && Boolean( pageUrl )
	});

	const { data: devicesData, isLoading: isLoadingDevices } = useQuery<
		Record<string, { title: string; value: string; count?: number }>
	>({
		queryKey: [ 'editor-devices', startDate, endDate, rangeKey, pageUrl ],
		queryFn: () => getDevicesTitleAndValueData({
			startDate,
			endDate,
			range: rangeKey,
			filters: {},
			args: { filters: { page_url: pageUrl } }
		} as unknown as Parameters<typeof getDevicesTitleAndValueData>[0]),
		enabled: ! isDraft && Boolean( pageUrl )
	});

	const latestRevision = revisionsData?.revisions?.[ 0 ] ?? null;
	const pageviewsExact = compareData?.pageviews?.exactValue;
	const isZeroVisits =
		! isDraft &&
		! isLoadingCompare &&
		! isPlaceholderCompare &&
		( undefined === pageviewsExact || null === pageviewsExact || 0 === pageviewsExact || '-' === pageviewsExact );

	return {
		isPro,
		isScrollDepthEnabled,
		postId,
		pageUrl,
		isDraft,
		isZeroVisits,
		rangeKey,
		setRangeKey,
		startDate,
		endDate,
		compareData,
		insightsData,
		latestRevision,
		scrollData,
		searchData,
		flowData,
		outgoingLinks,
		devicesData,
		isLoadingCompare,
		isLoadingInsights,
		isPlaceholderCompare,
		isPlaceholderInsights,
		isLoadingScroll,
		isLoadingSearch,
		isLoadingFlow,
		isLoadingLinks,
		isLoadingDevices
	};
}
