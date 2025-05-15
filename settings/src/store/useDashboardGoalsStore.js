import {create} from 'zustand';

// define the store
export const useDashboardGoalsStore = create( set => ({
  goalId: false,
  setGoalId: ( goalId ) => set({goalId: goalId})
}) );
