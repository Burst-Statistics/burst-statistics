import { getGoalKind } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import useWizardGoal from '../useWizardGoal';
import ElementTarget from './Target/ElementTarget';
import VisitTarget from './Target/VisitTarget';
import HookTarget from './Target/HookTarget';
import FileTarget from './Target/FileTarget';
import EventTarget from './Target/EventTarget';

// The inputs each goal type needs to know what it tracks.
const TARGETS: Record<string, ( props: { goal: Goal }) => JSX.Element> = {
	clicks: ElementTarget,
	views: ElementTarget,
	visits: VisitTarget,
	hook: HookTarget,
	download: FileTarget,
	event: EventTarget
};

/**
 * Step 2: what exactly the goal listens for: an element, a page, a hook, a file download or a custom event.
 *
 * @return {JSX.Element | null} The target step.
 */
const StepTarget = (): JSX.Element | null => {
	const goal = useWizardGoal();

	if ( ! goal ) {
		return null;
	}

	const kind = getGoalKind( goal );
	const Target = TARGETS[ kind ];

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
