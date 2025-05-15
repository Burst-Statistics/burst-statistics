import {create} from 'zustand';
import {
  addDays, addMonths, addYears,
  endOfDay, endOfMonth, endOfYear,
  format,
  startOfDay,
  startOfMonth, startOfYear,
  subDays
} from 'date-fns';

import { availableRanges } from '../utils/formatting';
import {__} from '@wordpress/i18n';

import {getLocalStorage, setLocalStorage} from '../utils/api';
const updateRangeFromKey = ( key ) => {
  if ( availableRanges[key]) {
    const { startDate, endDate } = availableRanges[key].range();
    return {
      startDate: format( startDate, 'yyyy-MM-dd' ),
      endDate: format( endDate, 'yyyy-MM-dd' ),
      range: key
    };
  }
  return null;
};


// Define the store
export const useDate = create( ( set ) => {

  // Attempt to get the range from local storage
  const savedRangeKey = getLocalStorage( 'selectedRangeKey' );

  // Check if the saved range key is in availableRanges
  const rangeData = savedRangeKey ? updateRangeFromKey( savedRangeKey ) : null;

  return {
    startDate: rangeData ? rangeData.startDate : format( startOfDay( subDays( new Date(), 7 ) ), 'yyyy-MM-dd' ),
    endDate: rangeData ? rangeData.endDate : format( endOfDay( subDays( new Date(), 1 ) ), 'yyyy-MM-dd' ),
    range: rangeData ? rangeData.range : 'last-7-days',
    setStartDate: ( startDate ) => set( ( state ) => ({ startDate }) ),
    setEndDate: ( endDate ) => set( ( state ) => ({ endDate }) ),
    setRange: ( range ) => {

      // Update local storage when range is set
      if ( 'custom' === range ) {
        set({ range });
        return;
      }
      setLocalStorage( 'selectedRangeKey', range );
      const updatedRange = updateRangeFromKey( range );
      if ( updatedRange ) {
        set( updatedRange );
      }
    }
  };
});
