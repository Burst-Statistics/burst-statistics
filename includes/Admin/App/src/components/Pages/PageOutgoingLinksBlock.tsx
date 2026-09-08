import { OutgoingLinksBlock } from '@/components/OutgoingLinks';
import { useFilters } from '@/hooks/useFilters';
import type { FilterSearchParams } from '@/config/filterConfig';

interface PageOutgoingLinksBlockProps {
	pageUrl: string;
}

/**
 * Displays outgoing link clicks filtered to the selected page.
 *
 * Reuses OutgoingLinksBlock with a page_url filter applied.
 *
 * @param props - Component properties.
 * @param props.pageUrl - Selected page path used by the statistics filter.
 * @return The page-specific outgoing links block.
 */
export const PageOutgoingLinksBlock = ({
	pageUrl
}: PageOutgoingLinksBlockProps ): JSX.Element => {
	const { getActiveFilters } = useFilters();
	const pageFilters: FilterSearchParams = {
		...getActiveFilters(),
		page_url: pageUrl
	};

	return (
		<OutgoingLinksBlock
			className="row-span-1 @lg:col-span-6 @xl:col-span-3"
			customFilters={pageFilters}
		/>
	);
};
