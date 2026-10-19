import { __ } from '@wordpress/i18n';
import { formatTime } from '@/utils/formatting';
import { getPageUrlColumn } from '@/components/DataTable/BarDataTable';
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
		getPageUrlColumn<ReadingEngagementRow>({ siteUrl }),
		{
			key: 'reading_engagement_score',
			label: __( 'Score', 'burst-statistics' ),
			align: 'right',
			minWidth: 100,
			cell: ( row ) => (
				<span
					className="font-semibold text-text-black"
					title={ `${ __( 'Avg. time on page', 'burst-statistics' ) }: ${ formatTime( row.avg_time_on_page ) }${ row.word_count ? ` (${ row.word_count } ${ __( 'words', 'burst-statistics' ) })` : '' }` }
				>
					{ row.reading_engagement_score }
					<span className="text-xs font-normal text-text-gray ml-0.5">/ 100</span>
				</span>
			)
		}
	];
}
