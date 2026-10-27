import { __, sprintf } from '@wordpress/i18n';
import { usePageWeightStore } from '@/store/usePageWeightStore';
import { formatNumber } from '@/utils/formatting';

type Co2PerPageviewLabelProps = {

	/** Estimated emissions of one measured pageview, in grams CO2e. */
	grams: number;
};

/**
 * The CO2 per pageview shown after the headline weight, e.g. "(0.12 g CO2e)".
 *
 * Follows the block's "Show CO2" toggle. It is always the real estimate, not
 * the green hosting preview, because the community comparison next to the
 * headline ranks the real figure.
 *
 * @param {Co2PerPageviewLabelProps} props - Component props.
 * @return {JSX.Element|null} The label, or null when CO2 is hidden.
 */
const Co2PerPageviewLabel = ({ grams }: Co2PerPageviewLabelProps ) => {
	const showCo2 = usePageWeightStore( ( state ) => state.showCo2 );

	if ( ! showCo2 ) {
		return null;
	}

	return (
		<span className="text-sm font-medium text-text-black">
			{ sprintf(

				/* translators: %s: grams of CO2 equivalent per pageview, e.g. "0.12". */
				__( '(%s g CO2e)', 'burst-statistics' ),
				formatNumber( grams, 2, false )
			) }
		</span>
	);
};

export default Co2PerPageviewLabel;
