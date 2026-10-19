import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ExpandableBlockTitle from '@/components/Blocks/ExpandableBlockTitle';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useExpandableTopBlock } from '@/hooks/useExpandableTopBlock';
import { useNotFoundPagesData } from './useNotFoundPagesData';
import NotFoundHitsCell from './NotFoundHitsCell';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { NotFoundPageRow } from './useNotFoundPagesData';

type NotFoundPagesBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/**
	* Compact dashboard block showing the top 404 pages.
	*/
const NotFoundPagesBlock = memo( ({ className = '' }: NotFoundPagesBlockProps ) => {
	const { data, isLoading } = useNotFoundPagesData();

	const siteUrl =
		( window as unknown as { burst_settings?: { site_url?: string } })
			?.burst_settings?.site_url ?? window.location.origin;

	const columns = useMemo<BarColumn<NotFoundPageRow>[]>(
		() => [
			{
				key: 'page_url',
				label: __( 'Page URL', 'burst-statistics' ),
				align: 'left',
				minWidth: 160,
				cell: ( row ) => {
					const pageUrl = `${siteUrl.replace( /\/$/, '' )}${row.page_url}`;
					return (
						<a
							href={ pageUrl }
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 truncate max-w-xs text-text-black hover:text-blue transition-colors"
							title={ row.page_url }
						>
							{ row.page_url }
							<Icon name="external-link" size={ 11 } color="gray" className="shrink-0" />
						</a>
					);
				}
			},
			{
				key: 'hits',
				label: __( 'Hits', 'burst-statistics' ),
				align: 'right',
				minWidth: 100,
				cell: ( row ) => (
					<NotFoundHitsCell
						pageUrl={ row.page_url }
						hits={ row.hits }
					/>
				)
			}
		],
		[ siteUrl ]
	);

	const { topData, hasData, handleExpand } = useExpandableTopBlock({
		data,
		variant: 'not_found_pages',
		dataTableId: 'not-found-pages'
	});

	return (
		<Block className={className}>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={isLoading}
				title={
					<ExpandableBlockTitle
						metricKey="not_found_pages"
						label={__( '404 Pages', 'burst-statistics' )}
						hasData={hasData}
						onExpand={handleExpand}
					/>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={topData}
					rowKey={( row ) => row.page_url}
					barColumnKey="hits"
					isLoading={isLoading}
					emptyState={__( 'No 404 pages recorded yet.', 'burst-statistics' )}
				/>
			</BlockContent>
		</Block>
	);
});

NotFoundPagesBlock.displayName = 'NotFoundPagesBlock';

export default NotFoundPagesBlock;
