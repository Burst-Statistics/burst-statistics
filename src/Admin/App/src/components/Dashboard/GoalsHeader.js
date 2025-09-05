import React from 'react';
import Icon from '../../utils/Icon';
import {__} from '@wordpress/i18n';

const GoalsHeader = ({goals, goalId, setGoalId}) => {

  // if goalValues is an empty array, return null
  if ( 0 === goals.length ) {
    return <Icon name={'loading'} />;
  }

  const handleChange = ( event ) => {
    setGoalId( event.target.value );
  };

  return (
    <div className="flex items-center gap-xs">
      {1 === goals.length && goals[0] &&
        <p>{goals[0].title}</p>
      }
      {1 < goals.length &&
        <select
          onChange={( e ) => handleChange( e )}
          value={goalId || ''}
        >
          {Object.entries( goals ).map( ([ key, goal ]) => (
            goal && 'string' === typeof goal.title ? (
              <option key={key} value={goal.id}>{goal.title}</option>
            ) : <option key={key} value={key}>{__( 'Untitled goal', 'burst-statistics' )}</option>
          ) )}
        </select>
      }
    </div>
  );
};

export default GoalsHeader;
