import {
  useEffect
} from '@wordpress/element';

import TaskElement from './TaskElement';
import {__} from '@wordpress/i18n';
import useNotices from '../../store/useNoticesStore';
import GridItem from '../common/GridItem';
import ProgressHeader from './ProgressHeader';
import ProgressFooter from './ProgressFooter';

const LoadingComponent = () => (
    <div className="burst-task-element">
    <span className={'burst-task-status burst-loading'}>
      {__( 'Loading...', 'burst-statistics' )}
    </span>
      <p className="burst-task-message">
        {__( 'Loading notices...', 'burst-statistics' )}
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

const ProgressBlock = ({ highLightField }) => {
  const loading = useNotices( ( state ) => state.loading );
  const filter = useNotices( ( state ) => state.filter );
  const notices = useNotices( ( state ) => state.notices );
  const getNotices = useNotices( ( state ) => state.getNotices );
  const filteredNotices = useNotices( ( state ) => state.filteredNotices );
  const dismissNotice = useNotices( ( state ) => state.dismissNotice );

  useEffect( () => {
    getNotices();
  }, [ getNotices ]);

  const displayNotices = 'remaining' === filter ? filteredNotices : notices;

  const renderTasks = () => {
    if ( loading ) {
      return <LoadingComponent />;
    }

    if ( 0 === displayNotices.length ) {
      return <NoTasksComponent />;
    }



    return displayNotices.map( ( notice ) =>
        <TaskElement
            key={notice.id}
            notice={notice}
            onCloseTaskHandler={() => dismissNotice( notice.id )}
            highLightField={highLightField}
        />
    );
  };

  return (
      <GridItem
          className={'burst-column-2 burst-progress'}
          title={__( 'Progress', 'burst-statistics' )}
          controls={<ProgressHeader countAll={notices.length} countRemaining={filteredNotices.length}/>}
          footer={<ProgressFooter/>}
      >
        <div className="burst-progress-block">
          <div className="burst-scroll-container">
            {renderTasks()}
          </div>
        </div>
      </GridItem>
  );
};

export default ProgressBlock;
