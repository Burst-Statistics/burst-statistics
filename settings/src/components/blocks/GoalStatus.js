import {getRelativeTime} from '../../utils/formatting';
import Icon from '../../utils/Icon';
import {__} from '@wordpress/i18n';

const getStatusColor = ( status ) => {
  switch ( status ) {
    case 'active':
      return 'green';
    case 'inactive':
      return 'grey';
    default:
      return 'gray';
  }
};

const getStatusLabel = ( status ) => {
  switch ( status ) {
    case 'active':
      return __( 'Active', 'burst-statistics' );
    case 'inactive':
      return __( 'Inactive', 'burst-statistics' );
    default:
      return __( 'Unknown', 'burst-statistics' );
  }
};
const GoalStatus = ({data}) => {
  const {dateStart, dateEnd, dateCreated, status} = data;

  const iconColor = getStatusColor( status );
  const startedOrCreatedDate = dateStart || dateCreated;
  const dateTitle = dateStart ? __( 'Started', 'burst-statistics' ) : __( 'Created', 'burst-statistics' );
  const relativeTime = getRelativeTime( startedOrCreatedDate );
  const statusLabel = getStatusLabel( status );

  return (
      <div className="burst-goal-status">
        <Icon name="dot" color={iconColor} size={12}/>
        <p>{statusLabel}</p>
      </div>
  );
};

export default GoalStatus;
