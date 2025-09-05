import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {getGoals, setGoals, addGoal, deleteGoal, addPredefinedGoal} from '@/utils/api';
import {toast} from 'react-toastify';
import {__} from '@wordpress/i18n';
import {produce} from 'immer';
import useLicenseStore from '@/store/useLicenseStore';

/**
 * Custom hook for managing goals data using TanStack Query.
 * This replaces the Zustand store (useGoalsStore) with a more efficient
 * React Query implementation for better caching and data management.
 *
 * @returns {Object} - An object containing goals data and CRUD operations
 */
const useGoalsData = () => {
    const queryClient = useQueryClient();

    // Main query to fetch goals, predefined goals, and goal fields
    const goalsQuery = useQuery({
        queryKey: ['goals_data'],
        queryFn: async () => {

            const response = await getGoals();
            return {
                goals: response.goals || [],
                predefinedGoals: response.predefinedGoals || [],
                goalFields: Object.values(response.goalFields || {})
            };
        },
        retry: 1
    });

    // Get a single goal by ID
    const getGoal = (id) => {
        const goals = goalsQuery.data?.goals || [];
        if (!Array.isArray(goals)) {
            return false;
        }

        // Not using strict comparison to allow comparing strings and integers
        const index = goals.findIndex(goal => goal.id == id);
        if (-1 !== index) {
            return goals[index];
        }
        return false;
    };

  /**
   * In some cases we need to ensure the returned data contains goals, if we can't wait for data to be loaded. 
   * @param id
   * @returns {Promise<*|null>}
   */
    const getGoalAsync = async (id) => {
        const data = await queryClient.ensureQueryData({
            queryKey: ['goals_data'],
            queryFn: getGoals,
        });

        const goal = data?.goals?.find((g) => String(g.id) === String(id));
        return goal || null;
    };

    // Update a goal value in the cache
    const setGoalValue = (id, type, value) => {
        queryClient.setQueryData(['goals_data'], (oldData) => {
            if (!oldData) {
                return oldData;
            }

            return produce(oldData, draft => {
                const index = draft.goals.findIndex(goal => goal.id === id);
                if (-1 !== index) {
                    draft.goals[index][type] = value;
                }
            });
        });
    };

    // Update an entire goal in the cache
    const updateGoal = (id, data) => {
        queryClient.setQueryData(['goals_data'], (oldData) => {
            if (!oldData) {
                return oldData;
            }

            return produce(oldData, draft => {
                const index = draft.goals.findIndex(goal => goal.id === id);
                if (-1 !== index) {
                    draft.goals[index] = {...draft.goals[index], ...data};
                }
            });
        });
    };

    // Mutation to save all goals
    const saveGoalsMutation = useMutation({
        mutationFn: async () => {
            const goals = queryClient.getQueryData(['goals_data'])?.goals || [];
            return await setGoals({goals});
        },
        onSuccess: () => {

            // Optionally refresh data after saving
            // queryClient.invalidateQueries(['goals_data']);
        },
        onError: (error) => {
            console.error(error);
            toast.error(__('Failed to save goals', 'burst-statistics'));
        }
    });

    // Mutation to save a single goal's title
    const saveGoalTitleMutation = useMutation({
        mutationFn: async ({id, value}) => {
            const goals = [{id, title: value}];
            return await setGoals({goals});
        },
        onError: (error) => {
            console.error(error);
            toast.error(__('Failed to save goal title', 'burst-statistics'));
        }
    });

    // Mutation to add a new goal
    const addGoalMutation = useMutation({
        mutationFn: async () => {
            return await addGoal();
        },
        onSuccess: (response) => {
            queryClient.setQueryData(['goals_data'], (oldData) => {
                if (!oldData) {
                    return oldData;
                }

                return produce(oldData, draft => {
                    draft.goals.push(response.goal);
                });
            });

            toast.success(__('Goal added successfully!', 'burst-statistics'));
        },
        onError: (error) => {
            console.error(error);
            toast.error(__('Failed to add goal', 'burst-statistics'));
        }
    });

    // Mutation to delete a goal
    const deleteGoalMutation = useMutation({
        mutationFn: async (id) => {
            return await deleteGoal(id);
        },
        onSuccess: (response, id) => {
            if (response.deleted) {
                queryClient.setQueryData(['goals_data'], (oldData) => {
                    if (!oldData) {
                        return oldData;
                    }

                    return produce(oldData, draft => {
                        if (1 === draft.goals.length) {

                            // If there's only one goal left, clear the array
                            draft.goals = [];
                        } else {

                            // Otherwise, remove the specific goal
                            const index = draft.goals.findIndex(goal => goal.id === id);
                            if (-1 !== index) {
                                draft.goals.splice(index, 1);
                            }
                        }
                    });
                });

                toast.success(__('Goal deleted successfully!', 'burst-statistics'));
            }
        },
        onError: (error) => {
            console.error(error);
            toast.error(__('Failed to delete goal', 'burst-statistics'));
        }
    });

    // Mutation to add a predefined goal
    const addPredefinedGoalMutation = useMutation({
        mutationFn: async ({predefinedGoalId}) => {
            const {isPro} = useLicenseStore.getState();
            if (!isPro) {
                throw new Error(__('Predefined goals are a premium feature.', 'burst-statistics'));
            }

            return await addPredefinedGoal(predefinedGoalId);
        },
        onSuccess: (response) => {
            queryClient.setQueryData(['goals_data'], (oldData) => {
                if (!oldData) {
                    return oldData;
                }

                return produce(oldData, draft => {
                    draft.goals.push(response.goal);
                });
            });

            toast.success(__('Successfully added predefined goal!', 'burst-statistics'));
        },
        onError: (error) => {
            console.error(error);
            toast.error(error.message || __('Failed to add predefined goal', 'burst-statistics'));
        }
    });

    return {

        // Data
        goals: goalsQuery.data?.goals || [],
        goalFields: goalsQuery.data?.goalFields || [],
        predefinedGoals: goalsQuery.data?.predefinedGoals || [],
        isLoading: goalsQuery.isLoading,
        isError: goalsQuery.isError,

        // CRUD Operations
        getGoal,
        setGoalValue,
        updateGoal,
        getGoalAsync,

        // Mutations
        saveGoals: saveGoalsMutation.mutateAsync,
        saveGoalTitle: (id, value) => saveGoalTitleMutation.mutateAsync({id, value}),
        addGoal: addGoalMutation.mutateAsync,
        deleteGoal: deleteGoalMutation.mutateAsync,
        addPredefinedGoal: (predefinedGoalId) =>
            addPredefinedGoalMutation.mutateAsync({predefinedGoalId}),
        // Utility for invalidating queries
        invalidateGoals: () => queryClient.invalidateQueries(['goals_data'])
    };
};

// Export the condition validation utility function
const validateConditions = (conditions, fields) => {

    // If no conditions, always return true
    if (!conditions || 0 === Object.keys(conditions).length) {
        return true;
    }

    // Check if ANY condition is met (OR logic)
    return Object.entries(conditions).some(([fieldName, allowedValues]) => {

        // Find the field value from the fields array
        const field = fields.find(f => f.id === fieldName);
        if (!field) {
            return false;
        }

        const fieldValue = field.value;

        // If field value is not set, condition is not met
        if (!fieldValue) {
            return false;
        }

        // Check if the field value is in the allowed values array
        return allowedValues.includes(fieldValue);
    });
};

// Export the updateFieldsListWithConditions utility function
export const updateFieldsListWithConditions = (fields) => {
    return fields.map(field => {
        const newField = {...field};

        // If field has conditions, check if they are met
        if (field.react_conditions) {
            const conditionsMet = validateConditions(field.react_conditions, fields);

            // Apply the appropriate action based on condition_action
            if ('disable' === field.condition_action) {
                newField.disabled = !conditionsMet;
            } else {
                newField.conditionallyDisabled = !conditionsMet;
            }
        }

        return newField;
    });
};

export default useGoalsData;
