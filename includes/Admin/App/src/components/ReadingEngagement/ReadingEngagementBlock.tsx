import { memo, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useReadingEngagementData } from './useReadingEngagementData';
import { getReadingEngagementColumns } from './columns';
import MetricInfo from '@/components/Common/MetricInfo';

type ReadingEngagementBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/** Maximum rows shown in the compact block view. */
const TOP_N = 5;

/**
 * Compact dashboard block showing the top pages by reading engagement.
 *
 * Features an embedded duration bar, a clickable page link, a toggle to
 * switch between the longest and lowest times on page, and an expand button
 * that opens the full table in the DataTableOverlay.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The reading engagement block.
 */
const ReadingEngagementBlock = memo( ({ className = '' }: ReadingEngagementBlockProps ) => {
	const [ leastEngagement, setLeastEngagement ] = useState( false );
	const { data, isLoading } = useReadingEngagementData({ leastEngagement });

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const siteUrl =
		( window as unknown as { burst_settings?: { site_url?: string } })
			?.burst_settings?.site_url ?? window.location.origin;

	const columns = useMemo(
		() => getReadingEngagementColumns({ siteUrl }),
		[ siteUrl ]
	);

	const slicedData = useMemo( () => {
		return data.slice( 0, TOP_N );
	}, [ data ]);

	/**
	 * Navigate to the fullscreen overlay with the reading_engagement variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'reading_engagement' },
			search: {
				from: location.pathname,
				allowed: 'reading_engagement',
				dataTableId: 'reading-engagement',
				...location.search
			}
		});
	};

	return (
		<Block className={className}>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={isLoading}
				title={<>
					<MetricInfo metricKey="reading_engagement" side="bottom">
						{__( 'Reading engagement', 'burst-statistics' )}
					</MetricInfo>
					{/* Expand to overlay. */}
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
						onClick={handleExpand}
						aria-label={__( 'Expand table', 'burst-statistics' )}
						title={__( 'Expand table', 'burst-statistics' )}
					>
						<Icon name="expand" size={14} />
					</button></>}
				controls={
					<div className="flex items-center gap-2">
						{/* Least engagement toggle. */}
						<label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-gray select-none">
							<Checkbox.Root
								className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
								id="reading-engagement-least"
								checked={leastEngagement}
								aria-label={__( 'Show lowest reading engagement pages', 'burst-statistics' )}
								onCheckedChange={( checked ) => setLeastEngagement( true === checked )}
							>
								<Checkbox.Indicator>
									<Icon name="check" size={11} color="green" strokeWidth={2.5} />
								</Checkbox.Indicator>
							</Checkbox.Root>
							{__( 'Lowest engagement', 'burst-statistics' )}
						</label>
					</div>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={slicedData}
					rowKey={( row ) => row.page_url as string}
					barColumnKey="avg_time_on_page"
					isLoading={isLoading}
					emptyState={
						__( 'No reading engagement data recorded yet.', 'burst-statistics' )
					}
				/>
			</BlockContent>
		</Block>
	);
});

ReadingEngagementBlock.displayName = 'ReadingEngagementBlock';

export default ReadingEngagementBlock;
