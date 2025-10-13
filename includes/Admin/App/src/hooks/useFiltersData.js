import { useQuery, useQueryClient } from '@tanstack/react-query';
import {doAction, getGoals} from '@/utils/api';
import useGoalsData from '@/hooks/useGoalsData';
import {useCallback} from "react";

export const useFiltersData = () => {
    const queryClient = useQueryClient();
    const { goals, getGoalAsync } = useGoalsData();

    const fetchFilterData = async (type) => {
        const response = await doAction('get_filter_options', { data_type: type });
        return response.data?.[type] || [];
    };

    const goalsQuery = useQuery({
        queryKey: ['filters_data', 'goals'],
        queryFn: () => fetchFilterData('goals'),
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
    });

    const getFilterOptions = useCallback(async (type) => {
        if (type === 'goals') return goals;

        const data = await queryClient.fetchQuery({
            queryKey: ['filters_data', type],
            queryFn: () => fetchFilterData(type),
            staleTime: 5 * 60 * 1000,
            cacheTime: 30 * 60 * 1000,
        });
        return (data || []).map((opt) => ({
            id: opt.ID,
            title: opt.name,
            key: opt.key || opt.ID,
        }));
    }, [queryClient, goals]);

    const getFilterOptionById = async (id, type) => {
        if (type === 'goals') {
            const goal = await getGoalAsync(id);
            return goal ? goal.title : id;
        }
        const options = await getFilterOptions(type);
        const option = Array.isArray(options)
            ? options.find((opt) => String(opt.id) === String(id))
            : null;
        return option?.title || id;
    };

    const getFilterIdByTitle = async (title, type) => {
        const options = await getFilterOptions(type);
        const option = Array.isArray(options)
            ? options.find((opt) => opt.title === title)
            : null;
        return option?.id || null;
    };

    return {
        isLoading: goalsQuery.isLoading,
        isError: goalsQuery.isError,
        getFilterOptions,
        getFilterOptionById,
        getFilterIdByTitle,
    };
};
export default useFiltersData;