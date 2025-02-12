import { create } from 'zustand';
import {produce} from 'immer';
import * as burst_api from '../utils/api';
import {toast} from 'react-toastify';
import {__} from '@wordpress/i18n';
import {setGoals} from '../utils/api';

export const useGoalsStore = create( ( set, get ) => {
  const loadGoals = async() => {
    try {
      const {goals, predefinedGoals, goalFields} = await burst_api.getGoals();

      //convert goalFields object to array
      let goalFieldsArray = Object.values( goalFields );
      set({goals: goals, predefinedGoals: predefinedGoals, goalFields: goalFieldsArray});
    } catch ( error ) {
      toast.error( __( 'Failed to load goals', 'burst-statistics' ) );
    }
  };

  const addPredefinedGoal = async( predefinedGoalId, type, cookieless ) => {
    if ( 'hook' === type && cookieless ) {
      toast.error( __( 'Cannot add server side goals in combination with cookieless tracking', 'burst-statistics' ) );
      return;
    }

    if ( ! burst_settings.is_pro ) {
      toast.error( __( 'Predefined goals are a premium feature.', 'burst-statistics' ) );
      return;
    }

    try {
      const response = await toast.promise( burst_api.addPredefinedGoal( predefinedGoalId ), {
        pending: __( 'Adding predefined goal...', 'burst-statistics' ),
        success: __( 'Successfully added predefined goal!', 'burst-statistics' ),
        error: __( 'Failed to add predefined goal', 'burst-statistics' )
      });

      const goal = response.goal;
      set( produce( ( state ) => {
        state.goals.push( goal );
      }) );
    } catch ( error ) {
      console.error( error );
      toast.error( __( 'Something went wrong', 'burst-statistics' ) );
    }
  };

  const getGoal = ( id )=>  {
    let goals = get().goals;
    if ( ! Array.isArray( goals ) ) {
        return false;
    }

    //not absolute comparison, to allow comparing strings and integers.
    let index = goals.findIndex( goal => goal.id == id );
    if ( -1 !== index ) {
      return goals[index];
    }
    return false;
  };

  const addGoal = async() => {
    try {
      const response = await toast.promise( burst_api.addGoal(), {
        pending: __( 'Adding goal...', 'burst-statistics' ),
        success: __( 'Goal added successfully!', 'burst-statistics' ),
        error: __( 'Failed to add goal', 'burst-statistics' )
      });
      set( produce( ( state ) => {
        state.goals.push( response.goal );
      }) );
    } catch ( error ) {
      console.error( error );
      toast.error( __( 'Something went wrong', 'burst-statistics' ) );
    }
  };

  const deleteGoal = async( id ) => {
    try {
      const response = await toast.promise( burst_api.deleteGoal( id ), {
        pending: __( 'Deleting goal...', 'burst-statistics' ),
        success: __( 'Goal deleted successfully!', 'burst-statistics' ),
        error: __( 'Failed to delete goal', 'burst-statistics' )
      });
      if ( response.deleted ) {

        set( produce( ( draft ) => {

          // if there is only one goal left we a new one was created,
          if ( 1 === draft.goals.length ) {
            draft.goals = [];
          } else {

            //find goal with goal.id = id, and delete from the array
            let index = draft.goals.findIndex( goal => goal.id === id );
            if ( -1 !== index ) {
              draft.goals.splice( index, 1 );
            }
          }
        }) );
      }
    } catch ( error ) {
      console.error( error );
      toast.error( __( 'Something went wrong', 'burst-statistics' ) );
    }
  };

  const setGoalValue = ( id, type, value ) => {

    //find goal by id in goals array
    let found = false;
    let index = false;
    set(
        produce( ( state ) => {
          state.goals.forEach( function( goalItem, i ) {
            if ( goalItem.id === id ) {
              index = i;
              found = true;
            }
          });
          if ( false !== index ) {
            state.goals[index][type] = value;
          }
        })
    );
  };

  const saveGoals = async() => {
    try {
      let data = {goals: get().goals};
      const response = await burst_api.setGoals( data );
      return Promise.resolve( response );
    } catch ( error ) {
      console.error( error );
      return Promise.reject( error );
    }
  };

  const updateGoal = ( id, data ) => set( produce( ( draft ) => {
    draft.goals[id] = { ...draft.goals[id], ...data };
  }) );

  const saveGoalTitle = async( id, value ) => {
    try {
      let goal = {
        'id': id,
        'title': value
      };
      let goals = [];
      goals.push( goal );

      let data = {goals: goals};
      await burst_api.setGoals( data );
      return Promise.resolve();
    } catch ( error ) {
      console.error( error );
      return Promise.reject( error );
    }
  };

  // Load goals on store creation
  loadGoals();

  return {
    goals: {},
    goalFields: {},
    addGoal,
    deleteGoal,
    updateGoal,
    addPredefinedGoal,
    setGoalValue,
    saveGoals,
    saveGoalTitle,
    getGoal
  };
});
