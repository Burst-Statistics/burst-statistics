import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { DEFAULT_FAVORITES, FILTER_KEYS } from '@/config/filterConfig';

// Re-export filter configuration and types from filterConfig.
// This maintains backwards compatibility for components that import from here.
export {
	FILTER_CONFIG,
	FILTER_CATEGORIES,
	FILTER_KEYS,
	INITIAL_FILTERS,
	TRAILING_PARAM_KEY,
	validateFilterSearch,
	DEFAULT_FAVORITES
} from '@/config/filterConfig';

/**
 * Zustand store for managing filter state and favorites with persistence.
 * Filter values are persisted to localStorage for session restoration.
 * The actual runtime filter state comes from TanStack Router search params.
 */
export const useFiltersStore = create(
	persist(
		( set, get ) => ({

			// User's favorite filters.
			favorites: DEFAULT_FAVORITES,

			// Persisted filter values (for session restore when no URL filters).
			savedFilters: {},

			/**
			 * Save current filters to persistent storage.
			 * Called when filters change via the router.
			 *
			 * @param {Object} filters - The current filter values.
			 */
			setSavedFilters: ( filters ) => {
				set( ( state ) =>
					produce( state, ( draft ) => {
						const active = {};
						FILTER_KEYS.forEach( ( key ) => {
							const value = filters[key];
							if ( value && '' !== value ) {
								active[key] = value;
							}
						});
						draft.savedFilters = active;
					})
				);
			},

			/**
			 * Get saved filters for session restore.
			 *
			 * @return {Object} The saved filter values.
			 */
			getSavedFilters: () => {
				return get().savedFilters || {};
			},

			/**
			 * Clear saved filters.
			 */
			clearSavedFilters: () => {
				set( ( state ) =>
					produce( state, ( draft ) => {
						draft.savedFilters = {};
					})
				);
			},

			/**
			 * Add a filter to favorites.
			 *
			 * @param {string} filterKey - The filter key to add to favorites.
			 */
			addToFavorites: ( filterKey ) => {
				set( ( state ) =>
					produce( state, ( draft ) => {
						if ( ! draft.favorites.includes( filterKey ) ) {
							draft.favorites.push( filterKey );
						}
					})
				);
			},

			/**
			 * Remove a filter from favorites.
			 *
			 * @param {string} filterKey - The filter key to remove from favorites.
			 */
			removeFromFavorites: ( filterKey ) => {
				set( ( state ) =>
					produce( state, ( draft ) => {
						draft.favorites = draft.favorites.filter(
							( fav ) => fav !== filterKey
						);
					})
				);
			},

			/**
			 * Toggle a filter in favorites.
			 *
			 * @param {string} filterKey - The filter key to toggle in favorites.
			 */
			toggleFavorite: ( filterKey ) => {
				const { favorites } = get();
				if ( favorites.includes( filterKey ) ) {
					get().removeFromFavorites( filterKey );
				} else {
					get().addToFavorites( filterKey );
				}
			},

			/**
			 * Check if a filter is in favorites.
			 *
			 * @param {string} filterKey - The filter key to check.
			 * @return {boolean} True if filter is in favorites.
			 */
			isFavorite: ( filterKey ) => {
				const { favorites } = get();
				return favorites.includes( filterKey );
			}
		}),
		{
			name: 'burst-filters-storage',
			version: 3, // Bumped version for new savedFilters structure.
			partialize: ( state ) => ({
				favorites: state.favorites,
				savedFilters: state.savedFilters
			}),
			migrate: ( persistedState, version ) => {

				// Migration from older versions.
				if ( 3 > version ) {
					return {
						favorites: persistedState?.favorites || DEFAULT_FAVORITES,
						savedFilters: persistedState?.filters || persistedState?.savedFilters || {}
					};
				}
				return persistedState;
			},
			storage: {
				getItem: ( name ) => {
					try {
						const str = localStorage.getItem( name );
						return str ? JSON.parse( str ) : null;
					} catch ( error ) {
						console.warn( 'Failed to read from localStorage:', error );
						return null;
					}
				},
				setItem: ( name, value ) => {
					try {
						localStorage.setItem( name, JSON.stringify( value ) );
					} catch ( error ) {
						console.warn( 'Failed to write to localStorage:', error );
						if ( 'QuotaExceededError' === error.name ) {
							console.warn( 'Storage quota exceeded, clearing saved filters' );

							// Keep favorites but clear savedFilters to free space
							try {
								const minimalValue = {
									...value,
									savedFilters: {} // Clear the large data
								};
								localStorage.removeItem( name );
								localStorage.setItem( name, JSON.stringify( minimalValue ) );
							} catch ( retryError ) {
								console.error( 'Failed to save even after cleanup:', retryError );
							}
						}
					}
				},
				removeItem: ( name ) => {
					try {
						localStorage.removeItem( name );
					} catch ( error ) {
						console.warn( 'Failed to remove from localStorage:', error );
					}
				}
			}
		}
	)
);
