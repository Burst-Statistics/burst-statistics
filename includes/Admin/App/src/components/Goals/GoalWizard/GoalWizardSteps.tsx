import { __ } from '@wordpress/i18n';
import WizardStepBar from '@/components/Common/Wizard/WizardStepBar';
import type { WizardStep } from '@/components/Common/Wizard/WizardStepItem';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { GOAL_STEP, getGoalKind, getGoalPage, getGoalSteps, getShortSelector, parseEventFilter } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import { getGoalTypeLabel } from '@/components/Goals/goalOptions';
import { getCountsOnText } from '@/components/Goals/goalText';
import useWizardGoal from './useWizardGoal';

/**
 * Name of the second step, by what the goal type tracks.
 *
 * @param {string} kind The goal kind.
 * @return {string} The step name.
 */
const getTargetStepName = ( kind: string ): string => {
	if ( 'visits' === kind ) {
		return __( 'Page', 'burst-statistics' );
	}
	if ( 'hook' === kind ) {
		return __( 'Hook', 'burst-statistics' );
	}
	if ( 'download' === kind ) {
		return __( 'Which files', 'burst-statistics' );
	}
	if ( 'event' === kind ) {
		return __( 'Event', 'burst-statistics' );
	}
	return __( 'Element', 'burst-statistics' );
};

/**
 * What the second step chose, as its label once done.
 *
 * @param {Goal} goal The goal.
 * @return {string} The chosen target, empty when nothing is chosen.
 */
// fallow-ignore-next-line complexity
const getTargetValue = ( goal: Goal ): string => {
	const kind = getGoalKind( goal );
	if ( 'visits' === kind ) {
		return goal.specific_page ? getGoalPage( goal ) : '';
	}
	if ( 'hook' === kind ) {
		return goal.hook;
	}
	if ( 'download' === kind ) {
		const filter = parseEventFilter( goal.event_filter );
		if ( ! filter ) {
			return __( 'Any file', 'burst-statistics' );
		}
		if ( 'file_name' === filter.key && 'string' === typeof filter.value ) {
			return filter.value;
		}
		if ( 'file_extension' === filter.key ) {
			return Array.isArray( filter.value ) ? filter.value.join( ', ' ) : String( filter.value );
		}
		return __( 'Any file', 'burst-statistics' );
	}
	if ( 'event' === kind ) {
		return goal.hook;
	}
	return goal.selector ? getShortSelector( goal.selector ) : '';
};

/**
 * The name of each step, by step number.
 *
 * @param {string} kind The goal kind.
 * @return {Record<number, string>} The step names.
 */
const getStepNames = ( kind: string ): Record<number, string> => ({
	[ GOAL_STEP.START ]: __( 'Goal type', 'burst-statistics' ),
	[ GOAL_STEP.TARGET ]: getTargetStepName( kind ),
	[ GOAL_STEP.COUNT ]: __( 'Where it counts', 'burst-statistics' ),
	[ GOAL_STEP.REVIEW ]: __( 'Name & save', 'burst-statistics' )
});

/**
 * What was chosen on a step the user is past, if anything.
 *
 * @param {number}      step        The step number.
 * @param {string}      kind        The goal kind.
 * @param {Goal | null} goal        The goal, null before it is created.
 * @param {number}      currentStep The step the user is on.
 * @return {string | undefined} The chosen value, empty or undefined when there is none to show.
 */
const getDoneValue = ( step: number, kind: string, goal: Goal | null, currentStep: number ): string | undefined => {
	if ( ! goal || step >= currentStep ) {
		return '';
	}

	const values: Record<number, string> = {
		[ GOAL_STEP.START ]: getGoalTypeLabel( kind ),
		[ GOAL_STEP.TARGET ]: getTargetValue( goal ),
		[ GOAL_STEP.COUNT ]: getCountsOnText( goal )
	};
	return values[ step ];
};

/**
 * One step of the bar: its name, or what was chosen on it once the user is past it.
 *
 * @param {number}      step        The step number.
 * @param {string}      kind        The goal kind.
 * @param {Goal | null} goal        The goal, null before it is created.
 * @param {number}      currentStep The step the user is on.
 * @return {WizardStep} The step.
 */
// fallow-ignore-next-line complexity
const getStep = ( step: number, kind: string, goal: Goal | null, currentStep: number ): WizardStep => {
	const value = getDoneValue( step, kind, goal, currentStep );
	const filter = parseEventFilter( goal?.event_filter );
	const isPlainDownload = 'download' === kind && ! filter;
	return {
		number: step,
		label: value || getStepNames( kind )[ step ],
		isCode: !! value && GOAL_STEP.TARGET === step && 'visits' !== kind && ! isPlainDownload
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
	const pendingKind = useGoalWizardStore( ( state ) => state.pendingKind );
	const currentStep = useGoalWizardStore( ( state ) => state.currentStep );
	const setCurrentStep = useGoalWizardStore( ( state ) => state.setCurrentStep );
	const kind = goal ? getGoalKind( goal ) : pendingKind;
	const type = goal ? goal.type : ( 'download' === pendingKind || 'event' === pendingKind ? 'event' : pendingKind );

	const steps = getGoalSteps( type ).map( ( step ) => getStep( step, kind, goal, currentStep ) );

	return (
		<WizardStepBar
			steps={steps}
			currentStep={currentStep}
			isClickable={null !== goal}
			onSelect={setCurrentStep}
		/>
	);
};

export default GoalWizardSteps;
