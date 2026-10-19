import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';

/**
 * The change in page weight against the preceding period.
 */
export type WeightChange = {

	/** Signed percentage, ready to render. */
	label: string;

	/** Whether the change is the good direction, which for weight is down. */
	isImprovement: boolean;
};

/**
 * Format the change against the previous period.
 *
 * Page weight is a metric where down is good, so a fall is the positive case.
 * Returns null when either period has nothing measured, since a change against
 * zero says nothing. Previous is null when no weight is on record for the end of
 * that period, which is the normal state until the history table has filled.
 *
 * @param current  - Average bytes per pageview this period.
 * @param previous - The same average over the preceding period, or null.
 * @return The change, or null when there is nothing to compare against.
 */
export const getWeightChange = ( current: number, previous: number | null ): WeightChange | null => {
	if ( null === previous || 0 >= previous || 0 >= current ) {
		return null;
	}

	const ratio = ( ( current - previous ) / previous ) * 100;
	return {
		label: `${ 0 < ratio ? '+' : '' }${ formatNumber( ratio, 1, false ) }%`,
		isImprovement: 0 >= ratio
	};
};

/**
 * Render an emissions figure as kg from one kilo up, grams below it, and
 * milligrams below a tenth of a gram.
 *
 * The mg step matters more than it looks: per-pageview figures live well below
 * one gram (the A+ rating band starts at 0.040 g), so with one decimal of
 * grams the best-rated pages would all render as "0 g" and read as unmeasured.
 *
 * @param grams - Emissions in grams CO2e.
 * @return The formatted figure including its unit.
 */
export const formatEmissions = ( grams: number ): string => {
	if ( 1000 <= grams ) {
		return sprintf(

			/* translators: %s is an amount of CO2 equivalent in kilograms. */
			__( '%s kg CO2e', 'burst-statistics' ),
			formatNumber( grams / 1000, 1, false )
		);
	}

	if ( 0.1 > grams ) {
		return sprintf(

			/* translators: %s is an amount of CO2 equivalent in milligrams. */
			__( '%s mg CO2e', 'burst-statistics' ),
			formatNumber( grams * 1000, 0, false )
		);
	}

	return sprintf(

		/* translators: %s is an amount of CO2 equivalent in grams. */
		__( '%s g CO2e', 'burst-statistics' ),
		formatNumber( grams, 1, false )
	);
};
