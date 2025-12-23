import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFiltersStore } from '@/store/useFiltersStore';
import {
	FILTER_CONFIG,
	FILTER_CATEGORIES,
	FILTER_KEYS,
	INITIAL_FILTERS,
	TRAILING_PARAM_KEY,
	type FilterKey,
	type FilterSearchParams,
	type FilterConfig as FilterConfigType
} from '@/config/filterConfig';

// Re-export for convenience.
export {
	FILTER_CONFIG,
	FILTER_CATEGORIES,
	FILTER_KEYS,
	INITIAL_FILTERS,
	TRAILING_PARAM_KEY,
	validateFilterSearch,
	type FilterKey,
	type FilterSearchParams,
	type FilterCategory,
	type FilterConfig
} from '@/config/filterConfig';

// Routes where URL filter sync is enabled.
export const FILTER_ENABLED_ROUTES = [ '/statistics', '/sources', '/sales' ];

/**
 * Check if current route supports URL filter sync.
 *
 * @param pathname - The current route pathname.
 * @return True if filters should sync with URL on this route.
 */
export const isFilterEnabledRoute = ( pathname: string ): boolean => {
	return FILTER_ENABLED_ROUTES.some( ( route ) => pathname.startsWith( route ) );
};

/**
 * Build search params object with trailing param always last.
 * This ensures proper URL parsing when used with hash-based routing.
 *
 * @param params - The search params to build.
 * @return Ordered search params with trailing param last.
 */
const buildSearchParams = (
	params: Record<string, string | undefined>
): Record<string, string> => {
	const result: Record<string, string> = {};

	// Add all params except the trailing one first.
	Object.keys( params ).forEach( ( key ) => {
		if ( key !== TRAILING_PARAM_KEY && params[key] !== undefined ) {
			result[key] = params[key] as string;
		}
	});

	// Always add trailing param last.
	result[TRAILING_PARAM_KEY] = '';

	return result;
};

/**
 * Check if URL has any active filter params.
 *
 * @param searchParams - The current search params from URL.
 * @return True if any filter is set in URL.
 */
const hasUrlFilters = ( searchParams: FilterSearchParams ): boolean => {
	return FILTER_KEYS.some( ( key ) => {
		const value = searchParams[key];
		return value && '' !== value;
	});
};

/**
 * Hook to manage filters using TanStack Router's search params.
 * Uses Zustand persist for session storage, router for runtime state.
 * URL sync only works on specific routes: /statistics, /sources, /sales.
 *
 * @return Filter state and actions.
 */
export const useFilters = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const hasInitialized = useRef( false );

	// Check if current route supports URL filter sync.
	const isFilterRoute = isFilterEnabledRoute( location.pathname );

	// Get persistence functions from Zustand store.
	const favorites = useFiltersStore( ( state ) => state.favorites );
	const addToFavorites = useFiltersStore( ( state ) => state.addToFavorites );
	const removeFromFavorites = useFiltersStore(
		( state ) => state.removeFromFavorites
	);
	const toggleFavorite = useFiltersStore( ( state ) => state.toggleFavorite );
	const isFavorite = useFiltersStore( ( state ) => state.isFavorite );

	// Saved filters persistence (Zustand with persist middleware).
	const setSavedFilters = useFiltersStore( ( state ) => state.setSavedFilters );
	const getSavedFilters = useFiltersStore( ( state ) => state.getSavedFilters );
	const clearSavedFilters = useFiltersStore(
		( state ) => state.clearSavedFilters
	);

	// Get current filter values from router search params (runtime source of truth).
	const searchParams = useSearch({ strict: false }) as FilterSearchParams;

	// Compute active filters (non-empty values).
	// Only populated on filter-enabled routes.
	const filters = useMemo( () => {
		const result: FilterSearchParams = { ...INITIAL_FILTERS };

		// Only read from URL on filter-enabled routes.
		if ( isFilterRoute ) {
			FILTER_KEYS.forEach( ( key ) => {
				if ( searchParams[key]) {
					result[key] = searchParams[key];
				}
			});
		}

		return result;
	}, [ searchParams, isFilterRoute ]);

	// Initialize: restore from Zustand if URL has no filters (only on filter-enabled routes).
	useEffect( () => {
		if ( ! isFilterRoute || hasInitialized.current ) {
			return;
		}
		hasInitialized.current = true;

		// If URL already has filters, save them to Zustand and use those.
		if ( hasUrlFilters( searchParams ) ) {
			setSavedFilters( searchParams );
			return;
		}

		// Load from Zustand store and apply to URL.
		const storedFilters = getSavedFilters();
		const hasStoredFilters = 0 < Object.keys( storedFilters ).length;

		if ( hasStoredFilters ) {
			const newSearch = buildSearchParams( storedFilters );
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: newSearch as any,
				replace: true // Replace to not create extra history entry on init.
			});
		}
	}, [ isFilterRoute ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Sync filters to Zustand whenever they change (for session persistence).
	// Only sync on filter-enabled routes.
	useEffect( () => {
		if ( isFilterRoute && hasInitialized.current ) {
			setSavedFilters( filters );
		}
	}, [ filters, setSavedFilters, isFilterRoute ]);

	/**
	 * Set a filter value and update URL.
	 * Only works on filter-enabled routes.
	 *
	 * @param filter - The filter key to update.
	 * @param value  - The value to set for the filter.
	 */
	const setFilters = useCallback(
		( filter: string, value: string ) => {
			if ( 'string' !== typeof filter || ! filter.length ) {
				return;
			}

			// Only update on filter-enabled routes.
			if ( ! isFilterRoute ) {
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const searchUpdater = ( prev: any ) => {
				const newParams = { ...prev };

				// Remove trailing param so we can add it last.
				delete newParams[TRAILING_PARAM_KEY];

				if ( '' === value || null === value || value === undefined ) {
					delete newParams[filter];
				} else {
					newParams[filter] = value;
				}

				return buildSearchParams( newParams );
			};

			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: searchUpdater as any,
				replace: false // Create history entry for back button.
			});
		},
		[ navigate, isFilterRoute ]
	);

	/**
	 * Clear a specific filter.
	 * Only works on filter-enabled routes.
	 *
	 * @param filter - The filter key to clear.
	 */
	const deleteFilter = useCallback(
		( filter: string ) => {

			// Only update on filter-enabled routes.
			if ( ! isFilterRoute ) {
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const searchUpdater = ( prev: any ) => {
				const newParams = { ...prev };

				// Remove trailing param so we can add it last.
				delete newParams[TRAILING_PARAM_KEY];
				delete newParams[filter];

				return buildSearchParams( newParams );
			};

			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: searchUpdater as any,
				replace: false
			});
		},
		[ navigate, isFilterRoute ]
	);

	/**
	 * Clear all filters.
	 * Clears both URL and persisted storage.
	 */
	const clearAllFilters = useCallback( () => {

		// Clear Zustand persisted filters.
		clearSavedFilters();

		// Clear URL on filter-enabled routes.
		if ( isFilterRoute ) {
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: ( () => ({}) ) as any,
				replace: false
			});
		}
	}, [ navigate, clearSavedFilters, isFilterRoute ]);

	/**
	 * Get active filters (non-empty values).
	 *
	 * @return Object containing only filters with values.
	 */
	const getActiveFilters = useCallback( (): FilterSearchParams => {
		const active: FilterSearchParams = {};
		FILTER_KEYS.forEach( ( key ) => {
			const value = filters[key];
			if ( value && '' !== value ) {
				active[key] = value;
			}
		});
		return active;
	}, [ filters ]);

	/**
	 * Check if any filters are active.
	 *
	 * @return True if any filter has a value.
	 */
	const hasActiveFilters = useMemo( (): boolean => {
		return FILTER_KEYS.some( ( key ) => {
			const value = filters[key];
			return value && '' !== value;
		});
	}, [ filters ]);

	/**
	 * Get filters organized by category.
	 *
	 * @return Object with categories as keys and filter arrays as values.
	 */
	const getFiltersByCategory = useCallback( () => {
		const categorizedFilters: Record<
			string,
			Array<{ key: string } & FilterConfigType>
		> = {
			content: [],
			sources: [],
			behavior: [],
			location: []
		};

		// Group filters by category.
		(
			Object.entries( FILTER_CONFIG ) as Array<[ FilterKey, FilterConfigType ]>
		).forEach( ([ filterKey, config ]) => {
			if ( config.category && categorizedFilters[config.category]) {
				categorizedFilters[config.category].push({
					key: filterKey,
					...config
				});
			}
		});

		return categorizedFilters;
	}, []);

	/**
	 * Get favorite filters with their configuration.
	 *
	 * @return Array of favorite filter objects.
	 */
	const getFavoriteFilters = useCallback( () => {
		return favorites
			.filter( ( filterKey: string ) => FILTER_CONFIG[filterKey])
			.map( ( filterKey: string ) => ({
				key: filterKey,
				...FILTER_CONFIG[filterKey]
			}) );
	}, [ favorites ]);

	return {

		// State.
		filters,
		filtersConf: FILTER_CONFIG,
		filterCategories: FILTER_CATEGORIES,
		favorites,
		isFilterRoute,

		// Filter actions.
		setFilters,
		deleteFilter,
		clearAllFilters,

		// Filter getters.
		getActiveFilters,
		hasActiveFilters,
		getFiltersByCategory,

		// Favorites actions.
		addToFavorites,
		removeFromFavorites,
		toggleFavorite,
		isFavorite,
		getFavoriteFilters
	};
};

export default useFilters;
