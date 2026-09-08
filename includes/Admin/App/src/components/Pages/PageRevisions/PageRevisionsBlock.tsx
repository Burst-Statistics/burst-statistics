import React, { useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import Icon from '@/utils/Icon';
import type { PageRevisionsData } from '@/api/getPageRevisionsData';
import PageRevisionsGraph from './PageRevisionsGraph';
import PageRevisionsList from './PageRevisionsList';

interface PageRevisionsBlockProps {
	data?: PageRevisionsData;
	isLoadingData?: boolean;
	fallbackPageUrl?: string;
}

/**
 * Stable loading placeholder matching the block's approximate layout.
 *
 * @return {JSX.Element} Loading skeleton.
 */
const PageRevisionsSkeleton: React.FC = () => (
	<div
		className="animate-pulse"
		aria-label={__( 'Loading revision impact', 'burst-statistics' )}
	>
		<div className="h-48 rounded-lg bg-gray-100 mb-4" />
		{Array.from({ length: 3 }).map( ( _, i ) => (
			<div key={i} className="flex justify-between px-3 py-3">
				<div className="flex gap-3">
					<div className="mt-1 h-2.5 w-2.5 rounded-full bg-gray-200 flex-shrink-0" />
					<div className="flex flex-col gap-1.5">
						<div className="h-3 w-28 rounded bg-gray-200" />
						<div className="h-3 w-44 rounded bg-gray-200" />
					</div>
				</div>
				<div className="flex flex-col items-end gap-1.5">
					<div className="h-3 w-12 rounded bg-gray-200" />
					<div className="h-3 w-20 rounded bg-gray-200" />
				</div>
			</div>
		) )}
	</div>
);

/**
 * Empty state for when no revisions exist for the page.
 *
 * @return {JSX.Element} Empty state.
 */
const PageRevisionsEmpty: React.FC = () => (
	<div className="flex h-44 flex-col items-center justify-center gap-2 text-center px-4 py-6">
		<div className="flex size-10 items-center justify-center rounded-full bg-gray-100 mb-1">
			<Icon name="page" size={20} color="gray" />
		</div>
		<p className="m-0 text-md font-semibold text-text-black">
			{__( 'No revisions found for this page in the selected date range', 'burst-statistics' )}
		</p>
		<p className="m-0 text-sm text-text-gray max-w-md">
			{__( 'WordPress revisions will appear here automatically when content updates are published, tracking their effect on user engagement.', 'burst-statistics' )}
		</p>
	</div>
);

/**
 * PageRevisionsBlock — main block component for the Revision Impact feature.
 * Renders engagement score chart with revision markers and a ranked revision list.
 *
 * @param {PageRevisionsBlockProps} props - Component props.
 * @return {JSX.Element} The revision impact block.
 */
// fallow-ignore-next-line complexity
export const PageRevisionsBlock: React.FC<PageRevisionsBlockProps> = ({
	data,
	isLoadingData = false
}) => {
	const hasNoRevisions = ! data || 0 === data.revisions.length;

	// Default-select the latest (most recent) revision.
	const defaultSelected = useMemo( (): number | null => {
		if ( ! data?.revisions.length ) {
			return null;
		}
		return data.revisions[0]?.id ?? null;
	}, [ data ]);

	const [ selectedRevisionId, setSelectedRevisionId ] = useState<number | null>(
		defaultSelected
	);

	// Sync default selection when data first loads.
	const effectiveSelected =
		null === selectedRevisionId ? defaultSelected : selectedRevisionId;

	return (
		<Block className="row-span-1 @lg:col-span-12 @xl:col-span-6 group/root">
			<BlockHeading
				title={__( 'Revision impact', 'burst-statistics' )}
				className="border-b border-gray-200"
				isLoading={isLoadingData}
			/>

			<BlockContent className="flex flex-col gap-0 py-4">
				{isLoadingData && <PageRevisionsSkeleton />}

				{! isLoadingData && hasNoRevisions && <PageRevisionsEmpty />}

				{! isLoadingData && ! hasNoRevisions && (
					<>
						{/* Chart area */}
						<div style={{ height: 300 }} className="px-0">
							<PageRevisionsGraph
								timestamps={data?.timestamps ?? []}
								engagementSeries={data?.engagementSeries ?? []}
								revisions={data?.revisions ?? []}
								selectedRevisionId={effectiveSelected}
								onRevisionSelect={setSelectedRevisionId}
							/>
						</div>

						{/* Divider */}
						<div className="border-t border-gray-100 mt-2 mb-1" />

						{/* Revision list */}
						<PageRevisionsList
							revisions={data?.revisions ?? []}
							selectedRevisionId={effectiveSelected}
							onRevisionSelect={setSelectedRevisionId}
						/>
					</>
				)}
			</BlockContent>
		</Block>
	);
};
