import type { Goal } from '@/components/Goals/goalHelpers';
import useWizardGoal from '../useWizardGoal';
import ElementTarget from './Target/ElementTarget';
import VisitTarget from './Target/VisitTarget';
import HookTarget from './Target/HookTarget';

// The inputs each goal type needs to know what it tracks.
const TARGETS: Record<string, ( props: { goal: Goal }) => JSX.Element> = {
	clicks: ElementTarget,
	views: ElementTarget,
	visits: VisitTarget,
	hook: HookTarget
};

/**
 * Step 2: what exactly the goal listens for: an element, a page or a hook.
 *
 * @return {JSX.Element | null} The target step.
 */
const StepTarget = (): JSX.Element | null => {
	const goal = useWizardGoal();

	if ( ! goal ) {
		return null;
	}

	const Target = TARGETS[goal.type];

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			{
				Target &&
				<Target goal={goal} />
			}
		</div>
	);
};

export default StepTarget;
