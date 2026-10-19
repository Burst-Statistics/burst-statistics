import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import { GOAL_METRICS } from '@/components/Goals/goalOptions';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalOptionInput from '@/components/Goals/GoalWizard/Fields/GoalOptionInput';

// What each metric makes the conversion rate mean.
const METRIC_EXPLANATIONS: Record<string, string> = {
	visitors: __( 'Visitors: what share of people converted, counted once per person.', 'burst-statistics' ),
	sessions: __( 'Sessions: what share of visits ended in a conversion. Best when people come back often.', 'burst-statistics' ),
	pageviews: __( 'Pageviews: conversions per page loaded. Best for actions on a single page.', 'burst-statistics' )
};

/**
 * What the goal's conversion rate is relative to: visitors, sessions or pageviews.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being set up.
 * @return {JSX.Element} The metric choice.
 */
const GoalMetricChoice = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();

	return (
		<div className="flex flex-col gap-3">
			<GoalOptionInput
				name="conversion_metric"
				goalId={goal.id}
				label={__( 'What metric do you want to use to calculate the conversion rate?', 'burst-statistics' )}
				options={GOAL_METRICS}
				value={goal.conversion_metric}
				onChange={( metric ) => setGoalValue( goal.id, 'conversion_metric', metric )}
			/>
			<p className="text-sm text-text-gray">
				{METRIC_EXPLANATIONS[ goal.conversion_metric ]}
			</p>
		</div>
	);
};

export default GoalMetricChoice;
