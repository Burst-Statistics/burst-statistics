import { Block } from '@/components/Blocks/Block';
import useSiteUrl from '@/hooks/useSiteUrl';
import { usePageSummaryData } from '@/hooks/usePageSummaryData';
import { PageSummaryData } from '@/api/getPageSummaryData';
import { PageSummaryHeader } from './PageSummaryHeader';
import { PageSummaryPreview } from './PageSummaryPreview';

interface PageSummaryBlockProps {
	pageId: string;
	pageUrl: string;
}

/**
 * Builds an absolute URL for a page path on the current WordPress site.
 *
 * @param siteUrl - WordPress site URL.
 * @param pageUrl - Absolute URL or site-relative page path.
 * @return Absolute page URL.
 */
const getAbsolutePageUrl = ( siteUrl: string, pageUrl: string ): string => {
	if ( /^https?:\/\//i.test( pageUrl ) ) {
		try {
			const requestedUrl = new URL( pageUrl );
			const currentSiteUrl = new URL( siteUrl );

			if ( requestedUrl.origin === currentSiteUrl.origin ) {
				return requestedUrl.toString();
			}

			pageUrl = `${ requestedUrl.pathname }${ requestedUrl.search }`;
		} catch {
			return '';
		}
	}

	const normalizedSiteUrl = siteUrl.replace( /\/$/, '' );
	const normalizedPageUrl = pageUrl.startsWith( '/' ) ?
		pageUrl :
		`/${ pageUrl }`;

	return `${ normalizedSiteUrl }${ normalizedPageUrl }`;
};

/**
 * Returns a concise path for display when the route contains an absolute URL.
 *
 * @param pageUrl - Absolute URL or site-relative page path.
 * @return Display path.
 */
const getPagePath = ( pageUrl: string ): string => {
	if ( ! /^https?:\/\//i.test( pageUrl ) ) {
		return pageUrl;
	}

	try {
		const url = new URL( pageUrl );
		return `${ url.pathname }${ url.search }`;
	} catch {
		return pageUrl;
	}
};

/**
 * Builds the WordPress editor URL for a numeric post ID.
 *
 * @param pageId - Selected page ID.
 * @return WordPress editor URL, or an empty string for URL-derived IDs.
 */
const getEditUrl = ( pageId: string ): string => {
	if ( ! /^\d+$/.test( pageId ) ) {
		return '';
	}

	const adminPathMatch = window.location.pathname.match( /^(.*\/wp-admin)(?:\/|$)/ );
	const adminPath = adminPathMatch?.[1] ?? '/wp-admin';

	return `${ window.location.origin }${ adminPath }/post.php?post=${ encodeURIComponent( pageId ) }&action=edit`;
};

/**
 * Displays a page overview with a live preview and general page details.
 *
 * @param props - Component properties.
 * @param props.pageId - Selected WordPress page ID.
 * @param props.pageUrl - Selected page path from route search.
 * @return The page-summary block.
 */
export const PageSummaryBlock = ({
	pageId,
	pageUrl
}: PageSummaryBlockProps ): JSX.Element => {
	const siteUrl = useSiteUrl();
	const { data: summaryData } = usePageSummaryData({ id: pageId, pageUrl });

	const fallbackData: PageSummaryData = {
		title: pageUrl || 'Page Overview',
		fallbackPath: pageUrl || '/',
		postType: 'Page',
		status: 'Published',
		author: 'Unknown',
		publishedAt: new Date().toISOString(),
		editedAt: new Date().toISOString(),
		wordCount: 0,
		readingMinutes: 1
	};

	const displayData = summaryData || fallbackData;
	const selectedPageUrl = pageUrl || summaryData?.fallbackPath || '/';
	const absolutePageUrl = getAbsolutePageUrl( siteUrl, selectedPageUrl );
	const previewUrl = pageUrl ? getAbsolutePageUrl( siteUrl, pageUrl ) : '';
	const pagePath = getPagePath( selectedPageUrl );

	return (
		<Block className="col-span-12">
			<div className="flex flex-col gap-6 p-6 @lg:flex-row @lg:items-center">
				<PageSummaryPreview pageUrl={previewUrl} />
				<PageSummaryHeader
					data={displayData}
					pagePath={pagePath}
					pageHref={absolutePageUrl}
					editUrl={getEditUrl( pageId )}
				/>
			</div>
		</Block>
	);
};
