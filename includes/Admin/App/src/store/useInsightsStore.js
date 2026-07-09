import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	differenceInCalendarDays,
	differenceInCalendarISOWeeks,
	differenceInCalendarMonths,
	parseISO
} from 'date-fns';

// Valid grouping intervals that can be selected from the UI. The backend
// additionally supports 'hour' and 'year', but those are only reachable
// through 'auto' (very short ranges, multi-year ranges) to keep the
// segmented control in the popover focused on the common buckets.
const VALID_GROUP_BY = [ 'auto', 'day', 'week', 'month' ];

/**
 * Whether a grouping interval produces a drawable chart for a date range.
 *
 * Buckets are counted the way the backend groups them in
 * get_insights_date_modifiers(): calendar days, ISO weeks ('%x-%v') and
 * calendar months. A range that spans fewer than two buckets (e.g. 'month'
 * with a 7-day range) collapses the line chart into a single point, so
 * callers should fall back to 'auto' in that case.
 *
 * @param {string} groupBy   - Selected interval ('auto', 'day', 'week', 'month').
 * @param {string} startDate - Range start (yyyy-MM-dd).
 * @param {string} endDate   - Range end (yyyy-MM-dd).
 * @return {boolean} True when the interval fits the range.
 */
export const groupByFitsRange = ( groupBy, startDate, endDate ) => {
	if ( 'auto' === groupBy || ! startDate || ! endDate ) {
		return true;
	}

	const start = parseISO( startDate );
	const end = parseISO( endDate );

	let buckets;
	switch ( groupBy ) {
		case 'week':
			buckets = differenceInCalendarISOWeeks( end, start ) + 1;
			break;
		case 'month':
			buckets = differenceInCalendarMonths( end, start ) + 1;
			break;
		default:
			buckets = differenceInCalendarDays( end, start ) + 1;
	}

	return 2 <= buckets;
};

export const useInsightsStore = create(
	persist(
		( set, get ) => ({
			metrics: [ 'visitors', 'pageviews' ],
			groupBy: 'auto',
			loaded: false,
			getMetrics: () => {
				if ( get().loaded ) {
					return get().metrics;
				}

				let metrics = get().metrics || [ 'visitors', 'pageviews' ];

				//temporarily remove conversions from localstorage until the query has been fixed
				metrics = metrics.filter( ( metric ) => 'conversions' !== metric );

				set({ metrics, loaded: true });
				return metrics;
			},
			setMetrics: ( metrics ) => {
				set({ metrics });
			},
			setGroupBy: ( groupBy ) => {

				// Guard against unknown values so a stale localStorage entry
				// or accidental call site cannot break the chart query.
				set({ groupBy: VALID_GROUP_BY.includes( groupBy ) ? groupBy : 'auto' });
			}
		}),
		{
			name: 'burst-insights-storage',
			partialize: ( state ) => ({
				metrics: state.metrics,
				groupBy: state.groupBy
			}),
			onRehydrateStorage: () => ( state ) => {
				if ( ! state ) {
					return;
				}

				// On rehydration, filter out conversions if they exist.
				if ( state.metrics ) {
					state.metrics = state.metrics.filter(
						( metric ) => 'conversions' !== metric
					);
				}

				// Migrate older persisted state that predates the groupBy field
				// or contains a value that is no longer accepted.
				if ( ! VALID_GROUP_BY.includes( state.groupBy ) ) {
					state.groupBy = 'auto';
				}
			}
		}
	)
);
