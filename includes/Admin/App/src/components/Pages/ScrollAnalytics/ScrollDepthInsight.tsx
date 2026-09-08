import { __, sprintf } from '@wordpress/i18n';
import { InsightCallout } from '@/components/Common/InsightCallout';
import { formatDuration } from '@/utils/formatting';

interface ScrollDepthInsightProps {
	insight?: {
		range: string;
		dwellSeconds: number;
	};
}

/**
 * Explains the most actionable drop-off shown in the scroll-depth chart.
 *
 * @param props - Component props.
 * @param props.insight - Live scroll-depth insight datum.
 * @return Scroll-depth insight or null if no insight data.
 */
export const ScrollDepthInsight = ({ insight }: ScrollDepthInsightProps ) => {
	if ( ! insight?.range ) {
		return null;
	}

	return (
		<InsightCallout>
			{sprintf(

				/* translators: 1: scroll-depth range, 2: average dwell time. */
				__(
					'Biggest drop-off between %1$s: readers spend only %2$s here before leaving. Something around the middle of this page loses attention.',
					'burst-statistics'
				),
				insight.range,
				formatDuration( insight.dwellSeconds ?? 0 )
			)}
		</InsightCallout>
	);
};
