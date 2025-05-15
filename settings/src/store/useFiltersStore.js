import {create} from 'zustand';
import {produce} from 'immer';
import {__} from '@wordpress/i18n';

import {useInsightsStore} from './useInsightsStore';

// define the store
export const useFiltersStore = create( ( set, get ) => ({
  filters: {
    page_id: '',
    page_url: '',
    goal_id: '',
    referrer: '',
    device: '',
    browser: '',
    platform: '',
    country_code: ''
  },
  filtersConf: {
    page_url: {
      label: __( 'Page', 'burst-statistics' ),
      icon: 'page'
    },
    goal_id: {
      label: __( 'Goal', 'burst-statistics' ),
      icon: 'goals'
    },
    referrer: {
      label: __( 'Referrer URL', 'burst-statistics' ),
      icon: 'referrer'
    },
    device: {
      label: __( 'Device', 'burst-statistics' ),
      icon: 'desktop'
    },
    browser: {
      label: __( 'Browser', 'burst-statistics' ),
      icon: 'browser'
    },
    platform: {
      label: __( 'Operating System', 'burst-statistics' ),
      icon: 'operating-system'
    },
    country_code: {
      label: __( 'Country', 'burst-statistics' ),
      icon: 'world'
    }
  },
  animate: null,
  setAnimate: ( animate ) => set({animate}),
  setFilters: ( filter, value, animate = false ) => {

    // check if value is not empty or false
    // use zustand to produce a new state
    set( state => produce( state, draft => {
      draft.filters[filter] = value;
    }) );
    if ( animate ) {
      get().setAnimate( filter );
    }
  },
  deleteFilter: ( filter ) => {
    set( state => produce( state, draft => {
      draft.filters[filter] = '';
    }) );
  }
}) );
