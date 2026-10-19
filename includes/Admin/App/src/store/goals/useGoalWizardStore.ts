import { create } from 'zustand';
import { GOAL_STEP, getGoalSteps } from '@/components/Goals/goalHelpers';

type GoalStartMode = 'preset' | 'custom';

interface GoalWizardStore {
	isOpen: boolean;

	// Null until the goal row is created on the first step.
	goalId: number | null;
	currentStep: number;
	startMode: GoalStartMode | null;

	// Type chosen before the goal row exists.
	pendingType: string;

	openWizard: ( goalId?: number, step?: number ) => void;
	closeWizard: () => void;
	setNewGoal: ( id: number ) => void;
	setCurrentStep: ( step: number ) => void;

	// Move by one of the steps the goal type goes through.
	nextStep: ( type: string ) => void;
	prevStep: ( type: string ) => void;
	setStartMode: ( mode: GoalStartMode ) => void;
	setPendingType: ( type: string ) => void;
}

const INITIAL_STATE = {
	isOpen: false,
	goalId: null,
	currentStep: GOAL_STEP.START,
	startMode: null,
	pendingType: 'clicks'
};

const clampStep = ( step: number ): number =>
	Math.min( GOAL_STEP.REVIEW, Math.max( GOAL_STEP.START, step ) );

/**
 * The step after the current one for this goal type, or the last step.
 *
 * @param {string} type    The goal type.
 * @param {number} current The current step.
 * @return {number} The next step.
 */
const getNextStep = ( type: string, current: number ): number => {
	const steps = getGoalSteps( type );
	return steps.find( ( step ) => step > current ) ?? steps[ steps.length - 1 ];
};

/**
 * The step before the current one for this goal type, or the first step.
 *
 * @param {string} type    The goal type.
 * @param {number} current The current step.
 * @return {number} The previous step.
 */
const getPrevStep = ( type: string, current: number ): number => {
	const steps = getGoalSteps( type );
	return [ ...steps ].reverse().find( ( step ) => step < current ) ?? steps[0];
};

export const useGoalWizardStore = create<GoalWizardStore>( ( set ) => ({
	...INITIAL_STATE,

	openWizard: ( goalId, step ) => {
		if ( undefined === goalId ) {
			set({ ...INITIAL_STATE, isOpen: true });
			return;
		}

		set({
			...INITIAL_STATE,
			isOpen: true,
			goalId,
			currentStep: step ?? GOAL_STEP.REVIEW
		});
	},
	closeWizard: () => set({ ...INITIAL_STATE }),
	setNewGoal: ( goalId ) => set({ goalId }),
	setCurrentStep: ( step ) => set({ currentStep: clampStep( step ) }),
	nextStep: ( type ) => set( ( state ) => ({ currentStep: getNextStep( type, state.currentStep ) }) ),
	prevStep: ( type ) => set( ( state ) => ({ currentStep: getPrevStep( type, state.currentStep ) }) ),
	setStartMode: ( startMode ) => set({ startMode }),
	setPendingType: ( pendingType ) => set({ pendingType })
}) );
