import React from '@wordpress/element';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useGoalsStore} from '../../store/useGoalsStore';
import {useInsightsStore} from '../../store/useInsightsStore';
import {useDate} from '../../store/useDateStore';
import Tooltip from '../common/Tooltip';
import {__} from '@wordpress/i18n';
import {toast} from 'react-toastify';
import {isValidDate, toUnixTimestampMillis} from '../../utils/formatting';

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

  const setFilters = useFiltersStore( ( state ) => state.setFilters );
  const setAnimate = useFiltersStore( ( state ) => state.setAnimate );
  const goalFields = useGoalsStore( ( state ) => state.goalFields );
  const setInsightsMetrics = useInsightsStore(
      ( state ) => state.setMetrics );
  const insightsMetrics = useInsightsStore( ( state ) => state.getMetrics() );
  const setStartDate = useDate( ( state ) => state.setStartDate );
  const setEndDate = useDate( ( state ) => state.setEndDate );
  const setRange = useDate( ( state ) => state.setRange );
  const tooltip = label ?
      __( 'Click to filter by:', 'burst-statistics' ) + ' ' + label :
      __( 'Click to filter', 'burst-statistics' );

  const waitForElement = ( selector, timeout = 3000 ) => {
    const startTime = Date.now();
    return new Promise( ( resolve, reject ) => {
      const intervalId = setInterval( () => {
        const element = document.querySelector( selector );
        const timeElapsed = Date.now() - startTime;
        if ( element ) {
          clearInterval( intervalId );
          resolve( element );
        } else if ( timeElapsed > timeout ) {
          clearInterval( intervalId );
          reject( new Error( `Element not found: ${selector}` ) );
        }
      }, 100 );
    });
  };

  const animateElement = async( event ) => {
    try {
      const element = await waitForElement( '.burst-data-filter--animate' );
      const styles = window.getComputedStyle( element );

      const parentOffsetX = element.offsetParent ?
          element.offsetParent.offsetLeft :
          0;
      const parentOffsetY = element.offsetParent ?
          element.offsetParent.offsetTop :
          0;
      const marginLeft = parseInt( styles.marginLeft );
      const marginTop = parseInt( styles.marginTop );
      const elementWidth = element.offsetWidth;
      const elementHeight = element.offsetHeight;
      const x = event.clientX - elementWidth + window.scrollX - parentOffsetX -
          marginLeft;
      const y = event.clientY - ( elementHeight * 4 ) + window.scrollY -
          parentOffsetY - marginTop;

      element.style.transformOrigin = '50% 50%';
      element.style.opacity = 0;
      element.style.transform = `translateX(${x}px) translateY(${y}px)`;

      await new Promise( resolve => setTimeout( resolve, 50 ) );

      element.style.transition = 'transform 0.2s ease, opacity 0.2s ease-out';
      element.style.transform = `translateX(${x}px) translateY(${y}px) scale(1)`;
      element.style.opacity = 1;

      element.style.transition = 'transform 0.5s ease-in-out, opacity 0.2s ease-out';
      element.style.transform = 'translateX(0) translateY(0)';
    } catch ( error ) {
      console.error( error.message );
    }
  };

  const handleClick = async( event ) => {
    window.location.href = '#statistics';

    if ( 'goal_id' === filter ) {

      // @todo get goal setup
      if ( goalFields[filterValue] &&
          goalFields[filterValue].goal_specific_page &&
          goalFields[filterValue].goal_specific_page.value ) {
        setFilters( 'page_url',
            goalFields[filterValue].goal_specific_page.value );
        setFilters( filter, filterValue );
        toast.info(
            __( 'Filtering by goal & goal specific page', 'burst-statistics' ) );
      } else {
        setFilters( filter, filterValue );
        toast.info( __( 'Filtering by goal', 'burst-statistics' ) );
      }
      if ( ! insightsMetrics.includes( 'conversions' ) ) {

        // Add 'conversions' to the array and update the state
        setInsightsMetrics([ ...insightsMetrics, 'conversions' ]);
      }

      // add 'conversions' to insightMetrics

    } else {
      setFilters( filter, '' );

      await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );
      setFilters( filter, filterValue, true );
      await animateElement( event );

      setAnimate( false );
    }
    handleDateRange();
  };

  const handleDateRange = () => {
    let formattedStartDate = '';
    let formattedEndDate = '';

    // Check if startDate is in Unix, Unix in milliseconds, or yyyy-MM-dd format
    if ( /^\d+$/.test( startDate ) ) {

      // Unix or Unix in milliseconds
      const unixTime = 10 === startDate.toString().length ?
          startDate * 1000 :
          startDate;
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
      const unixTime = 10 === endDate.toString().length ?
          endDate * 1000 :
          endDate;
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
  };

  if ( ! filter || ! filterValue ) {
    return <>{children}</>;
  }

  return (
      <Tooltip content={tooltip} >
        <span onClick={handleClick} className="burst-click-to-filter">
          {children}
        </span>
      </Tooltip>
  );
};

export default ClickToFilter;
