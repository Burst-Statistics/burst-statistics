// hooks/useFilters.ts - Blijft de main entry point
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
import { useWizardStore } from '@/store/reports/useWizardStore';

export const FILTER_ENABLED_ROUTES = [ '/statistics', '/sources', '/sales' ];

export const isFilterEnabledRoute = ( pathname: string ): boolean => {
	return FILTER_ENABLED_ROUTES.some( ( route ) => pathname.startsWith( route ) );
};

const buildSearchParams = (
	params: Record<string, string | undefined>
): Record<string, string> => {
	const result: Record<string, string> = {};

	Object.keys( params ).forEach( ( key ) => {
		if ( key !== TRAILING_PARAM_KEY && params[key] !== undefined ) {
			result[key] = params[key] as string;
		}
	});

	result[TRAILING_PARAM_KEY] = '';
	return result;
};

const hasUrlFilters = ( searchParams: FilterSearchParams ): boolean => {
	return FILTER_KEYS.some( ( key ) => {
		const value = searchParams[key];
		return value && '' !== value;
	});
};

/**
 * Hook to manage filters.
 * - Without reportBlockIndex: uses URL params (for /statistics, /sources, /sales)
 * - With reportBlockIndex: uses wizard store (for report blocks)
 */
export const useFilters = ( reportBlockIndex?: number ) => {
	const updateReportFilters = useWizardStore( ( state ) => state.updateFilters );
	const getReportFilters = useWizardStore( ( state ) => state.getFilters );

	const navigate = useNavigate();
	const location = useLocation();
	const hasInitialized = useRef( false );

	const isFilterRoute = isFilterEnabledRoute( location.pathname );
	const isBlockMode = 'number' === typeof reportBlockIndex;

	// Shared favorites logic (always from main store)
	const favorites = useFiltersStore( ( state ) => state.favorites );
	const addToFavorites = useFiltersStore( ( state ) => state.addToFavorites );
	const removeFromFavorites = useFiltersStore( ( state ) => state.removeFromFavorites );
	const toggleFavorite = useFiltersStore( ( state ) => state.toggleFavorite );
	const isFavorite = useFiltersStore( ( state ) => state.isFavorite );

	// URL-specific store access
	const setSavedFilters = useFiltersStore( ( state ) => state.setSavedFilters );
	const getSavedFilters = useFiltersStore( ( state ) => state.getSavedFilters );
	const clearSavedFilters = useFiltersStore( ( state ) => state.clearSavedFilters );
	const wizardContent = useWizardStore( ( state ) => state.wizard.content );

	// Get current filter values from appropriate source
	const searchParams = useSearch({ strict: false }) as FilterSearchParams;

	const filters = useMemo( () => {

		// Block mode: get from wizard store
		if ( isBlockMode ) {
			return getReportFilters( reportBlockIndex ) || INITIAL_FILTERS;
		}

		// URL mode: get from URL params (only on filter routes)
		const result: FilterSearchParams = { ...INITIAL_FILTERS };
		if ( isFilterRoute ) {
			FILTER_KEYS.forEach( ( key ) => {
				if ( searchParams[key]) {
					result[key] = searchParams[key];
				}
			});
		}
		return result;
		// eslint-disable-next-line
	}, [ searchParams, isFilterRoute, isBlockMode, reportBlockIndex, getReportFilters, wizardContent ]);

	// Initialize URL filters (only in URL mode)
	useEffect( () => {
		if ( isBlockMode || ! isFilterRoute || hasInitialized.current ) {
			return;
		}

		hasInitialized.current = true;

		if ( hasUrlFilters( searchParams ) ) {
			setSavedFilters( searchParams );
			return;
		}

		const storedFilters = getSavedFilters();
		const hasStoredFilters = 0 < Object.keys( storedFilters ).length;

		if ( hasStoredFilters ) {
			const newSearch = buildSearchParams( storedFilters );
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: newSearch as any,
				replace: true
			});
		}
	}, [ isFilterRoute, isBlockMode ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Sync filters to appropriate store (removed - happens in setFilters instead)
	// Block mode filters are managed directly via setFilters/deleteFilter/clearAllFilters

	// Only sync URL filters to localStorage
	useEffect( () => {
		if ( isBlockMode || ! hasInitialized.current || ! isFilterRoute ) {
			return;
		}

		setSavedFilters( filters );
	}, [ filters, isBlockMode, isFilterRoute, setSavedFilters ]);

	/**
	 * Set a filter value
	 */
	const setFilters = useCallback(
		( filter: string, value: string ) => {
			if ( ! filter.length ) {
				return;
			}

			// Block mode: update wizard store
			if ( isBlockMode ) {
				const currentFilters = getReportFilters( reportBlockIndex ) || {};
				const newFilters = { ...currentFilters };

				if ( '' === value || null === value || value === undefined ) {
					delete newFilters[filter];
				} else {
					newFilters[filter] = value;
				}

				updateReportFilters( reportBlockIndex, newFilters );
				return;
			}

			// URL mode: update URL params (only on filter routes)
			if ( ! isFilterRoute ) {
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const searchUpdater = ( prev: any ) => {
				const newParams = { ...prev };
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
				replace: false
			});
		},
		[ navigate, isFilterRoute, isBlockMode, reportBlockIndex, getReportFilters, updateReportFilters ]
	);

	/**
	 * Clear a specific filter
	 */
	const deleteFilter = useCallback(
		( filter: string ) => {

			// Block mode: update wizard store
			if ( isBlockMode ) {
				const currentFilters = getReportFilters( reportBlockIndex ) || {};
				const newFilters = { ...currentFilters };
				delete newFilters[filter];
				updateReportFilters( reportBlockIndex, newFilters );
				return;
			}

			// URL mode: update URL params (only on filter routes)
			if ( ! isFilterRoute ) {
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const searchUpdater = ( prev: any ) => {
				const newParams = { ...prev };
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
		[ navigate, isFilterRoute, isBlockMode, reportBlockIndex, getReportFilters, updateReportFilters ]
	);

	/**
	 * Clear all filters
	 */
	const clearAllFilters = useCallback( () => {

		// Block mode: clear from wizard store
		if ( isBlockMode ) {
			updateReportFilters( reportBlockIndex, {});
			return;
		}

		// URL mode: clear from both stores
		clearSavedFilters();
		if ( isFilterRoute ) {
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: ( () => ({}) ) as any,
				replace: false
			});
		}
	}, [ navigate, clearSavedFilters, isFilterRoute, isBlockMode, reportBlockIndex, updateReportFilters ]);

	/**
	 * Get active filters (non-empty values)
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
	 * Check if any filters are active
	 */
	const hasActiveFilters = useMemo( (): boolean => {
		return FILTER_KEYS.some( ( key ) => {
			const value = filters[key];
			return value && '' !== value;
		});
	}, [ filters ]);

	/**
	 * Get filters organized by category
	 */
	const getFiltersByCategory = useCallback( () => {
		const categorizedFilters: Record<string, Array<{ key: string } & FilterConfigType>> = {
			content: [],
			sources: [],
			behavior: [],
			location: []
		};

		( Object.entries( FILTER_CONFIG ) as Array<[FilterKey, FilterConfigType]> ).forEach( ([ filterKey, config ]) => {
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
	 * Get favorite filters with their configuration
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

		// State
		filters,
		filtersConf: FILTER_CONFIG,
		filterCategories: FILTER_CATEGORIES,
		favorites,
		isFilterRoute: isBlockMode ? false : isFilterRoute, // Block mode never uses routes

		// Filter actions
		setFilters,
		deleteFilter,
		clearAllFilters,

		// Filter getters
		getActiveFilters,
		hasActiveFilters,
		getFiltersByCategory,

		// Favorites actions (shared across all contexts)
		addToFavorites,
		removeFromFavorites,
		toggleFavorite,
		isFavorite,
		getFavoriteFilters
	};
};

export default useFilters;

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
