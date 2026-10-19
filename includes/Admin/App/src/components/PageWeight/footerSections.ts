/** The emissions figures the footer can report. */
export type FooterFigures = {
	total_co2_grams: number;
	co2_per_pageview_grams: number;
	carbon_rating: string;
};

/** What the footer should render. */
export type FooterSections = {

	/** The figures to report, or null when there are none to report. */
	figures: FooterFigures | null;

	/** Whether to show the emissions sentence. */
	showEstimate: boolean;

	/** Whether to show the carbon rating badge. */
	showRating: boolean;

	/** Whether the figures shown are the green hosting preview. */
	isAssumed: boolean;
};

type FooterSectionsArgs = {

	/** The figures chosen for display, real or preview. */
	figures: FooterFigures | null;

	/** Whether those figures are the preview. */
	isPreviewing: boolean;

	/** Whether the block is still measuring. */
	measuring: boolean;

	/** Whether the reader wants the emissions sentence shown. */
	showCo2: boolean;

	/** Whether the reader wants the carbon rating shown. */
	showRating: boolean;
};

/**
 * Decides which parts of the footer to render.
 *
 * The two menu toggles are independent: hiding the emissions sentence must not
 * take the carbon rating with it, and vice versa. Both need figures to exist,
 * which is the one thing they genuinely share — while the block is measuring
 * there is nothing for either to report, whatever the toggles say. A preview
 * is likewise meaningless without figures to preview.
 *
 * @param args - The block's current state.
 * @return What the footer should render.
 */
export function getFooterSections({
	figures,
	isPreviewing,
	measuring,
	showCo2,
	showRating
}: FooterSectionsArgs ): FooterSections {
	if ( measuring || null === figures ) {
		return { figures: null, showEstimate: false, showRating: false, isAssumed: false };
	}

	return {
		figures,
		showEstimate: showCo2,
		showRating,
		isAssumed: isPreviewing
	};
}
