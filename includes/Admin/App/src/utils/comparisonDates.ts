import { __ } from '@wordpress/i18n';
import { COMPARE_MODES } from '@/store/useCompareStore';
import { parseISO, subYears, differenceInDays, format } from 'date-fns';

export interface ComparisonDates {
	compareStart: string;
	compareEnd: string;
}

/**
 * Calculate comparison start and end dates as ISO strings based on the
 * selected compare mode and the current period start / end dates.
 *
 * @param {string} startDate   - Current period start in YYYY-MM-DD.
 * @param {string} endDate     - Current period end in YYYY-MM-DD.
 * @param {string} compareMode - One of the COMPARE_MODES values.
 * @return {ComparisonDates} ISO date strings for the comparison window.
 */
export function getComparisonDates(
	startDate: string,
	endDate: string,
	compareMode: string = COMPARE_MODES.PREVIOUS_PERIOD
): ComparisonDates {
	const start = parseISO( startDate );
	const end = parseISO( endDate );

	if ( COMPARE_MODES.YEAR_OVER_YEAR === compareMode ) {
		return {
			compareStart: format( subYears( start, 1 ), 'yyyy-MM-dd' ),
			compareEnd: format( subYears( end, 1 ), 'yyyy-MM-dd' )
		};
	}

	// Default: previous period of equal length.
	const days = differenceInDays( end, start ) + 1;
	const prevEnd = new Date( start );
	prevEnd.setDate( prevEnd.getDate() - 1 );
	const prevStart = new Date( prevEnd );
	prevStart.setDate( prevStart.getDate() - ( days - 1 ) );

	return {
		compareStart: format( prevStart, 'yyyy-MM-dd' ),
		compareEnd: format( prevEnd, 'yyyy-MM-dd' )
	};
}

export interface MetricItem {
	title: string;
	subtitle: string;
	value: string | number;
	exactValue: string | number;
	change: string;
	changeStatus: string;
	communityMetricKey?: string;
	communityMetricValue?: number | string;
	[key: string]: unknown;
}

export type CompareData = Record<string, MetricItem>;

/**
 * Generates initial placeholder empty comparison data structure.
 *
 * @param {boolean} includePageMetrics - Whether to include per-page specific metrics.
 * @return {CompareData} Empty comparison data map.
 */
export function getEmptyCompareData( includePageMetrics: boolean = false ): CompareData {
	const metrics: Record<string, string> = {
		pageviews: __( 'Pageviews', 'burst-statistics' ),
		sessions: __( 'Sessions', 'burst-statistics' ),
		visitors: __( 'Visitors', 'burst-statistics' )
	};
	if ( includePageMetrics ) {
		metrics.reading_engagement_score = __( 'Engagement score', 'burst-statistics' );
	}
	metrics.bounce_rate = __( 'Bounce rate', 'burst-statistics' );
	if ( includePageMetrics ) {
		metrics.conversions = __( 'Conversions', 'burst-statistics' );
	} else {
		metrics.avg_time_on_page = __( 'Avg. time on page', 'burst-statistics' );
	}

	const emptyData: CompareData = {};
	Object.keys( metrics ).forEach( ( key ) => {
		emptyData[ key ] = {
			title: metrics[ key ],
			subtitle: '-',
			value: '-',
			exactValue: '-',
			change: '-',
			changeStatus: ''
		};
	});
	return emptyData;
}
