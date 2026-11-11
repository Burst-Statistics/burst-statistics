import { useDateRange } from '@/hooks/useDateRange';
import { useInsightsData } from '@/hooks/useInsightsData';
import { COMPARE_MODES } from '@/store/useCompareStore';
import InsightsGraph from '@/components/Statistics/InsightsGraph';
import { InsightsLegend } from '@/components/Statistics/InsightsBlock';

interface GoalTrendChartProps {

	// Goal id, or 'all' for every active goal.
	goalId: string;
}

// Counts like the numbers above the chart: by each goal's own conversion metric.
const METRICS = [ 'goal_conversions' ];

/**
 * Conversions over the period against the previous period, on the insights chart.
 * The interval follows the date range, as on the insights page.
 *
 * @param {GoalTrendChartProps} props        Component props.
 * @param {string}              props.goalId The goal, or 'all'.
 * @return {JSX.Element} The chart.
 */
const GoalTrendChart = ({ goalId }: GoalTrendChartProps ): JSX.Element => {
	const { startDate, endDate, range } = useDateRange();

	const query = useInsightsData({
		startDate,
		endDate,
		range,
		metrics: METRICS,
		compareMode: COMPARE_MODES.PREVIOUS_PERIOD,
		filters: { goal_id: goalId }
	});
	const loading = query.isLoading || query.isFetching;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex justify-end">
				<InsightsLegend datasets={query.data?.datasets ?? []} loading={loading} />
			</div>
			<div className="h-64">
				{query.data && (
					<InsightsGraph
						data={query.data}
						timestamps={query.data.timestamps}
						interval={query.data.interval}
						spansMultipleYears={query.data.spans_multiple_years}
					/>
				)}
			</div>
		</div>
	);
};

export default GoalTrendChart;
