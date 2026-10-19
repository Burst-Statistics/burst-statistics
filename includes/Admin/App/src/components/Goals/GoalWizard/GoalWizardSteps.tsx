import { __ } from '@wordpress/i18n';
import WizardStepBar from '@/components/Common/Wizard/WizardStepBar';
import type { WizardStep } from '@/components/Common/Wizard/WizardStepItem';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP, getGoalPage, getGoalSteps, getShortSelector } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import { getGoalTypeLabel } from '@/components/Goals/goalOptions';
import { getCountsOnText } from '@/components/Goals/goalText';
import useWizardGoal from './useWizardGoal';

/**
 * Name of the second step, by what the goal type tracks.
 *
 * @param {string} type The goal type.
 * @return {string} The step name.
 */
const getTargetStepName = ( type: string ): string => {
	if ( 'visits' === type ) {
		return __( 'Page', 'burst-statistics' );
	}
	if ( 'hook' === type ) {
		return __( 'Hook', 'burst-statistics' );
	}
	return __( 'Element', 'burst-statistics' );
};

/**
 * What the second step chose, as its label once done.
 *
 * @param {Goal} goal The goal.
 * @return {string} The chosen target, empty when nothing is chosen.
 */
const getTargetValue = ( goal: Goal ): string => {
	if ( 'visits' === goal.type ) {
		return goal.specific_page ? getGoalPage( goal ) : '';
	}
	if ( 'hook' === goal.type ) {
		return goal.hook;
	}
	return goal.selector ? getShortSelector( goal.selector ) : '';
};

/**
 * The name of each step, by step number.
 *
 * @param {string} type The goal type.
 * @return {Record<number, string>} The step names.
 */
const getStepNames = ( type: string ): Record<number, string> => ({
	[ GOAL_STEP.START ]: __( 'Goal type', 'burst-statistics' ),
	[ GOAL_STEP.TARGET ]: getTargetStepName( type ),
	[ GOAL_STEP.COUNT ]: __( 'Where it counts', 'burst-statistics' ),
	[ GOAL_STEP.REVIEW ]: __( 'Name & save', 'burst-statistics' )
});

/**
 * What was chosen on a step the user is past, if anything.
 *
 * @param {number}      step        The step number.
 * @param {string}      type        The goal type.
 * @param {Goal | null} goal        The goal, null before it is created.
 * @param {number}      currentStep The step the user is on.
 * @return {string | undefined} The chosen value, empty or undefined when there is none to show.
 */
const getDoneValue = ( step: number, type: string, goal: Goal | null, currentStep: number ): string | undefined => {
	if ( ! goal || step >= currentStep ) {
		return '';
	}

	const values: Record<number, string> = {
		[ GOAL_STEP.START ]: getGoalTypeLabel( type ),
		[ GOAL_STEP.TARGET ]: getTargetValue( goal ),
		[ GOAL_STEP.COUNT ]: getCountsOnText( goal )
	};
	return values[ step ];
};

/**
 * One step of the bar: its name, or what was chosen on it once the user is past it.
 *
 * @param {number}      step        The step number.
 * @param {string}      type        The goal type.
 * @param {Goal | null} goal        The goal, null before it is created.
 * @param {number}      currentStep The step the user is on.
 * @return {WizardStep} The step.
 */
const getStep = ( step: number, type: string, goal: Goal | null, currentStep: number ): WizardStep => {
	const value = getDoneValue( step, type, goal, currentStep );
	return {
		number: step,
		label: value || getStepNames( type )[ step ],
		isCode: !! value && GOAL_STEP.TARGET === step && 'visits' !== type
	};
};

/**
 * Step bar of the goal wizard: the steps the goal type goes through, labelled
 * with what was chosen once done. Steps become clickable once the goal exists.
 *
 * @return {JSX.Element} The step bar.
 */
const GoalWizardSteps = (): JSX.Element => {
	const goal = useWizardGoal();
	const pendingType = useGoalWizardStore( ( state ) => state.pendingType );
	const currentStep = useGoalWizardStore( ( state ) => state.currentStep );
	const setCurrentStep = useGoalWizardStore( ( state ) => state.setCurrentStep );
	const type = goal ? goal.type : pendingType;

	const steps = getGoalSteps( type ).map( ( step ) => getStep( step, type, goal, currentStep ) );

	return (
		<WizardStepBar
			steps={steps}
			currentStep={currentStep}
			isClickable={null !== goal}
			onSelect={setCurrentStep}
			isNumbered
		/>
	);
};

export default GoalWizardSteps;
