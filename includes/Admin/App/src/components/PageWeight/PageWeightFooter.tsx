import EstimateSection from './EstimateSection';
import GreenHostingSection from './GreenHostingSection';
import type { FooterFigures } from './footerSections';
import type { GreenHostingState } from './usePageWeightData';

type PageWeightFooterProps = {

	/** The figures to report, or null when there are none to report. */
	figures: FooterFigures | null;

	/** Whether to show the emissions sentence. */
	showEstimate: boolean;

	/** Whether to show the carbon rating badge. */
	showRating: boolean;

	/** Whether the figures are the green hosting preview rather than the real ones. */
	isAssumed: boolean;

	/** Share of pageviews the figures are based on, 0 to 1. */
	measuredRatio: number;

	/** Green hosting state behind the check action. */
	greenHosting: GreenHostingState;

	/** Whether a green hosting check is in flight. */
	isChecking: boolean;

	/** Starts a green hosting check. */
	onCheck: () => void;
};

/**
 * The footer below the Page weight table.
 *
 * Two sections: what the emissions are, and what the site is hosted on. The
 * first appears only when there is something to report and the reader has not
 * hidden both halves of it; the second is always present.
 *
 * @param {PageWeightFooterProps} props - Component props.
 * @return {JSX.Element} The footer.
 */
const PageWeightFooter = ({
	figures,
	showEstimate,
	showRating,
	isAssumed,
	measuredRatio,
	greenHosting,
	isChecking,
	onCheck
}: PageWeightFooterProps ) => {
	const hasEstimate = null !== figures && ( showEstimate || showRating );

	return (
		<div className="border-t border-gray-200 px-5 py-4 text-sm">
			{ hasEstimate && (
				<EstimateSection
					figures={figures}
					showEstimate={showEstimate}
					showRating={showRating}
					isAssumed={isAssumed}
					measuredRatio={measuredRatio}
				/>
			) }

			<GreenHostingSection
				greenHosting={greenHosting}
				isChecking={isChecking}
				onCheck={onCheck}
				className={ hasEstimate ? 'mt-4' : '' }
			/>
		</div>
	);
};

export default PageWeightFooter;
