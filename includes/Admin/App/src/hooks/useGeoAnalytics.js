import { useQuery } from '@tanstack/react-query';
import getGeoData from '@/api/getGeoData';
import { useGeoStore } from '@/store/useGeoStore';
import {useBlockConfig} from '@/hooks/useBlockConfig';

export const useGeoAnalytics = ( props ) => {
	const { startDate, endDate, range, filters } = useBlockConfig( props );

	const metrics = useGeoStore( ( state ) => state.selectedMetric );
	const currentView = useGeoStore( ( state ) => state.currentView );

	// Create args object with all necessary parameters
	const args = {
		filters,
		metrics,
		currentView: {
			level: currentView.level,
			id: currentView.id
		}
	};

	return useQuery({
		queryKey: [
			'geo_analytics',
			startDate,
			endDate,
			currentView.level,
			currentView.id,
			metrics,
			filters
		],
		queryFn: () => getGeoData({ startDate, endDate, range, args }),

		// Keep data fresh for 5 minutes
		staleTime: 5 * 60 * 1000,

		// Structure placeholder data similar to expected response
		placeholderData: []
	});
};
