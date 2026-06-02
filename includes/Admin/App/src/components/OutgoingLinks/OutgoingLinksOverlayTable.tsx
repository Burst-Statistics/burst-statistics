import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useOutgoingLinksData } from './useOutgoingLinksData';
import { getOutgoingLinksColumns } from './columns';

/**
 * Full-table view of outgoing links for use inside DataTableOverlay.
 *
 * Intentionally reuses the same useOutgoingLinksData hook so TanStack Query
 * serves the data from cache — no extra network request is made.
 */
const OutgoingLinksOverlayTable = memo( () => {
	const { data, isLoading } = useOutgoingLinksData();
	const columns = useMemo( () => getOutgoingLinksColumns(), []);

	return (
		<BarDataTable
			columns={ columns }
			data={ data }
			rowKey={ ( row ) => row.url }
			barColumnKey="clicks"
			isLoading={ isLoading }
			emptyState={ __( 'No outgoing link clicks recorded yet.', 'burst-statistics' ) }
		/>
	);
});

OutgoingLinksOverlayTable.displayName = 'OutgoingLinksOverlayTable';

export default OutgoingLinksOverlayTable;
