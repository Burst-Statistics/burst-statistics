import {create} from 'zustand';
import {persist} from 'zustand/middleware';

// define the store
export const useInsightsStore = create(
  persist(
    ( set, get ) => ({
      metrics: [ 'visitors', 'pageviews' ],
      loaded: false,
      getMetrics: () => {
        if ( get().loaded ) {
          return get().metrics;
        }
        
        let metrics = get().metrics || [ 'visitors', 'pageviews' ];

        //temporarily remove conversions from localstorage until the query has been fixed
        metrics = metrics.filter( metric => 'conversions' !== metric );

        set({ metrics, loaded: true });
        return metrics;
      },
      setMetrics: ( metrics ) => {
        set({ metrics });
      }
    }),
    {
      name: 'burst-insights-storage',
      partialize: ( state ) => ({
        metrics: state.metrics
      }),
      onRehydrateStorage: () => ( state ) => {
        // On rehydration, filter out conversions if they exist
        if ( state && state.metrics ) {
          state.metrics = state.metrics.filter( metric => 'conversions' !== metric );
        }
      }
    }
  )
);
