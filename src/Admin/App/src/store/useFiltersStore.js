import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { __ } from '@wordpress/i18n';

// Filter configuration with labels and icons
const FILTER_CONFIG = {
  page_url: {
    label: __('Page', 'burst-statistics'),
    icon: 'page'
  },
  goal_id: {
    label: __('Goal', 'burst-statistics'),
    icon: 'goals'
  },
  referrer: {
    label: __('Referrer URL', 'burst-statistics'),
    icon: 'referrer'
  },
  device: {
    label: __('Device', 'burst-statistics'),
    icon: 'desktop'
  },
  browser: {
    label: __('Browser', 'burst-statistics'),
    icon: 'browser'
  },
  platform: {
    label: __('Operating System', 'burst-statistics'),
    icon: 'operating-system'
  },
  country_code: {
    label: __('Country', 'burst-statistics'),
    icon: 'world'
  },
  continent_code: {
    label: __('Continent', 'burst-statistics'),
    icon: 'world'
  },
  county: {
    label: __('County', 'burst-statistics'),
    icon: 'world'
  },
  city: {
    label: __('City', 'burst-statistics'),
    icon: 'world'
  },
  // parameters: {
  //   label: __('Parameters', 'burst-statistics'),
  //   icon: 'parameters'
  // },
  // parameter: {
  //   label: __('Parameter', 'burst-statistics'),
  //   icon: 'parameters'
  // },
  // campaign: {
  //   label: __('Campaign', 'burst-statistics'),
  //   icon: 'campaign'
  // },
  // source: {
  //   label: __('Source', 'burst-statistics'),
  //   icon: 'source'
  // },
  // medium: {
  //   label: __('Medium', 'burst-statistics'),
  //   icon: 'medium'
  // },
  // content: {
  //   label: __('Content', 'burst-statistics'),
  //   icon: 'content'
  // },
  // term: {
  //   label: __('Term', 'burst-statistics'),
  //   icon: 'term'
  // },
};

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
    (set) => ({
      // Current filter values
      filters: INITIAL_FILTERS,
      
      // Filter configuration (labels, icons, etc.)
      filtersConf: FILTER_CONFIG,

      /**
       * Set a filter value
       * @param {string} filter - The filter key to update
       * @param {string} value - The value to set for the filter
       */
      setFilters: (filter, value) => {
        set(state => produce(state, draft => {
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
          draft.filters = { ...INITIAL_FILTERS };
        }));
      },

      /**
       * Get active filters (non-empty values)
       * @returns {Object} Object containing only filters with values
       */
      getActiveFilters: () => {
        const { filters } = useFiltersStore.getState();
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
        const { filters } = useFiltersStore.getState();
        return Object.values(filters).some(value => value !== '');
      }
    }),
    {
      name: "burst-filters-storage",
      partialize: (state) => ({
        filters: state.filters,
      }),
    }
  )
);
