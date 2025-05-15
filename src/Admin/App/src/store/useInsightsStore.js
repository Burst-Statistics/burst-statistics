import {create} from 'zustand';
import {getLocalStorage, setLocalStorage} from '../utils/api';

// define the store
export const useInsightsStore = create( ( set, get ) => ({
  metrics: [ 'visitors', 'pageviews' ],
  loaded: false,
  getMetrics: () => {
    if ( get().loaded ) {
      return get().metrics;
    }
    let metrics = getLocalStorage( 'insights_metrics', [ 'visitors', 'pageviews' ]);

    //temporarily remove conversions from localstorage until the query has been fixed
    metrics = metrics.filter( metric => 'conversions' !== metric );

    set({ metrics, loaded: true });
    return metrics;
  },
  setMetrics: ( metrics ) => {
    set({ metrics });
    setLocalStorage( 'insights_metrics', metrics );
  }
}) );
