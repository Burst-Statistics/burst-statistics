import {create} from 'zustand';
import {doAction} from '../utils/api';
import {getLocalStorage, setLocalStorage} from '../utils/api';


const useTasks = create( ( set, get ) => ({
  filter: getLocalStorage( 'task_filter', 'all' ),
  tasks: [],
  filteredTasks: [],
  error: false,
  loading: true,
  setFilter: ( filter ) => {
    setLocalStorage( 'task_filter', filter );
    set( state => ({ filter }) );
  },
  filterTasks: () => {
  let filteredTasks = [];
  
    // loop trough tasks and remove the ones that are not open
    get().tasks.map( ( task, i ) => {
      if ( 'completed' !== task.icon ) {
        filteredTasks.push( task );
      }
    });
    set( state => ({ filteredTasks: filteredTasks }) );
  },
  getTasks: async() => {
    try {
      const { tasks } = await doAction( 'tasks' );
      // check if tasks is an array
      if ( ! Array.isArray( tasks ) ) {
        console.error("Tasks is not an array");
        throw new Error( 'Tasks is not an array' );
      }
      set( state => ({
        tasks: tasks,
        loading: false
      }) );
      get().filterTasks();
    } catch ( error ) {
      set( state => ({ error: error.message }) );
    }
  },
  dismissTask: async( taskId ) => {
    let tasks = get().tasks;
    tasks = tasks.filter( function( task ) {
      return task.id !== taskId;
    });
    set( state => ({ tasks: tasks }) );

    await doAction( 'dismiss_task', {id: taskId}).then( ( response ) => {

      // error handling
      response.error && console.error( response.error );
    });
  }
}) );

export default useTasks;

