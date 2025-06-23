import { useEffect } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import TaskElement from './TaskElement';
import { __ } from '@wordpress/i18n';
import useTasks from '@//store/useTasksStore';
import ProgressFooter from '@/components/Dashboard/ProgressFooter';

const LoadingComponent = () => (
  <div className="burst-task-element">
    <span className={'burst-task-status burst-loading'}>
      {__( 'Loading...', 'burst-statistics' )}
    </span>
    <p className="burst-task-message">
      {__( 'Loading tasks...', 'burst-statistics' )}
    </p>
  </div>
);

const NoTasksComponent = () => (
  <div className="burst-task-element">
    <span className={'burst-task-status burst-completed'}>
      {__( 'Completed', 'burst-statistics' )}
    </span>
    <p className="burst-task-message">
      {__( 'No remaining tasks to show', 'burst-statistics' )}
    </p>
  </div>
);

const TaskSwitch = ({filter, setFilter}) => {
  return (
    <div className="flex items-center justify-center gap-2">
      
      
      <button 
        className={`py-1.5 text-sm rounded-md transition-colors ${
          filter === 'all' 
            ? 'text-gray-700 underline font-bold' : ''
        }`}
        onClick={() => setFilter('all')}
      >
        {__('All tasks', 'burst-statistics')}
      </button>
      <span className="text-gray-400">|</span>
      <button 
        className={`py-1.5 text-sm rounded-md transition-colors text-gray-700 ${
          filter === 'remaining' 
            ? 'text-gray-700 underline font-bold' : ''
        }`}
        onClick={() => setFilter('remaining')}
      >
        {__('Remaining tasks', 'burst-statistics')}
      </button>
    </div>
  );
};


const ProgressBlock = ({ highLightField }) => {
  const loading = useTasks( ( state ) => state.loading );
  const filter = useTasks( ( state ) => state.filter );
  const setFilter = useTasks( ( state ) => state.setFilter );
  const tasks = useTasks( ( state ) => state.tasks );
  const getTasks = useTasks( ( state ) => state.getTasks );
  const filteredTasks = useTasks( ( state ) => state.filteredTasks );
  const dismissTask = useTasks( ( state ) => state.dismissTask );

  useEffect( () => {
    getTasks();
  }, [ getTasks ]);

  let displayTasks = 'remaining' === filter ? filteredTasks : tasks;

  const renderTasks = () => {
    if ( loading ) {
      return <LoadingComponent />;
    }

    if ( 0 === displayTasks.length ) {
      return <NoTasksComponent />;
    }

    return displayTasks.map( ( task ) => (
      <TaskElement
        key={task.id}
        task={task}
        onCloseTaskHandler={() => dismissTask( task.id )}
        highLightField={highLightField}
      />
    ) );
  };
  

  return (
    <Block className="row-span-2 lg:col-span-12 xl:col-span-6">
      <BlockHeading
        title={__( 'Progress', 'burst-statistics' )}
        controls={<TaskSwitch filter={filter} setFilter={setFilter} />}
      />
      <BlockContent className={'px-0 py-0'}>
        <div className="burst-progress-block">
          <div className="burst-scroll-container">{renderTasks()}</div>
        </div>
      </BlockContent>
      <BlockFooter>
        <ProgressFooter />
      </BlockFooter>
    </Block>
  );
};

export default ProgressBlock;
