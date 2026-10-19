import { usePageWeightStore } from '@/store/usePageWeightStore';
import type { FooterFigures } from './footerSections';
import type { PageWeightData } from './usePageWeightData';

type UseFooterFiguresReturn = {

	/** The figures to render, real or previewed; null before the first response. */
	figures: FooterFigures | null;

	/** Whether those figures are the green hosting preview rather than the real ones. */
	isPreviewing: boolean;
};

/**
 * Chooses between the real emissions figures and the green hosting preview.
 *
 * The preview is a reader-local display choice: the server sends both sets, so
 * nothing here makes a request or changes what another reader sees. A verified
 * green site is already reported on green hosting, so there is nothing to
 * preview — guarding that here as well as in the menu keeps a stale
 * localStorage value from swapping in a duplicate set of figures.
 *
 * @param {PageWeightData|null} data - The block payload, or null before the first response.
 * @return {UseFooterFiguresReturn} The figures to render and whether they are a preview.
 */
export function useDisplayFigures( data: PageWeightData | null ): UseFooterFiguresReturn {
	const assumeGreenHosting = usePageWeightStore( ( state ) => state.assumeGreenHosting );

	if ( null === data ) {
		return { figures: null, isPreviewing: false };
	}

	const isPreviewing = assumeGreenHosting && ! data.green_hosting.status.green;

	if ( isPreviewing ) {
		return { figures: data.green_preview, isPreviewing };
	}

	return {
		figures: {
			total_co2_grams: data.total_co2_grams,
			co2_per_pageview_grams: data.co2_per_pageview_grams,
			carbon_rating: data.carbon_rating
		},
		isPreviewing
	};
}

