import { createFileRoute } from '@tanstack/react-router';
import { PageOverlay } from '@/components/Pages/PageOverlay';
import NotFoundModal from '@/components/Common/NotFoundModal';
import { validateFilterSearch } from '@/config/filterConfig';

export const Route = createFileRoute( '/page/$id' )({

	/**
	 * Validate and parse search params for the page overlay route.
	 * Combines filter params (via validateFilterSearch) with overlay-specific params.
	 *
	 * @param {Record<string, unknown>} search - Raw URL search params.
	 * @return {object} Validated search params.
	 */
	// fallow-ignore-next-line complexity
	validateSearch: ( search ) => {
		const filterParams = validateFilterSearch( search );

		return {
			...filterParams,
			from: 'string' === typeof search.from ? search.from : '/',
			pageUrl: 'string' === typeof search.pageUrl ? search.pageUrl : '',
			startDate: 'string' === typeof search.startDate ? search.startDate : undefined,
			endDate: 'string' === typeof search.endDate ? search.endDate : undefined,
			range: 'string' === typeof search.range ? search.range : undefined
		};
	},
	notFoundComponent: NotFoundModal,
	component: PageOverlay
});
