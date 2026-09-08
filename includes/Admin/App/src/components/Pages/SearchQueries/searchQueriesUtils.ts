import type { SearchQueryRow } from '@/api/getSearchQueriesData';

const OPPORTUNITY_FLOOR_IMPRESSIONS = 100;
const OPPORTUNITY_IMPRESSIONS_PER_DAY = 10;
const OPPORTUNITY_MIN_POSITION = 5;
const OPPORTUNITY_MAX_POSITION = 15;
const OPPORTUNITY_CTR_FACTOR = 0.5;

/**
 * Rough average organic click-through rate (percent) per position bucket, used
 * as the baseline a query must clearly underperform to count as an opportunity.
 */
const EXPECTED_CTR_BY_POSITION: Array<{ maxPosition: number; ctr: number }> = [
	{ maxPosition: 6, ctr: 4.5 },
	{ maxPosition: 8, ctr: 3 },
	{ maxPosition: 10, ctr: 2.2 },
	{ maxPosition: 12, ctr: 1.6 },
	{ maxPosition: OPPORTUNITY_MAX_POSITION, ctr: 1.2 }
];

/**
 * Expected click-through rate for an average result at the given position.
 *
 * @param position - Average query position.
 * @return Expected click-through rate from zero to one hundred.
 */
const getExpectedCtrForPosition = ( position: number ): number =>
	EXPECTED_CTR_BY_POSITION.find(
		( bucket ) => bucket.maxPosition >= position
	)?.ctr ?? 0;

/**
 * Minimum impressions before a low click-through rate is a reliable signal
 * rather than noise, scaled to the selected number of days.
 *
 * @param daysInRange - Days in the selected date range.
 * @return Minimum impressions for the range.
 */
const getOpportunityMinImpressions = ( daysInRange: number ): number =>
	Math.max(
		OPPORTUNITY_FLOOR_IMPRESSIONS,
		OPPORTUNITY_IMPRESSIONS_PER_DAY * daysInRange
	);

/**
 * Calculates a query's click-through rate as a percentage.
 *
 * @param row - Search query metrics.
 * @return Click-through rate from zero to one hundred.
 */
export const getQueryCtr = ( row: SearchQueryRow ): number => {
	if ( 0 >= row.impressions ) {
		return 0;
	}

	return ( row.clicks / row.impressions ) * 100;
};

/**
 * Finds the highest-impression query with meaningful ranking potential and a
 * click-through rate clearly below what its position should earn.
 *
 * @param rows        - Search query rows.
 * @param daysInRange - Days in the selected date range.
 * @return Best opportunity row, or null when no row meets the criteria.
 */
export const findSearchOpportunity = (
	rows: SearchQueryRow[],
	daysInRange: number
): SearchQueryRow | null => {
	const minImpressions = getOpportunityMinImpressions( daysInRange );
	const opportunities = rows.filter( ( row ) => {
		const ctr = getQueryCtr( row );
		const maxCtr = OPPORTUNITY_CTR_FACTOR * getExpectedCtrForPosition( row.position );

		return minImpressions <= row.impressions &&
			maxCtr >= ctr &&
			OPPORTUNITY_MIN_POSITION <= row.position &&
			OPPORTUNITY_MAX_POSITION >= row.position;
	});

	return opportunities.sort(
		( first, second ) => second.impressions - first.impressions
	)[ 0 ] ?? null;
};

/**
 * Converts a click count to a percentage of the highest row for the inline bar.
 *
 * @param clicks    - Row click count.
 * @param maxClicks - Highest click count in the data set.
 * @return Width percentage from zero to one hundred.
 */
export const getSearchQueryBarWidth = (
	clicks: number,
	maxClicks: number
): number => {
	if ( 0 >= maxClicks ) {
		return 0;
	}

	return Math.min( 100, Math.max( 0, ( clicks / maxClicks ) * 100 ) );
};
