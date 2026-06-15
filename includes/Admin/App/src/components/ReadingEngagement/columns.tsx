import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatTime, truncateMiddle } from '@/utils/formatting';
import { safeDecodeURI } from '@/utils/lib';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { ReadingEngagementRow } from './useReadingEngagementData';

/**
 * Returns the column definitions for the reading engagement table.
 *
 * @param {Object} options         - Options object.
 * @param {string} options.siteUrl - The WordPress site URL, used to build the page links.
 * @return {BarColumn<ReadingEngagementRow>[]} The column definitions.
 */
export function getReadingEngagementColumns({
	siteUrl
}: {
	siteUrl: string;
}): BarColumn<ReadingEngagementRow>[] {
	return [
		{
			key: 'page_url',
			label: __( 'Page', 'burst-statistics' ),
			align: 'left',
			minWidth: 160,
			cell: ( row ) => {
				const pageUrl = `${siteUrl.replace( /\/$/, '' )}${row.page_url}`;
				const decoded = safeDecodeURI( row.page_url );
				return (
					<a
						href={ pageUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-text-black hover:text-blue-600 transition-colors font-medium"
						title={ row.page_url }
					>
						<span>{ truncateMiddle( decoded, 30 ) }</span>
						<Icon name="external-link" size={ 11 } color="gray" className="shrink-0" />
					</a>
				);
			}
		},
		{
			key: 'avg_time_on_page',
			label: __( 'Avg. time on page', 'burst-statistics' ),
			align: 'right',
			minWidth: 100,
			cell: ( row ) => (
				<span className="font-medium text-text-black">
					{ formatTime( row.avg_time_on_page ) }
				</span>
			)
		}
	];
}
