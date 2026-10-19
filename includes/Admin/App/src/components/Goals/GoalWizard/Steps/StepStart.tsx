import useWizardGoal from '../useWizardGoal';
import ChangeGoalType from './Start/ChangeGoalType';
import NewGoalStart from './Start/NewGoalStart';

/**
 * Step 1: start from a preset or build a custom goal.
 *
 * Once the goal exists (the user came back to this step) only the type can
 * still change, so the preset choice is no longer offered.
 *
 * @return {JSX.Element} The start step.
 */
const StepStart = (): JSX.Element => {
	const goal = useWizardGoal();

	return goal ? <ChangeGoalType goal={goal} /> : <NewGoalStart />;
};

export default StepStart;
