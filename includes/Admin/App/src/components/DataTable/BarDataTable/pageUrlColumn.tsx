import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { truncateMiddle } from '@/utils/formatting';
import { safeDecodeURI } from '@/utils/lib';
import type { BarColumn } from './types';

/** Any BarDataTable row keyed on a page URL path. */
type PageUrlRow = {
	page_url: string;
};

/**
 * The page column shared by the BarDataTable blocks: a truncated, decoded path
 * that links to the page itself.
 *
 * @param {Object} options         - Options object.
 * @param {string} options.siteUrl - The WordPress site URL, used to build the page links.
 * @return {BarColumn<T>} The page column definition.
 */
export function getPageUrlColumn<T extends PageUrlRow>({
	siteUrl
}: {
	siteUrl: string;
}): BarColumn<T> {
	return {
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
	};
}
