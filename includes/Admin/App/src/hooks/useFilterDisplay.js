import {useCallback, useEffect, useMemo, useState} from 'react';
import {useFiltersStore} from '../store/useFiltersStore';
import {useInsightsStore} from '../store/useInsightsStore';
import useFiltersData from "@/hooks/useFiltersData";
import {__} from "@wordpress/i18n";

/**
 * Custom hook for managing filter display logic
 * Centralizes filter operations and cross-store interactions
 * 
 * @returns {Object} Filter display utilities and operations
 */
export const useFilterDisplay = () => {
    const { 
        filters, 
        filtersConf, 
        setFilters, 
    } = useFiltersStore();
    const {getFilterOptionById} = useFiltersData();
    const { setMetrics, getMetrics } = useInsightsStore();

    // Get active filters with display information
    const [activeFilters, setActiveFilters] = useState([]);

    useEffect(() => {
        const loadFilters = async () => {
            const filtersWithDisplay = await getActiveFiltersWithDisplay();
            setActiveFilters(filtersWithDisplay);
        };
        loadFilters();
    }, [filters]);


    const getActiveFiltersWithDisplay = useCallback(async () => {
        const active = Object.entries(filters)
            .filter(([_, value]) => value !== '');
        return await Promise.all(
            active.map(async ([key, value]) => {
                const displayValue = await getFilterDisplayValue(key, value);
                return {
                    key,
                    value,
                    displayValue,
                    config: filtersConf?.[key] || null,
                };
            })
        );
    }, [filters, filtersConf]);

    const getFilterDisplayValue = async (filterKey, value, externalData = {}) => {
        if (!value) {
            return '';
        }

        if ( filtersConf.hasOwnProperty(filterKey) ) {
            const filterType = filtersConf[filterKey]?.options || false;
            if (filterType) {
                //if value contains a , explode it into an array
                //check if value is a string and contains a comma
                if (typeof value === 'string' && value.indexOf(',') !== -1) {
                    value = value.split(',').map(v => v.trim());
                    // Map each value to its display option
                    value = await Promise.all(
                        value.map(async (v) => await getFilterOptionById(v, filterType) || v)
                    );
                    // Join back to a string
                    value = value.join(', ');
                } else {
                    value = await getFilterOptionById(value, filterType) || value;
                }
            }
        }

        switch (filterKey) {
            case 'country_code':
                if (!value) return '';
                const code = value.toUpperCase();
                const countryLabel = window.burst_settings?.countries?.[code];
                return countryLabel || code;
            case 'bounces':
                return value === 'include'
                    ? __('Bounced visitors', 'burst-statistics')
                    : __('Active visitors', 'burst-statistics');

            case 'new_visitor':
                return value === 'true'
                    ? __('New visitors', 'burst-statistics')
                    : __('Returning visitors', 'burst-statistics');

            default:
                return value;
        }
    }

    /**
     * Remove a filter and handle any side effects
     * @param {string} filterKey - The filter key to remove
     */
    const removeFilter = useCallback((filterKey) => {
        // Clear the filter
        setFilters(filterKey, '');

        // Handle side effects based on filter type
        if (filterKey === 'goal_id') {
            // Remove conversions metric when goal filter is removed
            const currentMetrics = getMetrics();
            const updatedMetrics = currentMetrics.filter(metric => metric !== 'conversions');
            setMetrics(updatedMetrics);
        }
    }, [setFilters, setMetrics, getMetrics]);

    /**
     * Check if any filters are currently active
     * @returns {boolean} True if any filters have values
     */
    const hasActiveFilters = useMemo(() => {
        return Array.isArray(activeFilters) && activeFilters.length > 0;
    }, [activeFilters]);

    /**
     * Get filter configuration by key
     * @param {string} filterKey - The filter key
     * @returns {Object|null} Filter configuration or null if not found
     */
    const getFilterConfig = useCallback((filterKey) => {
        return filtersConf[filterKey] || null;
    }, [filtersConf]);

    return {
        activeFilters,
        hasActiveFilters,
        removeFilter,
        getFilterConfig,
        // Expose underlying store methods for advanced usage
        setFilter: setFilters,
        filters,
        filtersConf
    };
};

export default useFilterDisplay; 