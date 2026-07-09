import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Valid grouping intervals that can be selected from the UI. The backend
// additionally supports 'hour' and 'year', but those are only reachable
// through 'auto' (very short ranges, multi-year ranges) to keep the
// segmented control in the popover focused on the common buckets.
const VALID_GROUP_BY = [ 'auto', 'day', 'week', 'month' ];

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
