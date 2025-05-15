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
 *
 * @param filter
 * @param filterValue
 * @param label
 * @param children
 * @param startDate
 * @param endDate
 * @return {Element}
 * @constructor
 */
const ClickToFilter = ({
  filter,
  filterValue,
  label,
  children,
  startDate,
  endDate
}) => {

  // Only get the specific functions needed from the stores
  const setFilters = useFiltersStore( ( state ) => state.setFilters );
  const setAnimate = useFiltersStore( ( state ) => state.setAnimate );
  const { getGoal } = useGoalsData();
  const setInsightsMetrics = useInsightsStore( ( state ) => state.setMetrics );
  const insightsMetrics = useInsightsStore( ( state ) => state.getMetrics() );
  const setStartDate = useDate( ( state ) => state.setStartDate );
  const setEndDate = useDate( ( state ) => state.setEndDate );
  const setRange = useDate( ( state ) => state.setRange );

  // Memoize the tooltip to prevent recalculation on every render
  const tooltip = useMemo( () => {
    return label ?
      __( 'Click to filter by:', 'burst-statistics' ) + ' ' + label :
      __( 'Click to filter', 'burst-statistics' );
  }, [ label ]);

  // Memoize the handleDateRange function
  const handleDateRange = useCallback( () => {
    let formattedStartDate = '';
    let formattedEndDate = '';

    // Check if startDate is in Unix, Unix in milliseconds, or yyyy-MM-dd format
    if ( /^\d+$/.test( startDate ) ) {

      // Unix or Unix in milliseconds
      const unixTime =
        10 === startDate.toString().length ? startDate * 1000 : startDate;
      formattedStartDate = new Date( unixTime ).toISOString().split( 'T' )[0];
    } else if ( /\d{4}-\d{2}-\d{2}/.test( startDate ) ) {

      // Already in yyyy-MM-dd format
      formattedStartDate = startDate;
    }

    // If endDate is not set, set to today
    if ( ! endDate ) {
      formattedEndDate = new Date().toISOString().split( 'T' )[0];
    } else if ( /^\d+$/.test( endDate ) ) {

      // Unix or Unix in milliseconds
      const unixTime =
        10 === endDate.toString().length ? endDate * 1000 : endDate;
      formattedEndDate = new Date( unixTime ).toISOString().split( 'T' )[0];
    } else if ( /\d{4}-\d{2}-\d{2}/.test( endDate ) ) {

      // Already in yyyy-MM-dd format
      formattedEndDate = endDate;
    }

    if ( isValidDate( formattedStartDate ) && isValidDate( formattedEndDate ) ) {
      setStartDate( formattedStartDate );
      setEndDate( formattedEndDate );
      setRange( 'custom' );
    }
  }, [ startDate, endDate, setStartDate, setEndDate, setRange ]);

  // Memoize the handleClick function to prevent recreation on every render
  const handleClick = useCallback( async( event ) => {
    window.location.href = '#statistics';

    if ( 'goal_id' === filter ) {

      // Check if we have a goal with a specific page
      const goal = getGoal( filterValue );
      if (
        goal &&
        goal.goal_specific_page
      ) {
        setFilters(
          'page_url',
          goal.goal_specific_page
        );
        setFilters( filter, filterValue );
        toast.info(
          __( 'Filtering by goal & goal specific page', 'burst-statistics' )
        );
      } else {
        setFilters( filter, filterValue );
        toast.info( __( 'Filtering by goal', 'burst-statistics' ) );
      }
      if ( ! insightsMetrics.includes( 'conversions' ) ) {

        // Add 'conversions' to the array and update the state
        setInsightsMetrics([ ...insightsMetrics, 'conversions' ]);
      }
    } else {
      setFilters( filter, '' );

      await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );
      setFilters( filter, filterValue, true );

      setAnimate( false );
    }
    handleDateRange();
  }, [ filter, filterValue, getGoal, setFilters, insightsMetrics, setInsightsMetrics, setAnimate, handleDateRange ]);

  // Early return if no filter or filterValue
  if ( ! filter || ! filterValue ) {
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

// Wrap the component with React.memo to prevent unnecessary re-renders
export default React.memo( ClickToFilter );
