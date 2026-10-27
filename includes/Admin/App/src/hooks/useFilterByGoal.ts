import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TRAILING_PARAM_KEY } from '@/config/filterConfig';
import { useInsightsStore } from '@/store/useInsightsStore';
import { useFiltersStore } from '@/store/useFiltersStore';

/**
 * Opens the insights page with the goal filter applied.
 *
 * The goals page and the dashboard are not filter routes, so setFilters() from
 * useFilters() is a no-op there: the filter travels along as a search param on
 * the navigation instead. The goal is added to the filters the user last had
 * applied, so it narrows them instead of replacing them, and it wins over a
 * pinned goal: the user asked for this one.
 *
 * @return {Function} Called with a goal id to show that goal's data on insights.
 */
const useFilterByGoal = (): ( ( goalId: number | string ) => void ) => {
	const navigate = useNavigate();

	return useCallback(
		( goalId: number | string ) => {

			// Read the stores at click time: subscribing would re-render every
			// filter cell on each filter or metric change.
			const { getMetrics, setMetrics } = useInsightsStore.getState();
			const metrics = getMetrics();

			// Without conversions on the graph a goal filter has nothing to show.
			if ( ! metrics.includes( 'conversions' ) ) {
				setMetrics([ ...metrics, 'conversions' ]);
			}

			// Start from the filters last applied on a filter route, as the menu
			// links do. 'all' is the dashboard goal selector showing every goal at
			// once: there is no single goal to add, so those filters stay as they are.
			const search: Record<string, string> = { ...useFiltersStore.getState().savedFilters, [TRAILING_PARAM_KEY]: '' };
			const overridePinned: string[] = [];
			if ( 'all' !== String( goalId ) ) {
				search.goal_id = String( goalId );
				overridePinned.push( 'goal_id' );
			}

			navigate({ to: '/statistics', search, state: { overridePinned } });
		},
		[ navigate ]
	);
};

export default useFilterByGoal;
