import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getNotFoundPageReferrers from '@/api/getNotFoundPageReferrers';
import type { NotFoundPageReferrersResponse } from '@/api/getNotFoundPageReferrers';

type UseNotFoundPageReferrersArgs = {
	pageUrl: string;
	enabled?: boolean;
};

type UseNotFoundPageReferrersReturn = {
	data: NotFoundPageReferrersResponse;
	isLoading: boolean;
	error: Error | null;
};

const DEFAULT_RESPONSE: NotFoundPageReferrersResponse = {
	total_hits: 0,
	no_referrer_hits: 0,
	counts: {
		all: 0,
		internal: 0,
		external: 0
	},
	referrers: []
};

const isQueryReady = ( url: string, start: string, end: string, enabled: boolean ): boolean => {
	return Boolean( enabled && url && start && end );
};

export function useNotFoundPageReferrers({
	pageUrl,
	enabled = true
}: UseNotFoundPageReferrersArgs ): UseNotFoundPageReferrersReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'not_found_page_referrers', pageUrl, startDate, endDate, filters ],
		queryFn: () =>
			getNotFoundPageReferrers({
				pageUrl,
				startDate,
				endDate,
				range,
				filters
			}),
		enabled: isQueryReady( pageUrl, startDate, endDate, enabled )
	});

	return {
		data: query.data || DEFAULT_RESPONSE,
		isLoading: query.isLoading || query.isFetching,
		error: ( query.error as Error | null ) ?? null
	};
}
