import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	getGoals,
	setGoals,
	addGoal,
	deleteGoal,
	addPredefinedGoal
} from '@/utils/api';
import { toast } from '@/utils/toast';
import { __ } from '@wordpress/i18n';
import { produce } from 'immer';
import useLicenseData from '@/hooks/useLicenseData';
import useShareableLinkStore from '@/store/useShareableLinkStore';

/**
 * Custom hook for managing goals data using TanStack Query.
 * This replaces the Zustand store (useGoalsStore) with a more efficient
 * React Query implementation for better caching and data management.
 *
 * @return An object containing goals data and CRUD operations.
 */
// fallow-ignore-next-line complexity
const useGoalsData = () => {
	const queryClient = useQueryClient();
	const { isPro } = useLicenseData();
	const { isShareableLinkViewer, userCanFilter } = useShareableLinkStore();

	// Shared viewers without filter permission should not fetch goals.
	const shouldFetchGoals = ! isShareableLinkViewer || userCanFilter;
	const goalsQuery = useQuery({
		queryKey: [ 'goals_data' ],

		// fallow-ignore-next-line complexity
		queryFn: async() => {
			const response = await getGoals();
			return {
				goals: response.goals || [],
				predefinedGoals: response.predefinedGoals || [],
				activeGoalsCount: response.active_goals_count || 0,
				goalLimit: response.goal_limit ?? window.burst_settings?.goal_limit ?? 3
			};
		},
		enabled: shouldFetchGoals,
		retry: 1
	});

	/**
	 * Refetch the goals list and the goal statistics that depend on a goal's settings.
	 * Filter objects, not arrays: in TanStack Query v5 an array is read as a filter
	 * without a queryKey and invalidates every query in the app.
	 *
	 * @return {Promise<void[]>} Resolves when the invalidated queries have refetched.
	 */
	const invalidateGoals = () => Promise.all([
		queryClient.invalidateQueries({ queryKey: [ 'goals_data' ] }),
		queryClient.invalidateQueries({ queryKey: [ 'goals' ] }),
		queryClient.invalidateQueries({ queryKey: [ 'live-goals' ] })
	]);

	// Get a single goal by ID
	const getGoal = ( id ) => {
		const goals = goalsQuery.data?.goals || [];
		if ( ! Array.isArray( goals ) ) {
			return false;
		}

		// Not using strict comparison to allow comparing strings and integers
		const index = goals.findIndex( ( goal ) => goal.id == id );
		if ( -1 !== index ) {
			return goals[index];
		}
		return false;
	};

	/**
	 * In some cases we need to ensure the returned data contains goals, if we can't wait for data to be loaded.
	 * @param  id
	 * @return {Promise<*|null>}
	 */
	const getGoalAsync = async( id ) => {
		const data = await queryClient.ensureQueryData({
			queryKey: [ 'goals_data' ],
			queryFn: getGoals
		});

		const goal = data?.goals?.find( ( g ) => String( g.id ) === String( id ) );
		return goal || null;
	};

	// fallow-ignore-next-line code-duplication -- setQueryData+produce is an intentional immer pattern; the two usages update different shapes (field vs. status) and merging would add unnecessary indirection.
	const updateGoalInCache = ( id, updater ) => {
		queryClient.setQueryData([ 'goals_data' ], ( oldData ) => {
			if ( ! oldData ) {
				return oldData;
			}

			return produce( oldData, ( draft ) => {
				const index = draft.goals.findIndex( ( goal ) => goal.id === id );
				if ( -1 !== index ) {
					updater( draft.goals[index]);
				}
			});
		});
	};

	// Update a goal field value in the local cache only (for settings fields, persisted via saveGoalSettings)
	const setGoalValue = ( id, type, value ) => {
		updateGoalInCache( id, ( goal ) => {
			goal[type] = value;
		});
	};

	// Update an entire goal in the cache
	const updateGoal = ( id, data ) => {
		updateGoalInCache( id, ( goal ) => {
			Object.assign( goal, data );
		});
	};

	// Mutation to persist one goal's cached values (each goal wizard step saves the goal it edits)
	const saveGoalMutation = useMutation({

		/** @param {number} id Goal id. */
		mutationFn: async( id ) => {

			// Read the cache directly: a value set in the same tick is not in this render's goalsQuery.data yet.
			const goals = queryClient.getQueryData([ 'goals_data' ])?.goals || [];
			return await setGoals({ goals: goals.filter( ( goal ) => goal.id === id ) });
		},
		onSuccess: () => {
			invalidateGoals();
		},
		onError: ( error ) => {
			console.error( error );
			toast.error( __( 'Failed to save goal', 'burst-statistics' ) );
		}
	});

	// Mutation to save a single goal's title
	const saveGoalTitleMutation = useMutation({
		mutationFn: async({ id, value }) => {
			const goals = [ { id, title: value } ];
			return await setGoals({ goals });
		},
		onError: ( error ) => {
			console.error( error );
			toast.error( __( 'Failed to save goal title', 'burst-statistics' ) );
		}
	});

	// Mutation to toggle a goal's active status — immediately persists to server (same as add/delete)
	const toggleGoalStatusMutation = useMutation({
		mutationFn: async({ id, status }) => {
			return await setGoals({ goals: [ { id, status } ] });
		},
		onSuccess: ( _response, { id, status }) => {

			// Update cache optimistically and then invalidate to sync active_goals_count
			updateGoalInCache( id, ( goal ) => {
				goal.status = status;
			});
			invalidateGoals();
		},
		onError: ( error ) => {
			console.error( error );
			toast.error( __( 'Failed to update goal status', 'burst-statistics' ) );

			// Revert the optimistic UI update by re-fetching
			invalidateGoals();
		}
	});

	// Mutation to add a new goal
	const addGoalMutation = useMutation({
		mutationFn: async() => {
			return await addGoal();
		},
		onSuccess: ( response ) => {
			queryClient.setQueryData([ 'goals_data' ], ( oldData ) => {
				if ( ! oldData ) {
					return oldData;
				}

				return produce( oldData, ( draft ) => {
					draft.goals.push( response.goal );
				});
			});

			invalidateGoals();

			toast.success( __( 'Goal added successfully!', 'burst-statistics' ) );
		},
		onError: ( error ) => {
			console.error( error );
			toast.error( __( 'Failed to add goal', 'burst-statistics' ) );
		}
	});

	// Mutation to delete a goal
	const deleteGoalMutation = useMutation({

		/** @param {number} id Goal id. */
		mutationFn: async( id ) => {
			return await deleteGoal( id );
		},
		onSuccess: ( response, id ) => {
			if ( response.deleted ) {
				queryClient.setQueryData([ 'goals_data' ], ( oldData ) => {
					if ( ! oldData ) {
						return oldData;
					}

					return produce( oldData, ( draft ) => {
						if ( 1 === draft.goals.length ) {

							// If there's only one goal left, clear the array
							draft.goals = [];
						} else {

							// Otherwise, remove the specific goal
							const index = draft.goals.findIndex(
								( goal ) => goal.id === id
							);
							if ( -1 !== index ) {
								draft.goals.splice( index, 1 );
							}
						}
					});
				});

				invalidateGoals();

				toast.success(
					__( 'Goal deleted successfully!', 'burst-statistics' )
				);
			}
		},
		onError: ( error ) => {
			console.error( error );
			toast.error( __( 'Failed to delete goal', 'burst-statistics' ) );
		}
	});

	// Mutation to add a predefined goal
	const addPredefinedGoalMutation = useMutation({
		mutationFn: async({ predefinedGoalId }) => {
			if ( ! isPro ) {
				throw new Error(
					__(
						'Predefined goals are a premium feature.',
						'burst-statistics'
					)
				);
			}

			return await addPredefinedGoal( predefinedGoalId );
		},
		onSuccess: ( response ) => {
			queryClient.setQueryData([ 'goals_data' ], ( oldData ) => {
				if ( ! oldData ) {
					return oldData;
				}

				return produce( oldData, ( draft ) => {
					draft.goals.push( response.goal );
				});
			});

			invalidateGoals();

			toast.success(
				__( 'Successfully added predefined goal!', 'burst-statistics' )
			);
		},
		onError: ( error ) => {
			console.error( error );
			toast.error(
				error.message ||
					__( 'Failed to add predefined goal', 'burst-statistics' )
			);
		}
	});

	// activeGoalsCount comes directly from the server response — single source of truth
	const activeGoalsCount = goalsQuery.data?.activeGoalsCount || 0;
	const goalLimit = goalsQuery.data?.goalLimit ?? window.burst_settings?.goal_limit ?? 3;

	return {

		// Data
		activeGoalsCount,
		goalLimit,
		goals: goalsQuery.data?.goals || [],
		predefinedGoals: goalsQuery.data?.predefinedGoals || [],
		isLoading: goalsQuery.isLoading,
		isError: goalsQuery.isError,

		// CRUD Operations
		getGoal,
		setGoalValue,
		updateGoal,
		getGoalAsync,

		// Mutations
		saveGoal: saveGoalMutation.mutateAsync,
		saveGoalTitle: ( id, value ) =>
			saveGoalTitleMutation.mutateAsync({ id, value }),
		toggleGoalStatus: ( id, status ) =>
			toggleGoalStatusMutation.mutateAsync({ id, status }),
		addGoal: addGoalMutation.mutateAsync,
		deleteGoal: deleteGoalMutation.mutateAsync,
		addPredefinedGoal: ( predefinedGoalId ) =>
			addPredefinedGoalMutation.mutateAsync({ predefinedGoalId }),

		// Utility for invalidating queries
		invalidateGoals
	};
};

export default useGoalsData;
