import { createFileRoute } from '@tanstack/react-router';
import { DataTableOverlay } from '@/components/DataTable/DataTableOverlay';
import NotFoundModal from '@/components/Common/NotFoundModal';
import { validateFilterSearch } from '@/config/filterConfig';

export const Route = createFileRoute( '/table/$variant' )({

	/**
	 * Validate and parse search params for the datatable overlay route.
	 * Combines filter params (via validateFilterSearch) with overlay-specific params.
	 *
	 * @param {Record<string, unknown>} search - Raw URL search params.
	 * @return {object} Validated search params.
	 */
	validateSearch: ( search ) => {
		const filterParams = validateFilterSearch( search );

		return {
			...filterParams,
			from: 'string' === typeof search.from ? search.from : '/',
			allowed: 'string' === typeof search.allowed ? search.allowed : 'pages',
			dataTableId: 'string' === typeof search.dataTableId ? search.dataTableId : 'datatable',
			startDate: 'string' === typeof search.startDate ? search.startDate : undefined,
			endDate: 'string' === typeof search.endDate ? search.endDate : undefined,
			range: 'string' === typeof search.range ? search.range : undefined
		};
	},
	notFoundComponent: NotFoundModal,
	component: DataTableOverlay
});
