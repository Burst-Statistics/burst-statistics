import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalMetricChoice from './GoalMetricChoice';

// The unit a conversion rate is per, as it reads in the folded summary.
const METRIC_UNITS: Record<string, string> = {
	visitors: __( 'visitor', 'burst-statistics' ),
	sessions: __( 'session', 'burst-statistics' ),
	pageviews: __( 'pageview', 'burst-statistics' )
};

/**
 * Folded away by default: what the conversion rate is per. Visitors suits most goals.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being saved.
 * @return {JSX.Element} The advanced settings.
 */
const GoalAdvancedSettings = ({ goal }: { goal: Goal }): JSX.Element => (
	<details className="group rounded-xl border border-gray-200 bg-white px-5 py-4">
		<summary className="flex cursor-pointer list-none items-center gap-2 text-base text-text-black">
			<Icon name="chevron-right" size={16} color="gray" className="transition-transform group-open:rotate-90" />
			{__( 'Advanced', 'burst-statistics' )}
			<span className="text-text-gray">
				{'· ' + sprintf(

					/* translators: %s: what the conversion rate is per, e.g. visitor. */
					__( 'conversion rate per %s', 'burst-statistics' ),
					METRIC_UNITS[ goal.conversion_metric ] ?? goal.conversion_metric
				)}
			</span>
		</summary>

		<div className="mt-4">
			<GoalMetricChoice goal={goal} />
		</div>
	</details>
);

export default GoalAdvancedSettings;
