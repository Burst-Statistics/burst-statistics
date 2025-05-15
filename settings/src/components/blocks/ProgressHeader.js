import {__} from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import useNotices from '../../store/useNoticesStore';

const ProgressHeader = ({countAll, countRemaining}) => {
  const { setFilter, filter, notices, filteredNotices } = useNotices( ( state ) => ({
    setFilter: state.setFilter,
    filter: state.filter
  }) );

  const onFilterChange = ( e ) => {
    let selectedFilter = e.target.getAttribute( 'data-filter' );
    if ( 'all' === selectedFilter || 'remaining' === selectedFilter ) {
      setFilter( selectedFilter );
    }
  };

  return (
      <div className={`burst-task-switcher-container burst-active-filter-${filter}`}>
      <span className="burst-task-switcher burst-all-tasks"
            onClick={onFilterChange}
            data-filter="all">
        {__( 'All tasks', 'burst-statistics' )}
        <span className="burst_task_count">({countAll})</span>
      </span>
        <span className="burst-task-switcher burst-remaining-tasks"
              onClick={onFilterChange}
              data-filter="remaining">
        {__( 'Remaining tasks', 'burst-statistics' )}
          <span className="burst_task_count">({countRemaining})</span>
      </span>
      </div>
  );
};
export default ProgressHeader;
