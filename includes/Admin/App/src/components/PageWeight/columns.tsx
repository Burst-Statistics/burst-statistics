import { __ } from '@wordpress/i18n';
import { formatFileSize, formatNumber } from '@/utils/formatting';
import { getPageUrlColumn } from '@/components/DataTable/BarDataTable';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { PageWeightRow } from './usePageWeightData';

/**
 * Returns the column definitions for the heaviest-pages table.
 *
 * @param {Object} options         - Options object.
 * @param {string} options.siteUrl - The WordPress site URL, used to build the page links.
 * @return {BarColumn<PageWeightRow>[]} The column definitions.
 */
export function getPageWeightColumns({
	siteUrl
}: {
	siteUrl: string;
}): BarColumn<PageWeightRow>[] {
	return [
		getPageUrlColumn<PageWeightRow>({ siteUrl }),
		{
			key: 'page_weight',
			label: __( 'Weight', 'burst-statistics' ),
			align: 'right',
			minWidth: 90,
			cell: ( row ) => (
				<span className="font-semibold text-text-black">
					{ formatFileSize( row.page_weight ) }
				</span>
			)
		},
		{
			key: 'pageviews',
			label: __( 'Views', 'burst-statistics' ),
			align: 'right',
			minWidth: 80,
			cell: ( row ) => (
				<span className="text-text-gray">
					{ formatNumber( row.pageviews ) }
				</span>
			)
		}
	];
}
