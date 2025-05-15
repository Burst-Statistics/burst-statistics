import {create} from 'zustand';
import {getLocalStorage, setLocalStorage} from '../utils/api';

// define the store
export const useAcquisitionStore = create( ( set, get ) => ({
  type: getLocalStorage( 'acquisition_data_type', 'referrers' ),
  setType: ( type ) => {
    set({ type });
    setLocalStorage( 'acquisition_data_type', type );
  }
}) );
