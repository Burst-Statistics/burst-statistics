import { __, sprintf } from '@wordpress/i18n';
import { formatPercentage } from '@/utils/formatting';

// Changes smaller than this, in percent, read as steady.
const STEADY_THRESHOLD = 5;

interface GoalDetailTitleInput {
	conversions: number;
	conversionsPrevious: number;

	// Single goal only: last conversion when the goal is not counting. The notice covers it, so no title.
	notCountingSince?: number | null;

	// All goals only: the goal that added the most conversions.
	leadingGoal?: string;
}

interface GoalGrowthRow {
	title: string;
	conversions: number;
	conversionsPrevious: number;
}

/**
 * The goal that added the most conversions compared to the previous period.
 *
 * @param {GoalGrowthRow[]} rows Active goals with their conversions.
 * @return {string} Its title, or '' when no goal grew.
 */
export const getLeadingGoal = ( rows: GoalGrowthRow[]): string => {
	let leading = '';
	let largestGrowth = 0;
	rows.forEach( ( row ) => {
		const growth = row.conversions - row.conversionsPrevious;
		if ( growth > largestGrowth ) {
			largestGrowth = growth;
			leading = row.title;
		}
	});
	return leading;
};

/**
 * Title for a rise in conversions, naming the goal behind it when there is one.
 *
 * @param {string} change      Formatted change, e.g. 24%.
 * @param {string} leadingGoal Title of the goal that grew most, or ''.
 * @return {string} The title.
 */
const getUpTitle = ( change: string, leadingGoal: string ): string => {
	if ( leadingGoal ) {

		/* translators: 1: percentage, e.g. 24%, 2: goal title. */
		return sprintf( __( 'Conversions up %1$s, led by %2$s', 'burst-statistics' ), change, leadingGoal );
	}

	/* translators: %s: percentage, e.g. 24%. */
	return sprintf( __( 'Conversions up %s', 'burst-statistics' ), change );
};

/**
 * Title for a change in conversions: up, down or steady.
 *
 * @param {number} change      Change in percent, signed.
 * @param {string} leadingGoal Title of the goal that grew most, or ''.
 * @return {string} The title.
 */
const getChangeTitle = ( change: number, leadingGoal: string ): string => {
	const formattedChange = formatPercentage( Math.abs( change ), 0 );

	if ( STEADY_THRESHOLD <= change ) {
		return getUpTitle( formattedChange, leadingGoal );
	}

	if ( -STEADY_THRESHOLD >= change ) {

		/* translators: %s: percentage, e.g. 24%. */
		return sprintf( __( 'Conversions down %s', 'burst-statistics' ), formattedChange );
	}

	return __( 'Conversions steady compared to the previous period', 'burst-statistics' );
};

/**
 * Conclusion-first title of the goal detail: what happened to conversions.
 *
 * @param {GoalDetailTitleInput} input Conversions in this and the previous period.
 * @return {string} One sentence, or '' when it would only repeat the count.
 */
const getGoalDetailTitle = ({ conversions, conversionsPrevious, notCountingSince = null, leadingGoal = '' }: GoalDetailTitleInput ): string => {

	// The health notice already says the goal stopped counting.
	if ( null !== notCountingSince ) {
		return '';
	}

	if ( 0 === conversions ) {
		return __( 'No conversions yet in this period', 'burst-statistics' );
	}

	// Without a previous period there is no change to report; the count sits right below.
	if ( 0 === conversionsPrevious ) {
		return '';
	}

	return getChangeTitle( ( conversions - conversionsPrevious ) / conversionsPrevious * 100, leadingGoal );
};

export default getGoalDetailTitle;
