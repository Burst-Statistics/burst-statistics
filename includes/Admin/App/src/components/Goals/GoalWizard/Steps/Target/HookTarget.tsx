import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import useGoalsData from '@/hooks/useGoalsData';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalHookInput from '@/components/Goals/GoalWizard/Fields/GoalHookInput';
import GoalStepHeading from '../GoalStepHeading';
import GoalInfoNote from '../GoalInfoNote';

/**
 * What a hook goal tracks: the WordPress action that counts as a conversion.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being edited.
 * @return {JSX.Element} The hook input.
 */
const HookTarget = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();
	const hook = goal.hook.trim();

	return (
		<>
			<GoalStepHeading
				title={__( 'Which WordPress hook should count as a conversion?', 'burst-statistics' )}
				description={__( 'Each time this action runs for a visitor, one conversion is counted.', 'burst-statistics' )}
			/>

			<GoalHookInput
				goalId={goal.id}
				hook={goal.hook}
				label={__( 'Hook name', 'burst-statistics' )}
				help={__( 'An action name, without add_action(). Example: gform_after_submission.', 'burst-statistics' )}
				onChange={( value ) => setGoalValue( goal.id, 'hook', value )}
			/>

			{hook && (
				<GoalInfoNote>
					{createInterpolateElement(

						/* translators: <hook />: the WordPress hook name, e.g. woocommerce_thankyou. */
						__( 'A conversion is counted when <hook /> runs.', 'burst-statistics' ),
						{ hook: <code className="font-mono">{hook}</code> }
					)}
				</GoalInfoNote>
			)}
		</>
	);
};

export default HookTarget;
