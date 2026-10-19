import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { toast } from '@/utils/toast';
import { setGoals } from '@/utils/api';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import type { Goal } from '@/components/Goals/goalHelpers';

export interface GoalWizardSave {

	// True while a save is running, so the buttons can't fire it twice.
	isSaving: boolean;

	// Creates the goal from the type chosen on the first step, then moves on.
	createGoal: () => Promise<void>;

	// Saves the goal and moves on to the next step.
	saveGoal: () => Promise<void>;

	// Saves the goal as active or as a draft and closes the wizard.
	finishGoal: ( activate: boolean ) => Promise<void>;
}

/**
 * The save actions of the goal wizard footer.
 *
 * @param {Goal | null} goal The goal being edited, null before it is created.
 * @return {GoalWizardSave} The save state and actions.
 */
const useGoalWizardSave = ( goal: Goal | null ): GoalWizardSave => {
	const pendingType = useGoalWizardStore( ( state ) => state.pendingType );
	const { nextStep, closeWizard, setNewGoal } = useGoalWizardStore.getState();
	const { addGoal, setGoalValue, saveGoal: saveGoalById, invalidateGoals } = useGoalsData();
	const [ isSaving, setIsSaving ] = useState( false );

	const runSaving = async( action: () => Promise<void> ) => {
		setIsSaving( true );
		try {
			await action();
		} catch {

			// The mutations already show an error toast.
		} finally {
			setIsSaving( false );
		}
	};

	/**
	 * Save the goal from the cache. Hook goals count on every page: the wizard no
	 * longer offers a page for them, so an older page scope is reset here.
	 *
	 * @param {Goal} current The goal to save.
	 * @return {Promise<unknown>} The save request.
	 */
	const saveFromCache = ( current: Goal ) => {
		if ( 'hook' === current.type && 'website' !== current.page_or_website ) {
			setGoalValue( current.id, 'page_or_website', 'website' );
		}
		return saveGoalById( current.id );
	};

	const createGoal = () => runSaving( async() => {
		const response = await addGoal();
		const id = response.goal.id;

		// Explicit payload instead of the cache: the add mutation refetches goals in the background.
		await setGoals({
			goals: [ {
				id,
				type: pendingType,
				title: __( 'New goal', 'burst-statistics' ),

				// Visits count on one page, but until it is chosen 'page' would make the server save the home page.
				page_or_website: 'website'
			} ]
		});
		await invalidateGoals();
		setNewGoal( id );
		nextStep( pendingType );
	});

	const saveGoal = () => runSaving( async() => {
		if ( ! goal ) {
			return;
		}
		await saveFromCache( goal );
		nextStep( goal.type );
	});

	const finishGoal = ( activate: boolean ) => runSaving( async() => {
		if ( ! goal ) {
			return;
		}
		setGoalValue( goal.id, 'status', activate ? 'active' : 'inactive' );
		await saveFromCache( goal );
		toast.success( activate ?
			__( 'Goal is active and counting conversions', 'burst-statistics' ) :
			__( 'Goal saved as a draft', 'burst-statistics' )
		);
		closeWizard();
	});

	return { isSaving, createGoal, saveGoal, finishGoal };
};

export default useGoalWizardSave;
