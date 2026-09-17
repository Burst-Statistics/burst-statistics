import { useDate } from '@/store/useDateStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useDataTableStore } from '@/store/useDataTableStore';
import { useInsightsStore } from '@/store/useInsightsStore';
import { useCompareStore, COMPARE_MODES } from '@/store/useCompareStore';
import useSourcesStore from '@/store/useSourcesStore';
import { usePersistedTabsStore } from '@/store/useTabsStore';
import { useABTestStore } from '@/store/useABTestStore';
import { useSalesChartStore } from '@/store/useSalesChartStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { DEFAULT_FAVORITES } from '@/config/filterConfig';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

const SNAPSHOT_KEY = 'burst_pre_tour_snapshot';

const ALL_STORAGE_KEYS = [
	'burst-filters-storage',
	'burst-date-storage',
	'burst-datatable-storage',
	'burst-insights-storage',
	'burst-compare-storage',
	'burst-sources-store',
	'burst-tabs-storage',
	'burst-sales-chart-storage',
	'burst-subscriptions-storage',
	'burst-ab-test-storage',
	'burst-geo-storage',
	'burst-tasks-storage',
	'burst_chat_conversations_v1',
	'burst_chat_selected_model'
];

/**
 * Snapshots the user's current localStorage before the tour begins.
 * Stored in sessionStorage so the user's real setup is preserved across
 * tab switches or page navigations while in the tour.
 */
export const snapshotPreTourLocalStorage = () => {
	if ( 'undefined' === typeof window ) {
		return;
	}

	try {

		// Only take snapshot if one doesn't exist yet for this tour session
		if ( sessionStorage.getItem( SNAPSHOT_KEY ) ) {
			return;
		}

		const snapshot: Record<string, string | null> = {};
		ALL_STORAGE_KEYS.forEach( ( key ) => {
			snapshot[ key ] = localStorage.getItem( key );
		});

		sessionStorage.setItem( SNAPSHOT_KEY, JSON.stringify( snapshot ) );
	} catch ( e ) {
		console.debug( 'Failed to snapshot pre-tour localStorage:', e );
	}
};

/**
 * Restores the user's original localStorage exactly as it was before the tour.
 * Any keys created or altered during the tour are wiped, and the user's real
 * customized settings, filters, columns, and date ranges are restored intact.
 */
export const restorePreTourLocalStorage = () => {
	if ( 'undefined' === typeof window ) {
		return;
	}

	try {
		const raw = sessionStorage.getItem( SNAPSHOT_KEY );
		if ( ! raw ) {
			return;
		}

		const snapshot = JSON.parse( raw ) as Record<string, string | null>;

		ALL_STORAGE_KEYS.forEach( ( key ) => {
			const originalVal = snapshot[ key ];
			if ( 'string' === typeof originalVal ) {
				localStorage.setItem( key, originalVal );
			} else {
				localStorage.removeItem( key );
			}
		});

		sessionStorage.removeItem( SNAPSHOT_KEY );
	} catch ( e ) {
		console.debug( 'Failed to restore pre-tour localStorage:', e );
	}
};

/**
 * Resets all dashboard stores, filters, date range, and chart configurations
 * to their default clean state for the interactive tour.
 */
export const resetDashboardToTourDefaults = () => {
	if ( 'undefined' === typeof window ) {
		return;
	}

	// 2. Reset Date Range to clean 'last-7-days'
	try {
		const defaultStartDate = format(
			startOfDay( subDays( new Date(), 7 ) ),
			'yyyy-MM-dd'
		);
		const defaultEndDate = format(
			endOfDay( subDays( new Date(), 1 ) ),
			'yyyy-MM-dd'
		);
		useDate.setState({
			range: 'last-7-days',
			startDate: defaultStartDate,
			endDate: defaultEndDate
		});
	} catch ( e ) {
		console.debug( 'Tour date reset failed:', e );
	}

	// 3. Reset Filters Store
	try {
		useFiltersStore.setState({
			savedFilters: {},
			favorites: DEFAULT_FAVORITES
		});
	} catch ( e ) {
		console.debug( 'Tour filters reset failed:', e );
	}

	// 4. Reset DataTable store (visible columns, sorting, search, variations, rows)
	try {
		useDataTableStore.setState({
			selectedConfigs: {},
			columns: {
				campaigns: [ 'campaign', 'visitors', 'conversions', 'conversion_rate' ]
			},
			sortConfigs: {},
			parameterVariations: {},
			rowsPerPage: {}
		});
	} catch ( e ) {
		console.debug( 'Tour data table reset failed:', e );
	}

	// 5. Reset Insights Chart
	try {
		useInsightsStore.setState({
			metrics: [ 'visitors', 'pageviews' ],
			groupBy: 'auto',
			loaded: true
		});
	} catch ( e ) {
		console.debug( 'Tour insights reset failed:', e );
	}

	// 6. Reset Compare Store
	try {
		useCompareStore.setState({
			compareMode: COMPARE_MODES.PREVIOUS_PERIOD
		});
	} catch ( e ) {
		console.debug( 'Tour compare reset failed:', e );
	}

	// 7. Reset Sources Store
	try {
		useSourcesStore.setState({
			groupBy: 'auto',
			selectedMetric: 'visitors'
		});
	} catch ( e ) {
		console.debug( 'Tour sources reset failed:', e );
	}

	// 8. Reset Sub-Navigation Tabs
	try {
		usePersistedTabsStore.setState({
			groups: {}
		});
	} catch ( e ) {
		console.debug( 'Tour tabs reset failed:', e );
	}

	// 9. Reset Auxiliary stores (Sales, Subscriptions, A/B testing)
	try {
		useSalesChartStore.setState({
			chartMode: 'revenue',
			showComparison: false,
			showForecast: false
		});
		useSubscriptionsStore.setState({
			chartMode: 'revenue',
			showComparison: false,
			showForecast: false,
			distributionView: 'gateways',
			retentionProductId: 'all'
		});
		useABTestStore.setState({
			testVariations: {}
		});
	} catch ( e ) {
		console.debug( 'Tour auxiliary stores reset failed:', e );
	}
};
