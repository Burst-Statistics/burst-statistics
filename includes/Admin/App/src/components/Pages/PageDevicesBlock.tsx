import DevicesBlock from '@/components/Statistics/DevicesBlock';
import { useFilters } from '@/hooks/useFilters';
import type { FilterSearchParams } from '@/config/filterConfig';

interface PageDevicesBlockProps {
	pageUrl: string;
}

/**
 * Displays device breakdown filtered to the selected page.
 *
 * Reuses the Statistics DevicesBlock with a page_url filter applied.
 *
 * @param props - Component properties.
 * @param props.pageUrl - Selected page path used by the statistics filter.
 * @return The page-specific devices block.
 */
export const PageDevicesBlock = ({
	pageUrl
}: PageDevicesBlockProps ): JSX.Element => {
	const { getActiveFilters } = useFilters();
	const pageFilters: FilterSearchParams = {
		...getActiveFilters(),
		page_url: pageUrl
	};

	return (
		<DevicesBlock
			customFilters={pageFilters}
		/>
	);
};
