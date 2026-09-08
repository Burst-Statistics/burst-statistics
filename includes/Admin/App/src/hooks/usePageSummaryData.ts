import { useQuery } from '@tanstack/react-query';
import { getPageSummaryData, PageSummaryData } from '@/api/getPageSummaryData';

interface UsePageSummaryOptions {
	id?: string;
	pageUrl?: string;
}

export function usePageSummaryData( options: UsePageSummaryOptions = {}) {
	const { id, pageUrl } = options;

	return useQuery<PageSummaryData>({
		queryKey: [ 'page-summary', id, pageUrl ],
		queryFn: () => getPageSummaryData({ id, pageUrl }),
		enabled: Boolean( id || pageUrl )
	});
}
