import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {doAction} from '../utils/api';


const useTasks = create(
  persist(
    ( set, get ) => ({
      filter: 'all',
      tasks: [],
      filteredTasks: [],
      error: false,
      loading: true,
      setFilter: ( filter ) => {
        set({ filter });
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
  fixTask: async( taskId) => {
    await doAction('fix_task', { task_id: taskId });
    get().getTasks();
  },
  getTasks: async() => {
    try {
      const { tasks } = await doAction( 'tasks' );
      let tasksArray;
      if (Array.isArray(tasks)) {
        tasksArray = tasks;
      } else if (typeof tasks === 'object' && tasks !== null) {
        // filter out prototype objects.
        tasksArray = Object.keys(tasks)
            .filter(key => tasks.hasOwnProperty(key) && !isNaN(key))
            .map(key => tasks[key]);
      } else {
        console.log("tasks array has unexpected format: ", tasks );
        tasksArray = [];
      }

      set( state => ({
        tasks: tasksArray,
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
    set({ tasks: tasks });

    await doAction( 'dismiss_task', {id: taskId}).then( ( response ) => {

      // error handling
      response.error && console.error( response.error );
    });
  }
    }),
    {
      name: 'burst-tasks-storage',
      partialize: ( state ) => ({
        filter: state.filter
      })
    }
  )
);

export default useTasks;

