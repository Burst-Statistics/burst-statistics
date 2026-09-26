import { getData } from '@/utils/api';
import type { FilterSearchParams } from '@/hooks/useFilters';

export type NotFoundPageReferrerItem = {
	referrer: string;
	hits: number;
	is_internal: boolean;
	display_url: string;
	url: string;
	edit_url?: string;
};

export type NotFoundPageReferrersResponse = {
	total_hits: number;
	no_referrer_hits: number;
	counts: {
		all: number;
		internal: number;
		external: number;
	};
	referrers: NotFoundPageReferrerItem[];
};

type GetNotFoundPageReferrersArgs = {
	pageUrl: string;
	startDate: string;
	endDate: string;
	range: string;
	filters?: FilterSearchParams;
};

const getNotFoundPageReferrers = async({
	pageUrl,
	startDate,
	endDate,
	range,
	filters
}: GetNotFoundPageReferrersArgs ): Promise<NotFoundPageReferrersResponse> => {
	const { data } = await getData(
		'not_found_page_referrers',
		startDate,
		endDate,
		range,
		{
			page_url: pageUrl,
			filters
		}
	);

	return ( data ?? {
		total_hits: 0,
		no_referrer_hits: 0,
		counts: {
			all: 0,
			internal: 0,
			external: 0
		},
		referrers: []
	}) as NotFoundPageReferrersResponse;
};

export default getNotFoundPageReferrers;
