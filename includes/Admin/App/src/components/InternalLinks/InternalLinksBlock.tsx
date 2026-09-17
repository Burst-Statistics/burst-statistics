import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import MetricInfo from '@/components/Common/MetricInfo';
import { formatNumber, truncateMiddle } from '@/utils/formatting';
import { isTourActive } from '@/store/useTourStore';
import type { BarColumn } from '@/components/DataTable/BarDataTable';

type InternalLinksBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

type InternalLinkRow = {
	url: string;
	clicks: number;
};

const TOP_N = 5;

const TOUR_INTERNAL_LINKS_DATA: InternalLinkRow[] = [
	{ url: '/pricing', clicks: 940 },
	{ url: '/features', clicks: 710 },
	{ url: '/blog/getting-started-with-analytics', clicks: 520 },
	{ url: '/documentation', clicks: 380 },
	{ url: '/contact', clicks: 195 }
];

/**
 * Compact dashboard block showing internal links navigation.
 *
 * In tour mode, renders an illustrative BarDataTable of top clicked internal URLs.
 * In live mode (until internal link tracking is fully enabled), displays the "Coming soon" state.
 *
 * @param {InternalLinksBlockProps} props - Component props.
 * @return {JSX.Element} The rendered internal links block.
 */
const InternalLinksBlock = memo( ({ className = '' }: InternalLinksBlockProps ) => {
	const tourActive = isTourActive();

	const siteUrl =
		( window as unknown as { burst_settings?: { site_url?: string } })
			?.burst_settings?.site_url ?? window.location.origin;

	const columns = useMemo<BarColumn<InternalLinkRow>[]>(
		() => [
			{
				key: 'url',
				label: __( 'Internal link', 'burst-statistics' ),
				align: 'left',
				minWidth: 160,
				cell: ( row ) => {
					const pageUrl = `${ siteUrl.replace( /\/$/, '' ) }${ row.url }`;
					return (
						<a
							href={ pageUrl }
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 text-text-black hover:text-blue-600 transition-colors font-medium min-w-0"
							title={ row.url }
						>
							<span className="truncate">{ truncateMiddle( row.url, 30 ) }</span>
							<Icon name="external-link" size={ 11 } color="gray" className="shrink-0" />
						</a>
					);
				}
			},
			{
				key: 'clicks',
				label: __( 'Clicks', 'burst-statistics' ),
				align: 'right',
				minWidth: 80,
				cell: ( row ) => (
					<span className="font-medium text-text-black">
						{ formatNumber( row.clicks ) }
					</span>
				)
			}
		],
		[ siteUrl ]
	);

	if ( ! tourActive ) {
		return (
			<Block className={ className } data-tour="internal-links-block">
				<BlockHeading
					className="border-b border-gray-200"
					title={
						<MetricInfo metricKey="internal_links" side="bottom">
							{ __( 'Internal links', 'burst-statistics' ) }
						</MetricInfo>
					}
				/>
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{ __( 'Coming soon', 'burst-statistics' ) }
				</BlockContent>
			</Block>
		);
	}

	return (
		<Block className={ className } data-tour="internal-links-block">
			<BlockHeading
				className="border-b border-gray-200"
				title={
					<MetricInfo metricKey="internal_links" side="bottom">
						{ __( 'Internal links', 'burst-statistics' ) }
					</MetricInfo>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={ columns }
					data={ TOUR_INTERNAL_LINKS_DATA.slice( 0, TOP_N ) }
					rowKey={ ( row ) => row.url }
					barColumnKey="clicks"
					isLoading={ false }
					emptyState={ __( 'No internal link clicks recorded yet.', 'burst-statistics' ) }
				/>
			</BlockContent>
		</Block>
	);
});

InternalLinksBlock.displayName = 'InternalLinksBlock';

export default InternalLinksBlock;
