import { useQueryClient } from '@tanstack/react-query';
import { doAction } from '@/utils/api';
import useGoalsData from '@/hooks/useGoalsData';
import { useCallback } from 'react';

export const useFiltersData = () => {
	const queryClient = useQueryClient();
	const { goals, getGoalAsync } = useGoalsData();

	const fetchFilterData = async( type, search ) => {
		const response = await doAction( 'get_filter_options', {
			data_type: type,
			search
		});
		return response.data?.[type] || [];
	};

	const getFilterOptions = useCallback(
		async( type, search ) => {
			if ( 'goals' === type ) {
				return goals;
			}

			const data = await queryClient.fetchQuery({
				queryKey: [ 'filters_data', type, search ],
				queryFn: () => fetchFilterData( type, search ),
				staleTime: 5 * 60 * 1000,
				cacheTime: 30 * 60 * 1000
			});
			const items = Array.isArray( data ) ?
				data :
				Object.values( data || {});
			return items.map( ( opt ) => ({
				id: opt.ID,
				title: opt.name,
				key: opt.key || opt.ID
			}) );
		},
		[ queryClient, goals ]
	);

	const getFilterOptionById = async( id, type ) => {
		if ( 'goals' === type ) {
			const goal = await getGoalAsync( id );
			return goal ? goal.title : id;
		}
		const options = await getFilterOptions( type );
		const option = Array.isArray( options ) ?
			options.find( ( opt ) => String( opt.id ) === String( id ) ) :
			null;
		return option?.title || id;
	};

	const getFilterIdByTitle = async( title, type ) => {
		const options = await getFilterOptions( type );
		const option = Array.isArray( options ) ?
			options.find( ( opt ) => opt.title === title ) :
			null;
		return option?.id || null;
	};

	return {
		getFilterOptions,
		getFilterOptionById,
		getFilterIdByTitle
	};
};
export default useFiltersData;
