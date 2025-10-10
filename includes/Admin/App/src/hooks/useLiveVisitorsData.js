import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import getLiveVisitors from '../api/getLiveVisitors';

/**
 * Custom hook to fetch live visitors data with automatic refetching.
 *
 * @return {Object} The query object containing live visitors data and status.
 */
export const useLiveVisitorsData = () => {
	const intervalRef = useRef( 5000 );

	return useQuery(
		{
			queryKey: [ 'live-visitors' ],
			queryFn: getLiveVisitors,
			refetchInterval: intervalRef.current,
			placeholderData: '-',
			onError: () => {
				intervalRef.current = 0; // stop refreshing if error
			},
			gcTime: 10000,
		}
	);
}