import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {
  endOfDay,
  format,
  startOfDay,
  subDays
} from 'date-fns';
import {availableRanges} from '../utils/formatting';

const updateRangeFromKey = ( key ) => {
  if ( availableRanges[key]) {
    const {startDate, endDate} = availableRanges[key].range();
    return {
      startDate: format( startDate, 'yyyy-MM-dd' ),
      endDate: format( endDate, 'yyyy-MM-dd' ),
      range: key
    };
  }
  return null;
};

// Define the store
export const useDate = create(
  persist(
    ( set, get ) => {
      // Get default values
      const defaultStartDate = format( startOfDay( subDays( new Date(), 7 ) ), 'yyyy-MM-dd' );
      const defaultEndDate = format( endOfDay( subDays( new Date(), 1 ) ), 'yyyy-MM-dd' );
      const defaultRange = 'last-7-days';

      return {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        range: defaultRange,
        setStartDate: ( startDate ) => set( { startDate } ),
        setEndDate: ( endDate ) => set( { endDate } ),
        setRange: ( range ) => {
          if ( 'custom' === range ) {
            set({ range });
            return;
          }
          
          const updatedRange = updateRangeFromKey( range );
          if ( updatedRange ) {
            set( updatedRange );
          }
        }
      };
    },
    {
      name: 'burst-date-storage',
      partialize: ( state ) => ({
        range: state.range,
        startDate: state.startDate,
        endDate: state.endDate
      }),
      onRehydrateStorage: () => ( state ) => {
        // On rehydration, if we have a saved range key that's not 'custom', 
        // update the dates based on the current date
        if ( state && state.range && state.range !== 'custom' ) {
          const updatedRange = updateRangeFromKey( state.range );
          if ( updatedRange ) {
            Object.assign( state, updatedRange );
          }
        }
      }
    }
  )
);
