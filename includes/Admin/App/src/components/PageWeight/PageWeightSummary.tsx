import { __ } from '@wordpress/i18n';
import HelpTooltip from '@/components/Common/HelpTooltip';
import { formatFileSize } from '@/utils/formatting';
import { getWeightChange } from './pageWeightFormat';
import type { PageWeightData } from './usePageWeightData';

type PageWeightSummaryProps = {

	/** Average measured weight carried by one pageview, in bytes. */
	avgBytes: number;

	/** The like-for-like comparison with the preceding period, or null when unknown. */
	trend: PageWeightData['weight_trend'];
};

/**
 * The headline figure: average page weight and how it moved.
 *
 * @param {PageWeightSummaryProps} props - Component props.
 * @return {JSX.Element} The headline row.
 */
const PageWeightSummary = ({ avgBytes, trend }: PageWeightSummaryProps ) => {
	const change = trend ? getWeightChange( trend.current_avg_bytes, trend.previous_avg_bytes ) : null;

	return (
		<div className="flex items-baseline gap-2 px-5 pb-3">
			<span className="text-3xl font-bold text-text-black">
				{ formatFileSize( avgBytes ) }
			</span>
			<span className="text-sm text-text-gray">
				{ __( 'avg. per pageview', 'burst-statistics' ) }
			</span>
			{ change && (
				<HelpTooltip
					content={__( 'Change against the previous period, compared over the pages that were already measured in both periods. Pages first measured this period are left out, so growing coverage does not read as a change in weight — which is why this percentage can point the other way than the average shown here.', 'burst-statistics' )}
					side="top"
				>
					<span className={`cursor-help text-sm font-medium ${ change.isImprovement ? 'text-green' : 'text-red' }`}>
						{ change.label }
					</span>
				</HelpTooltip>
			) }
		</div>
	);
};

export default PageWeightSummary;
