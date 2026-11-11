import { __ } from '@wordpress/i18n';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import type { GoalKind } from '@/components/Goals/goalHelpers';
import GoalStepHeading from '../GoalStepHeading';
import GoalTypeCards from './GoalTypeCards';

/**
 * Type choice for a custom goal that is not created yet; the type is kept in the wizard store until then.
 *
 * @return {JSX.Element} The type choice.
 */
const CustomGoalType = (): JSX.Element => {
	const pendingKind = useGoalWizardStore( ( state ) => state.pendingKind );
	const setPendingKind = useGoalWizardStore( ( state ) => state.setPendingKind );

	return (
		<div className="flex flex-col gap-6">
			<GoalStepHeading
				title={__( 'What do you want to count?', 'burst-statistics' )}
				description={__( 'Pick what a conversion looks like. You can change this later.', 'burst-statistics' )}
			/>
			<GoalTypeCards value={pendingKind} onChange={( kind ) => setPendingKind( kind as GoalKind )} />
		</div>
	);
};

export default CustomGoalType;
