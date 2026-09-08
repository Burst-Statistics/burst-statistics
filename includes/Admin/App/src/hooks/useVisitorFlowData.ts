import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getVisitorFlowData, VisitorFlowData } from '@/api/getVisitorFlowData';

interface UseVisitorFlowOptions {
	id?: string;
	pageUrl?: string;
}

export function useVisitorFlowData( options: UseVisitorFlowOptions = {}) {
	const { id, pageUrl } = options;

	const startDate = useDate( ( state ) => state.startDate );
	const endDate = useDate( ( state ) => state.endDate );
	const range = useDate( ( state ) => state.range );
	const { getActiveFilters } = useFilters();

	const activeFilters = getActiveFilters();
	const filtersKey = JSON.stringify( activeFilters );

	return useQuery<VisitorFlowData>({
		queryKey: [ 'visitor-flow', id, pageUrl, startDate, endDate, range, filtersKey ],
		queryFn: () =>
			getVisitorFlowData({
				id,
				pageUrl,
				startDate,
				endDate,
				range,
				filters: activeFilters
			}),
		enabled: Boolean( id || pageUrl )
	});
}
