import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {produce} from 'immer';
import {__} from '@wordpress/i18n';
import useFiltersData from "@/hooks/useFiltersData";

// Filter categories configuration
const FILTER_CATEGORIES = {
    content: {
        label: __('Context', 'burst-statistics'),
        icon: 'content',
        order: 1,
    },
    sources: {
        label: __('Sources', 'burst-statistics'),
        icon: 'source',
        order: 2,
    },
    behavior: {
        label: __('Behavior', 'burst-statistics'),
        icon: 'behavior',
        order: 3,
    },
    location: {
        label: __('Location', 'burst-statistics'),
        icon: 'location',
        order: 4,
    },
};

// Filter configuration with labels, icons, and categories
const FILTER_CONFIG = {
    // Free Filters
    page_url: {
        label: __('Page URL', 'burst-statistics'),
        icon: 'page',
        type: 'string',
        options: 'pages',
        pro: false,
        category: 'content',
    },
    referrer: {
        label: __('Referrer', 'burst-statistics'),
        icon: 'referrer',
        type: 'string',
        options: 'referrers',
        pro: false,
        category: 'sources',
    },
    goal_id: {
        label: __('Goal', 'burst-statistics'),
        icon: 'goals',
        type: 'string',
        options: 'goals',
        pro: false,
        category: 'content',
    },
    bounces: {
        label: __('Bounced Visitors', 'burst-statistics'),
        icon: 'bounce',
        type: 'boolean',
        pro: false,
        category: 'behavior',
    },
    device_id: {
        label: __('Device', 'burst-statistics'),
        icon: 'desktop',
        type: 'string',
        options: 'devices',
        pro: false,
        category: 'content',
    },
    // Pro Filters
    host: {
        label: __('Domain', 'burst-statistics'),
        icon: 'browser',
        type: 'string',
        options: 'hosts',
        pro: true,
        category: 'sources',
    },
    new_visitor: {
        label: __('New Visitors', 'burst-statistics'),
        icon: 'user',
        type: 'boolean',
        pro: true,
        category: 'behavior',
    },
    bounce_rate: {
        label: __('Bounce Rate', 'burst-statistics'),
        icon: 'bounce',
        type: 'int',
        pro: true,
        category: 'behavior',
        coming_soon: true,
    },
    entry_exit_pages: {
        label: __('Entry or exit page', 'burst-statistics'),
        icon: 'bounce',
        type: 'boolean',
        pro: true,
        category: 'behavior',
    },
    conversion_rate: {
        label: __('Conversion Rate', 'burst-statistics'),
        icon: 'conversion',
        type: 'int',
        pro: true,
        category: 'behavior',
        coming_soon: true,
    },
    url_parameter: {
        label: __('URL Parameter', 'burst-statistics'),
        icon: 'parameters',
        type: 'string',
        pro: true,
        category: 'sources',
        coming_soon: true,
    },
    campaign: {
        label: __('Campaign', 'burst-statistics'),
        icon: 'campaign',
        type: 'string',
        options: 'campaigns',
        pro: true,
        category: 'sources',
    },
    source: {
        label: __('Source', 'burst-statistics'),
        icon: 'source',
        type: 'string',
        options: 'contents',
        pro: true,
        category: 'sources',
    },
    medium: {
        label: __('Medium', 'burst-statistics'),
        icon: 'medium',
        type: 'string',
        options: 'mediums',
        pro: true,
        category: 'sources',
    },
    term: {
        label: __('Term', 'burst-statistics'),
        icon: 'term',
        type: 'string',
        options: 'terms',
        pro: true,
        category: 'sources',
    },
    content: {
        label: __('Content', 'burst-statistics'),
        icon: 'content',
        type: 'string',
        options: 'contents',
        pro: true,
        category: 'sources',
    },
    country_code: {
        label: __('Country', 'burst-statistics'),
        icon: 'world',
        type: 'string',
        options: 'countries',
        pro: true,
        category: 'location',
    },
    state: {
        label: __('State', 'burst-statistics'),
        icon: 'map-pinned',
        type: 'string',
        options: 'states',
        pro: true,
        category: 'location',
    },
    city: {
        label: __('City', 'burst-statistics'),
        icon: 'city',
        type: 'string',
        options: 'cities',
        pro: true,
        category: 'location',
    },
    time_per_session: {
        label: __('Time per Session', 'burst-statistics'),
        icon: 'time',
        type: 'int',
        pro: true,
        category: 'behavior',
        coming_soon: true,
    },
    platform_id: {
        label: __('Operating System', 'burst-statistics'),
        icon: 'operating-system',
        type: 'string',
        options: 'platforms',
        pro: true,
        category: 'content',
    },
    browser_id: {
        label: __('Browser', 'burst-statistics'),
        icon: 'browser',
        type: 'string',
        options: 'browsers',
        pro: true,
        category: 'content',
    },
};

// Default favorites for new users
const DEFAULT_FAVORITES = ['page_url', 'referrer', 'bounces', 'device'];

// Initial filter state - all filters start empty
const INITIAL_FILTERS = Object.keys(FILTER_CONFIG).reduce((acc, key) => {
    acc[key] = '';
    return acc;
}, {});

/**
 * Zustand store for managing analytics filters with persistence
 */
export const useFiltersStore = create(
    persist(
        (set, get) => ({

            // Current filter values
            filters: INITIAL_FILTERS,

            // Filter configuration (labels, icons, etc.)
            filtersConf: FILTER_CONFIG,

            // Filter categories configuration
            filterCategories: FILTER_CATEGORIES,

            // User's favorite filters
            favorites: DEFAULT_FAVORITES,

            /**
             * Set a filter value
             * @param {string} filter - The filter key to update
             * @param {string} value - The value to set for the filter
             */
            setFilters: (filter, value) => {
                if (typeof filter !== 'string' || !filter.length) {
                    return;
                }
                set(state => produce(state, draft => {
                    if (!draft.filters || typeof draft.filters !== 'object') {
                        return;
                    }
                    draft.filters[filter] = value;
                }));
            },

            /**
             * Clear a specific filter
             * @param {string} filter - The filter key to clear
             */
            deleteFilter: (filter) => {
                set(state => produce(state, draft => {
                    draft.filters[filter] = '';
                }));
            },

            /**
             * Clear all filters
             */
            clearAllFilters: () => {
                set(state => produce(state, draft => {
                    draft.filters = {...INITIAL_FILTERS};
                }));
            },

            /**
             * Get active filters (non-empty values)
             * @returns {Object} Object containing only filters with values
             */
            getActiveFilters: () => {
                const {filters} = get();
                return Object.entries(filters)
                    .filter(([_, value]) => value !== '')
                    .reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {});
            },

            /**
             * Check if any filters are active
             * @returns {boolean} True if any filter has a value
             */
            hasActiveFilters: () => {
                const {filters} = get();
                return Object.values(filters).some(value => value !== '');
            },

            /**
             * Get filters organized by category
             * @returns {Object} Object with categories as keys and filter arrays as values
             */
            getFiltersByCategory: () => {
                const {filtersConf, filterCategories} = get();
                const categorizedFilters = {};
                
                // Initialize categories
                Object.keys(filterCategories).forEach(categoryKey => {
                    categorizedFilters[categoryKey] = [];
                });
                
                // Group filters by category
                Object.entries(filtersConf).forEach(([filterKey, config]) => {
                    if (config.category && categorizedFilters[config.category]) {
                        categorizedFilters[config.category].push({
                            key: filterKey,
                            ...config
                        });
                    }
                });
                
                return categorizedFilters;
            },

            /**
             * Add a filter to favorites
             * @param {string} filterKey - The filter key to add to favorites
             */
            addToFavorites: (filterKey) => {
                set(state => produce(state, draft => {
                    if (!draft.favorites.includes(filterKey)) {
                        draft.favorites.push(filterKey);
                    }
                }));
            },

            /**
             * Remove a filter from favorites
             * @param {string} filterKey - The filter key to remove from favorites
             */
            removeFromFavorites: (filterKey) => {
                set(state => produce(state, draft => {
                    draft.favorites = draft.favorites.filter(fav => fav !== filterKey);
                }));
            },

            /**
             * Toggle a filter in favorites
             * @param {string} filterKey - The filter key to toggle in favorites
             */
            toggleFavorite: (filterKey) => {
                const {favorites} = get();
                if (favorites.includes(filterKey)) {
                    get().removeFromFavorites(filterKey);
                } else {
                    get().addToFavorites(filterKey);
                }
            },

            /**
             * Check if a filter is in favorites
             * @param {string} filterKey - The filter key to check
             * @returns {boolean} True if filter is in favorites
             */
            isFavorite: (filterKey) => {
                const {favorites} = get();
                return favorites.includes(filterKey);
            },

            /**
             * Get favorite filters with their configuration
             * @returns {Array} Array of favorite filter objects
             */
            getFavoriteFilters: () => {
                const {favorites, filtersConf} = get();
                return favorites
                    .filter(filterKey => filtersConf[filterKey])
                    .map(filterKey => ({
                        key: filterKey,
                        ...filtersConf[filterKey]
                    }));
            },

        }),
        {
            name: "burst-filters-storage",
            version: 1.2,
            partialize: (state) => ({
                filters: state.filters,
                favorites: state.favorites,
            }),
        }
    )
);
