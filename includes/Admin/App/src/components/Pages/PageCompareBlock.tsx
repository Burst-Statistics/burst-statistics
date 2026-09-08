import { __ } from '@wordpress/i18n';
import CompareBlock from '@/components/Statistics/CompareBlock';
import { useFilters } from '@/hooks/useFilters';
import type { FilterSearchParams } from '@/config/filterConfig';

interface PageCompareBlockProps {
	pageUrl: string;
}

/**
 * Displays live comparison metrics filtered to the selected page.
 *
 * @param props - Component properties.
 * @param props.pageUrl - Selected page path used by the statistics filter.
 * @return The page-specific comparison block.
 */
export const PageCompareBlock = ({
	pageUrl
}: PageCompareBlockProps ): JSX.Element => {
	const { getActiveFilters } = useFilters();
	const pageFilters: FilterSearchParams = {
		...getActiveFilters(),
		page_url: pageUrl
	};

	return (
		<CompareBlock
			customFilters={pageFilters}
			title={__( 'Page performance', 'burst-statistics' )}
			showCommunityComparison={false}
			includePageMetrics={true}
			enabled={Boolean( pageUrl )}
		/>
	);
};
