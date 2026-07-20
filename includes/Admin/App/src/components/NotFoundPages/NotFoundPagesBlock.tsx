import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useNotFoundPagesData } from './useNotFoundPagesData';
import MetricInfo from '@/components/Common/MetricInfo';
import { formatNumber } from '@/utils/formatting';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { NotFoundPageRow } from './useNotFoundPagesData';

type NotFoundPagesBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/** Maximum rows shown in the compact block view. */
const TOP_N = 5;

/**
	* Compact dashboard block showing the top 404 pages.
	*/
const NotFoundPagesBlock = memo( ({ className = '' }: NotFoundPagesBlockProps ) => {
	const { data, isLoading } = useNotFoundPagesData();

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

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
							className="inline-flex items-center gap-1 truncate max-w-xs text-text-black hover:text-blue-600 transition-colors"
							title={ row.page_url }
						>
							{ row.page_url }
							<Icon name="external-link" size={ 11 } color="gray" />
						</a>
					);
				}
			},
			{
				key: 'hits',
				label: __( 'Hits', 'burst-statistics' ),
				align: 'right',
				minWidth: 80,
				cell: ( row ) => (
					<span className="font-medium text-text-black">
						{ formatNumber( row.hits ) }
					</span>
				)
			}
		],
		[ siteUrl ]
	);

	const filteredData = useMemo( () => {
		return data.slice( 0, TOP_N );
	}, [ data ]);

	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'not_found_pages' },
			search: {
				from: location.pathname,
				allowed: 'not_found_pages',
				dataTableId: 'not-found-pages',
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
					<MetricInfo metricKey="not_found_pages" side="bottom">
						{__( '404 Pages', 'burst-statistics' )}
					</MetricInfo>
					{/* Expand to overlay. */}
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
						onClick={handleExpand}
						aria-label={__( 'Expand table', 'burst-statistics' )}
						title={__( 'Expand table', 'burst-statistics' )}
					>
						<Icon name="expand" size={14} />
					</button></>}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={filteredData}
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
