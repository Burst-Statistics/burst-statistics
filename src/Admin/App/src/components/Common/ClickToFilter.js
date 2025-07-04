import React, { useCallback, useMemo } from 'react';
import { useFiltersStore } from '@/store/useFiltersStore';
import useGoalsData from '@/hooks/useGoalsData';
import { useInsightsStore } from '@/store/useInsightsStore';
import { useDate } from '@/store/useDateStore';
import Tooltip from '@/components/Common/Tooltip';
import { __ } from '@wordpress/i18n';
import { toast } from 'react-toastify';
import { isValidDate } from '@/utils/formatting';

/**
 * ClickToFilter component - makes any child element clickable to apply filters
 * 
 * @param {string} filter - The filter type (e.g., 'country_code', 'page_url', 'device')
 * @param {string} filterValue - The specific value to filter by
 * @param {string} label - Display label for tooltips
 * @param {React.ReactNode} children - The wrapped content that becomes clickable
 * @param {string} startDate - Optional start date to set when filtering
 * @param {string} endDate - Optional end date to set when filtering
 * @return {React.ReactElement}
 */
const ClickToFilter = ({
  filter,
  filterValue,
  label,
  children,
  startDate,
  endDate
}) => {
  // Store actions
  const setFilters = useFiltersStore(state => state.setFilters);
  const filtersConf = useFiltersStore(state => state.filtersConf);
  const { getGoal } = useGoalsData();
  const setInsightsMetrics = useInsightsStore(state => state.setMetrics);
  const insightsMetrics = useInsightsStore(state => state.getMetrics());
  const setStartDate = useDate(state => state.setStartDate);
  const setEndDate = useDate(state => state.setEndDate);
  const setRange = useDate(state => state.setRange);

  // Check if the filter is allowed
  const isValidFilter = useMemo(() => {
    return filter && filtersConf && Object.prototype.hasOwnProperty.call(filtersConf, filter);
  }, [filter, filtersConf]);
  
  if ( !isValidFilter ) {
    return <>{children}</>;
  }

  // Memoize tooltip content
  const tooltip = useMemo(() => {
    
    return label 
      ? `${__('Click to filter by:', 'burst-statistics')} ${label}`
      : __('Click to filter', 'burst-statistics');
  }, [label, isValidFilter]);

  // Handle date range updates
  const handleDateRange = useCallback(() => {
    if (!startDate) return;

    let formattedStartDate = '';
    let formattedEndDate = '';

    // Format start date
    if (/^\d+$/.test(startDate)) {
      // Unix timestamp (10 digits) or Unix in milliseconds (13 digits)
      const unixTime = startDate.toString().length === 10 
        ? startDate * 1000 
        : startDate;
      formattedStartDate = new Date(unixTime).toISOString().split('T')[0];
    } else if (/\d{4}-\d{2}-\d{2}/.test(startDate)) {
      // Already in yyyy-MM-dd format
      formattedStartDate = startDate;
    }

    // Format end date (default to today if not provided)
    if (!endDate) {
      formattedEndDate = new Date().toISOString().split('T')[0];
    } else if (/^\d+$/.test(endDate)) {
      const unixTime = endDate.toString().length === 10 
        ? endDate * 1000 
        : endDate;
      formattedEndDate = new Date(unixTime).toISOString().split('T')[0];
    } else if (/\d{4}-\d{2}-\d{2}/.test(endDate)) {
      formattedEndDate = endDate;
    }

    // Apply date range if valid
    if (isValidDate(formattedStartDate) && isValidDate(formattedEndDate)) {
      setStartDate(formattedStartDate);
      setEndDate(formattedEndDate);
      setRange('custom');
    }
  }, [startDate, endDate, setStartDate, setEndDate, setRange]);

  // Handle goal-specific filtering
  const handleGoalFilter = useCallback((goalId) => {
    const goal = getGoal(goalId);
    
    if (goal?.goal_specific_page) {
      setFilters('page_url', goal.goal_specific_page);
      setFilters('goal_id', goalId);
      toast.info(__('Filtering by goal & goal specific page', 'burst-statistics'));
    } else {
      setFilters('goal_id', goalId);
      toast.info(__('Filtering by goal', 'burst-statistics'));
    }

    // Add conversions metric if not already present
    if (!insightsMetrics.includes('conversions')) {
      setInsightsMetrics([...insightsMetrics, 'conversions']);
    }
  }, [getGoal, setFilters, insightsMetrics, setInsightsMetrics]);

  // Main click handler
  const handleClick = useCallback(() => {
    // Validate filter before processing
    if (!isValidFilter) {
      console.warn(`ClickToFilter: Invalid filter "${filter}" - not found in filter configuration`);
      return;
    }

    // Apply the appropriate filter
    if (filter === 'goal_id') {
      handleGoalFilter(filterValue);
    } else {
      setFilters(filter, filterValue);
    }

    // Apply date range if provided
    handleDateRange();
  }, [filter, filterValue, isValidFilter, handleGoalFilter, setFilters, handleDateRange]);

  // Early return if no filter configuration or invalid filter
  if (!filter || !filterValue) {
    return <>{children}</>;
  }

  // If filter is not valid, render children without click functionality
  if (!isValidFilter) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`ClickToFilter: Filter "${filter}" is not configured in FILTER_CONFIG`);
    }
    return <>{children}</>;
  }

  return (
    <Tooltip content={tooltip}>
      <span onClick={handleClick} className="burst-click-to-filter">
        {children}
      </span>
    </Tooltip>
  );
};

export default React.memo(ClickToFilter);
