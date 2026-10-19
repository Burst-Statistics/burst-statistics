import { useMemo } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { FilterSearchParams } from '@/config/filterConfig';

type UseExpandableTopBlockOptions<Row> = {
	data: Row[];
	variant: string;
	dataTableId?: string;
	searchOverrides?: FilterSearchParams;
	topN?: number;
};

type UseExpandableTopBlockReturn<Row> = {
	topData: Row[];
	hasData: boolean;
	handleExpand: () => void;
};

/**
 * Shared logic for a compact dashboard block that shows the top N rows of a
 * datatable and expands into the full table via the DataTableOverlay.
 *
 * @param {UseExpandableTopBlockOptions<Row>} options - Block data and datatable navigation options.
 * @return {UseExpandableTopBlockReturn<Row>} Top-N rows, whether there's data, and the expand handler.
 */
export function useExpandableTopBlock<Row>({
	data,
	variant,
	dataTableId = variant,
	searchOverrides,
	topN = 5
}: UseExpandableTopBlockOptions<Row> ): UseExpandableTopBlockReturn<Row> {
	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	// The REST response can be a non-array (e.g. an error object), so guard before slicing.
	const topData = useMemo( () => ( Array.isArray( data ) ? data : []).slice( 0, topN ), [ data, topN ]);

	const hasData = 0 < topData.length;

	/**
	 * Navigate to the fullscreen overlay with this block's variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant },
			search: {
				...location.search,
				...( searchOverrides ?? {}),
				from: location.pathname,
				allowed: variant,
				dataTableId
			}
		});
	};

	return { topData, hasData, handleExpand };
}
