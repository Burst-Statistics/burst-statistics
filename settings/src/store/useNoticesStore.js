import {create} from 'zustand';
import * as burst_api from '../utils/api';
import {getLocalStorage, setLocalStorage} from '../utils/api';


const useNotices = create( ( set, get ) => ({
  filter: getLocalStorage( 'task_filter', 'all' ),
  notices: [],
  filteredNotices: [],
  error: false,
  loading: true,
  setFilter: ( filter ) => {
    setLocalStorage( 'task_filter', filter );
    set( state => ({ filter }) );
  },
  filterNotices: () => {
    let filteredNotices = [];

    // loop trough notices and remove the ones that are not open
    get().notices.map( ( notice, i ) => {
      if ( 'completed' !== notice.icon ) {
        filteredNotices.push( notice );
      }
    });
    set( state => ({ filteredNotices: filteredNotices }) );
  },
  getNotices: async() => {
    try {
      const { tasks } = await burst_api.doAction( 'tasks' );
      //convert notices object to array
      const noticesArray = Object.values(tasks);
      set( state => ({
        notices: noticesArray,
        loading: false
      }) );
      get().filterNotices();
    } catch ( error ) {
      set( state => ({ error: error.message }) );
    }
  },
  dismissNotice: async( noticeId ) => {
    let notices = get().notices;
    notices = notices.filter( function( notice ) {
      return notice.id !== noticeId;
    });
    set( state => ({ notices: notices }) );
    get().filterNotices();
    await burst_api.doAction( 'dismiss_task', {id: noticeId}).then( ( response ) => {

      // error handling
      response.error && console.error( response.error );
    });
  }
}) );

export default useNotices;

