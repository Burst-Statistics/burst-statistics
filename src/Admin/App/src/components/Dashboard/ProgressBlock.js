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
  <div className="flex items-center justify-center gap-m pb-s">
    <span className="block min-w-[96px] text-center rounded-[15px] px-2 py-1 font-semibold text-xxs burst-loading">
      {__( 'Loading...', 'burst-statistics' )}
    </span>
    <p className="flex-1">
      {__( 'Loading tasks...', 'burst-statistics' )}
    </p>
  </div>
);

const NoTasksComponent = () => (
  <div className="flex items-center justify-center gap-m pb-s">
    <span className="block min-w-[96px] text-center rounded-[15px] px-2 py-1 font-semibold text-xxs burst-completed">
      {__( 'Completed', 'burst-statistics' )}
    </span>
    <p className="flex-1">
      {__( 'No remaining tasks to show', 'burst-statistics' )}
    </p>
  </div>
);

const TaskSwitch = ({ filter, setFilter }) => {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        className={`rounded-md py-1.5 text-sm transition-colors ${
          'all' === filter ? 'font-bold text-gray underline' : ''
        }`}
        onClick={() => setFilter( 'all' )}
      >
        {__( 'All tasks', 'burst-statistics' )}
      </button>
      <span className="text-gray">|</span>
      <button
        className={`rounded-md py-1.5 text-sm text-gray transition-colors ${
          'remaining' === filter ? 'font-bold text-gray underline' : ''
        }`}
        onClick={() => setFilter( 'remaining' )}
      >
        {__( 'Remaining tasks', 'burst-statistics' )}
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
      <BlockContent className="px-0 py-0">
        <div>
          <div className="burst-scroll px-l pt-m h-[300px] overflow-y-auto rounded-none
         bg-blue-light
         [background-image:linear-gradient(to_top,theme(colors.blue.light),theme(colors.blue.light)),linear-gradient(to_top,theme(colors.blue.light),theme(colors.blue.light)),linear-gradient(to_top,rgba(0,0,0,0.15),rgba(255,255,255,0)),linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(255,255,255,0))]
         [background-position:bottom_center,top_center,bottom_center,top_center]
         [background-repeat:no-repeat]
         [background-size:100%_25px,100%_25px,100%_15px,100%_15px]
         [background-attachment:local,local,scroll,scroll]">{renderTasks()}</div>
        </div>
      </BlockContent>
      <BlockFooter>
        <ProgressFooter />
      </BlockFooter>
    </Block>
  );
};

export default ProgressBlock;
