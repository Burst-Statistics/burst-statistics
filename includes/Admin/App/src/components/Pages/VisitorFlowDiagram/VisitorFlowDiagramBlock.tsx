import React, { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import Icon from '@/utils/Icon';
import { VisitorFlowData } from '@/api/getVisitorFlowData';
import type {
	FlowDestinationRow,
	FlowDestinationType,
	FlowSourceRow,
	FlowSourceType,
	VisitorFlowPayload
} from './types';
import { VisitorFlowLegend } from './VisitorFlowLegend';
import { VisitorFlowSankey } from './VisitorFlowSankey';

interface VisitorFlowDiagramBlockProps {
	data?: VisitorFlowData;
	isLoadingData?: boolean;
	fallbackPageUrl?: string;
}

/**
 * Maps the live backend visitor-flow payload into internal Sankey types.
 *
 * @param realData - Live REST API response.
 * @param fallbackPageUrl - Target page URL path from search params.
 * @return Internal Sankey payload structure.
 */
const transformRealDataToPayload = (
	data: VisitorFlowData | undefined,
	fallbackPageUrl: string
): VisitorFlowPayload => {
	if ( ! data || ! data.target ) {
		return {
			pagePath: fallbackPageUrl || '/',
			totalSessions: 0,
			sequencedSessions: 0,
			sources: [],
			destinations: []
		};
	}

	const sources: FlowSourceRow[] = ( data.entries || []).map( ( entry, i ) => ({
		id: `source-${ i }`,
		label: entry.name,
		type: ( 'page' === entry.type ? 'internal' : entry.type ) as FlowSourceType,
		sessions: entry.count
	}) );

	const destinations: FlowDestinationRow[] = ( data.exits || []).map( ( exit, i ) => ({
		id: `dest-${ i }`,
		label: exit.name,
		type: ( 'page' === exit.type ? 'internal' : exit.type ) as FlowDestinationType,
		sessions: exit.count
	}) );

	const sequenced =
		sources.reduce( ( a, b ) => a + b.sessions, 0 ) +
		destinations.reduce( ( a, b ) => a + b.sessions, 0 );

	return {
		pagePath: data.target.url || fallbackPageUrl || '/',
		totalSessions: data.target.total_visitors || 0,
		sequencedSessions: sequenced,
		sources,
		destinations
	};
};

/**
 * Renders a stable loading placeholder matching the visitor-flow layout.
 *
 * @return Visitor-flow loading skeleton.
 */
const VisitorFlowSkeleton = () => (
	<div
		className="animate-pulse"
		aria-label={__( 'Loading visitor flow', 'burst-statistics' )}
	>
		<div className="mb-5 h-4 w-2/5 rounded bg-gray-200" />
		<div className="mb-6 flex flex-wrap gap-3">
			{Array.from({ length: 6 }).map( ( _, index ) => (
				<div key={index} className="h-3 w-20 rounded bg-gray-200" />
			) )}
		</div>
		<div className="h-80 rounded-lg bg-gray-50" />
	</div>
);

/**
 * Renders the no-data state for the selected date range.
 *
 * @return Visitor-flow empty state.
 */
const VisitorFlowEmpty = () => (
	<div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
		<div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
			<Icon name="visitors" size={20} color="gray" />
		</div>
		<p className="m-0 text-md font-medium text-text-black">
			{__( 'No visitor flow data for this date range.', 'burst-statistics' )}
		</p>
	</div>
);

/**
 * Renders the production visitor-flow Sankey block connected to global date picker & backend API.
 *
 * @param props                 - Component props.
 * @param props.data            - Real backend VisitorFlowData from API.
 * @param props.isLoadingData   - Loading state from API fetcher.
 * @param props.fallbackPageUrl - Page URL fallback.
 * @return Visitor-flow analytics block.
 */
// fallow-ignore-next-line complexity
export const VisitorFlowDiagramBlock: React.FC<VisitorFlowDiagramBlockProps> = ({
	data,
	isLoadingData = false,
	fallbackPageUrl = '/'
}) => {
	const payload = useMemo(
		() => transformRealDataToPayload( data, fallbackPageUrl ),
		[ data, fallbackPageUrl ]
	);

	const isEmpty =
		0 === payload.sequencedSessions ||
		( 0 === payload.sources.length && 0 === payload.destinations.length );

	return (
		<Block className="row-span-1 @lg:col-span-12 @xl:col-span-6 group/root">
			<BlockHeading
				title={__( 'Visitor flow', 'burst-statistics' )}
				className="border-b border-gray-200"
				isLoading={isLoadingData}
			/>

			<BlockContent className="flex flex-col gap-4 py-5 px-0">
				{isLoadingData && <VisitorFlowSkeleton />}
				{! isLoadingData && isEmpty && <VisitorFlowEmpty />}
				{! isLoadingData && ! isEmpty && (
					<>
						<VisitorFlowSankey payload={payload} />
					</>
				)}
			</BlockContent>

			<BlockFooter className="border-t border-gray-200 justify-start">
				<VisitorFlowLegend />
			</BlockFooter>
		</Block>
	);
};
