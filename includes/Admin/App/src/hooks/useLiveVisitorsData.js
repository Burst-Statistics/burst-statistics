import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import getLiveVisitors from '../api/getLiveVisitors';

/**
 * Custom hook to fetch live visitors data with automatic refetching.
 *
 * @return {Object} The query object containing live visitors data and status.
 */
export const useLiveVisitorsData = () => {
	const intervalRef = useRef( 5000 );
	const queryClient = useQueryClient();

	useEffect(
		() => {
			const handleBeforeUnload = () => {
				queryClient.cancelQueries( { queryKey: ['live-visitors'] } );
				intervalRef.current = 0;
			};

			window.addEventListener( 'beforeunload', handleBeforeUnload );
			return () => window.removeEventListener( 'beforeunload', handleBeforeUnload );
		},
		[ queryClient ]
	);

	return useQuery(
		{
			queryKey: [ 'live-visitors' ],
			queryFn: getLiveVisitors,
			refetchInterval: intervalRef.current,
			placeholderData: '-',
			refetchIntervalInBackground: false,
			onError: () => {
				intervalRef.current = 0; // Stop refreshing if error.
			},
			gcTime: 10000,
		}
	);
}