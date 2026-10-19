/**
 * The search-terms row fields the SmartMatch summary reads.
 */
export type SmartMatchSummaryRow = {
	volume: number | string;
	results: number | string;
	ai_shown?: number | string;
};

export type SmartMatchSummaryData = {

	/** Searches without native results that showed an AI match. */
	answered: number;

	/** Searches without native results. */
	emptySearches: number;

	/** Terms without native results that never showed an AI match. */
	termsWithoutPage: number;
};

/**
 * Summarize how SmartMatch covered the searches that found nothing natively.
 *
 * @param {SmartMatchSummaryRow[]} rows Search-term rows (all rows, not just the visible page).
 * @return {SmartMatchSummaryData} The counts for the summary line.
 */
export const summarizeSmartMatchRows = ( rows: SmartMatchSummaryRow[]): SmartMatchSummaryData => {
	const summary: SmartMatchSummaryData = { answered: 0, emptySearches: 0, termsWithoutPage: 0 };

	rows.forEach( ( row ) => {
		if ( 0 !== Number( row.results ) ) {
			return;
		}
		const shown = Number( row.ai_shown ?? 0 );
		summary.answered += shown;
		summary.emptySearches += Number( row.volume );
		if ( 0 === shown ) {
			summary.termsWithoutPage += 1;
		}
	});

	return summary;
};
